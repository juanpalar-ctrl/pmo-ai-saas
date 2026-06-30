import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { detectColumns } from '../agents/normalizationAgent';
import { parseExcelSample, parseExcelComplete } from '../services/excelParser';
import { transformDataset } from '../services/dataTransformer';
import { validateUploadPath, isValidTempMappingFilename, getUploadsDir } from '../utils/pathValidator';
import {
  DetectColumnsResponseSchema,
  SaveMappingRequestSchema,
  NormalizedProjectBatchSchema,
  TransformedProjectRowSchema,
} from '../config/validation';
import { pool } from '../db';
import jwt from 'jsonwebtoken';

const router = Router();

const uploadsDir = getUploadsDir();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const tempUuid = uuidv4();
    const tempFilename = `temp_mapping_${tempUuid}.xlsx`;
    cb(null, tempFilename);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: (error: Error | null, accept?: boolean) => void) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});


router.post(
  '/detect-columns',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    let tempFilePath: string | null = null;

    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      tempFilePath = req.file.path;
      const tempFilename = req.file.filename;

      console.log(`[detect-columns] 📥 Processing file: ${tempFilename}`);


      const parseResult = await parseExcelSample(tempFilePath);
      console.log(`[detect-columns] ✅ Extracted ${parseResult.headers.length} headers`);

      const normalizationResult = await detectColumns({
        headers: parseResult.headers,
        sampleRows: parseResult.sampleRows,
      });

      console.log(`[detect-columns] ✅ Got ${normalizationResult.suggestions.length} suggestions`);

      const response = {
        headers: parseResult.headers,
        sampleRows: parseResult.sampleRows,
        suggestions: normalizationResult.suggestions,
        tempFilename,
      };

      const validatedResponse = DetectColumnsResponseSchema.parse(response);

      res.status(200).json({
        success: true,
        data: validatedResponse,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[detect-columns] ❌ Error: ${errorMessage}`);

      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (unlinkErr) {
          console.warn(`[detect-columns] Failed to clean up: ${unlinkErr}`);
        }
      }

      res.status(400).json({
        error: errorMessage,
        details: 'Failed to detect columns',
      });
    }
  }
);

router.post('/save-mapping', async (req: Request, res: Response): Promise<void> => {
  let tempFilePath: string | null = null;

  try {
    const validatedRequest = SaveMappingRequestSchema.parse(req.body);
    const { tempFilename, confirmedMapping, framework, org } = validatedRequest;
    console.log('[save-mapping] 📊 Received framework:', framework);

    console.log(`[save-mapping] 💾 Processing mapping for: ${tempFilename}`);

    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error('Not authenticated');
    }


    if (!isValidTempMappingFilename(tempFilename)) {
      throw new Error('Invalid temporary filename format');
    }

    tempFilePath = validateUploadPath(tempFilename);

    const allRows = await parseExcelComplete(tempFilePath);
    console.log(`[save-mapping] ✅ Read ${allRows.length} rows`);

    const transformedRows = transformDataset(allRows, confirmedMapping);
    console.log(`[save-mapping] ✅ Transformed ${transformedRows.length} rows`);

    const validatedRows = [];
    for (const row of transformedRows) {
      try {
        const validated = TransformedProjectRowSchema.parse(row);
        validatedRows.push(validated);
      } catch (validationErr) {
        console.warn(`[save-mapping] ⚠️ Row validation failed`);
      }
    }

    if (validatedRows.length === 0) {
      throw new Error('No valid rows after validation');
    }

    console.log(`[save-mapping] ✅ Validated ${validatedRows.length} rows`);

    const normalizedBatch = {
      projects: validatedRows,
      sourceFilename: 'imported',
      normalizedAt: new Date().toISOString(),
    };

    NormalizedProjectBatchSchema.parse(normalizedBatch);

    console.log(`[save-mapping] 💾 Inserting ${validatedRows.length} projects into database...`);

    const projectId = Math.floor(Date.now() / 1000);
    const now = new Date().toISOString();

    const projectResult = await pool.query(
      `INSERT INTO project_data (projectid, projectname, status, uploadedat, updatedat) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [projectId, `imported-${projectId}`, 'Not Started', now, now]
    );

    const id = projectResult.rows[0].id;
    console.log(`[save-mapping] ✅ Project created with ID: ${id} (projectid: ${projectId})`);

    const analysisOutput = {
      projects: validatedRows,
      sourceFilename: 'imported',
      normalizedAt: now,
      org,
    };

    await pool.query(
      `INSERT INTO ai_analyses (projectid, agenttype, output, generatedat) 
       VALUES ($1, $2, $3, $4)`,
      [projectId, 'normalization', JSON.stringify(analysisOutput), now]
    );

    console.log(`[save-mapping] ✅ Analysis data stored`);

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`[save-mapping] 🗑️ Cleaned up temp file`);
    }

    // Trigger analysis agents SYNCHRONOUSLY (wait for completion)
    console.log(`[save-mapping] 🤖 Triggering analysis agents for projectid ${projectId}...`);
    try {
      const { orchestrator } = await import('../services/multiAgentOrchestrator');

      console.log(`[save-mapping] 🔄 Executing analysis orchestration...`);
      const analysisResult = await orchestrator.analyzeProject(projectId, framework);

      console.log(`[save-mapping] ✅ Analysis complete and stored`);
    } catch (err) {
      console.error(`[save-mapping] ⚠️ Analysis failed:`, err);
    }

    res.status(200).json({
      success: true,
      message: 'Data mapping confirmed',
      rowsProcessed: validatedRows.length,
      projectId: id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[save-mapping] ❌ Error: ${errorMessage}`);

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkErr) {
        console.warn(`[save-mapping] Failed to clean up: ${unlinkErr}`);
      }
    }

    res.status(400).json({
      error: errorMessage,
      details: 'Failed to save mapping',
    });
  }
});

export default router;