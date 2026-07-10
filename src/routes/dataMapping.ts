import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { detectColumns } from '../agents/normalizationAgent';
import { parseExcelSample, parseExcelComplete } from '../services/excelParser';
import { transformDataset, calculateDIS } from '../services/dataTransformer';
import { validateUploadPath, isValidTempMappingFilename, getUploadsDir } from '../utils/pathValidator';
import {
  DetectColumnsResponseSchema,
  SaveMappingRequestSchema,
  NormalizedProjectBatchSchema,
  TransformedProjectRowSchema,
} from '../config/validation';
import { pool } from '../db';
import { routeLogger } from '../core/logger';
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

      routeLogger.info(`[detect-columns] 📥 Processing file: ${tempFilename}`);


      const parseResult = await parseExcelSample(tempFilePath);
      routeLogger.info(`[detect-columns] ✅ Extracted ${parseResult.headers.length} headers`);

      const normalizationResult = await detectColumns({
        headers: parseResult.headers,
        sampleRows: parseResult.sampleRows,
      });

      routeLogger.info(`[detect-columns] ✅ Got ${normalizationResult.suggestions.length} suggestions`);

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
      routeLogger.error(`[detect-columns] ❌ Error: ${errorMessage}`);

      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (unlinkErr) {
          routeLogger.warn(`[detect-columns] Failed to clean up: ${unlinkErr}`);
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
    const { tempFilename, confirmedMapping, framework, org, lang, targetProjectId } = validatedRequest;
    routeLogger.info({ framework, lang, targetProjectId }, '[save-mapping] Received framework');

    routeLogger.info(`[save-mapping] 💾 Processing mapping for: ${tempFilename}`);

    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error('Not authenticated');
    }


    if (!isValidTempMappingFilename(tempFilename)) {
      throw new Error('Invalid temporary filename format');
    }

    tempFilePath = validateUploadPath(tempFilename);

    const allRows = await parseExcelComplete(tempFilePath);
    routeLogger.info(`[save-mapping] ✅ Read ${allRows.length} rows`);

    const transformedRows = transformDataset(allRows, confirmedMapping);
    const dis = calculateDIS(transformedRows, confirmedMapping);
    routeLogger.info(`[save-mapping] ✅ Transformed ${transformedRows.length} rows | DIS: ${dis.score} (${dis.grade})`);

    const validatedRows = [];
    for (const row of transformedRows) {
      try {
        const validated = TransformedProjectRowSchema.parse(row);
        validatedRows.push(validated);
      } catch (validationErr) {
        routeLogger.warn(`[save-mapping] ⚠️ Row validation failed`);
      }
    }

    if (validatedRows.length === 0) {
      throw new Error('No valid rows after validation');
    }

    routeLogger.info(`[save-mapping] ✅ Validated ${validatedRows.length} rows`);

    const normalizedBatch = {
      projects: validatedRows,
      sourceFilename: 'imported',
      normalizedAt: new Date().toISOString(),
    };

    NormalizedProjectBatchSchema.parse(normalizedBatch);

    routeLogger.info(`[save-mapping] 💾 Inserting ${validatedRows.length} projects into database...`);

    const now = new Date().toISOString();

    let projectId: number; // business projectid (shared across snapshots)
    let id: number;        // project_data.id (used by the UI to navigate)
    let effectiveOrg = org;

    if (targetProjectId != null) {
      // Fase 2: append this upload as a new snapshot of an existing project.
      // Reuse its projectid so ai_analyses / team_members accumulate under one
      // project instead of minting a disconnected one. No new project_data row.
      const existing = await pool.query(
        `SELECT id, projectid, projectname FROM project_data WHERE id = $1 AND user_id = $2`,
        [targetProjectId, userId]
      );
      if (existing.rows.length === 0) {
        throw new Error('Proyecto destino no encontrado');
      }
      id = existing.rows[0].id;
      projectId = existing.rows[0].projectid;
      effectiveOrg = existing.rows[0].projectname || org;
      await pool.query(`UPDATE project_data SET updatedat = $1 WHERE id = $2`, [now, id]);
      routeLogger.info(`[save-mapping] 📎 Appending snapshot to existing project ${id} (projectid: ${projectId})`);
    } else {
      projectId = Math.floor(Date.now() / 1000);
      const projectResult = await pool.query(
        `INSERT INTO project_data (projectid, projectname, status, uploadedat, updatedat, user_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [projectId, org || `imported-${projectId}`, 'Not Started', now, now, userId]
      );
      id = projectResult.rows[0].id;
      routeLogger.info(`[save-mapping] ✅ Project created with ID: ${id} (projectid: ${projectId})`);
    }

    const analysisOutput = {
      projects: validatedRows,
      sourceFilename: 'imported',
      normalizedAt: now,
      org: effectiveOrg,
      dis,
      // Distinguishes this snapshot from earlier ones under the same projectid
      // (Fase 3 will read multiple snapshots to compute historical workload).
      snapshotLabel: now.slice(0, 10),
    };

    await pool.query(
      `INSERT INTO ai_analyses (projectid, user_id, agenttype, output, generatedat)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, userId, 'normalization', JSON.stringify(analysisOutput), now]
    );

    routeLogger.info(`[save-mapping] ✅ Analysis data stored`);

    // Hito 5.1: auto-populate the team board from the "assignee" column.
    // Non-fatal — a mapping without that column just means an empty board.
    try {
      const { teamService } = await import('../services/teamService');
      await teamService.autoPopulateTeam(projectId, userId, validatedRows);
    } catch (err) {
      routeLogger.error({ err }, '[save-mapping] Team auto-populate failed');
    }

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      routeLogger.info(`[save-mapping] 🗑️ Cleaned up temp file`);
    }

    // Trigger analysis agents SYNCHRONOUSLY (wait for completion)
    routeLogger.info(`[save-mapping] 🤖 Triggering analysis agents for projectid ${projectId}...`);
    try {
      const { orchestrator } = await import('../services/multiAgentOrchestrator');

      routeLogger.info(`[save-mapping] 🔄 Executing analysis orchestration...`);
      const analysisResult = await orchestrator.analyzeProject(projectId, framework, userId, effectiveOrg, lang);

      routeLogger.info(`[save-mapping] ✅ Analysis complete and stored`);
    } catch (err) {
      routeLogger.error({ err }, '[save-mapping] Analysis failed');
    }

    res.status(200).json({
      success: true,
      message: 'Data mapping confirmed',
      rowsProcessed: validatedRows.length,
      projectId: id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    routeLogger.error(`[save-mapping] ❌ Error: ${errorMessage}`);

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkErr) {
        routeLogger.warn(`[save-mapping] Failed to clean up: ${unlinkErr}`);
      }
    }

    res.status(400).json({
      error: errorMessage,
      details: 'Failed to save mapping',
    });
  }
});

export default router;