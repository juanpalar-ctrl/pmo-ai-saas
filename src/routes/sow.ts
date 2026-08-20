/**
 * src/routes/sow.ts
 * Statement of Work (SOW) upload, management, and extraction endpoints
 * Protected by requireAuth middleware
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../db';
import { requireAuth } from '../middleware/requireAuth';

type AuthRequest = any;
import { routeLogger } from '../core/logger';
import {
  extractTextFromFile,
  validateFileType,
  sanitizeFilename,
} from '../utils/fileParser';

const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'storage', 'sow');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, sanitizeFilename(file.originalname));
  },
});

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const fileType = file.originalname.split('.').pop()?.toLowerCase();
  const validTypes = ['pdf', 'docx'];

  if (!validTypes.includes(fileType || '')) {
    cb(new Error(`Invalid file type. Allowed: ${validTypes.join(', ')}`));
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

/**
 * POST /api/projects/:projectId/sow/upload
 * Upload a new SOW document for a project
 */
router.post(
  '/:projectId/upload',
  requireAuth,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;

      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      // Verify project exists and user has access
      const projectRes = await pool.query(
        'SELECT id FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectRes.rows.length === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const fileType = validateFileType(
        req.file.originalname,
        req.file.mimetype
      );

      const filePath = path.join(uploadDir, req.file.filename);

      // Delete existing SOW if present
      const existingRes = await pool.query(
        'SELECT id, storage_path FROM sow_documents WHERE project_id = $1',
        [projectId]
      );

      if (existingRes.rows.length > 0) {
        const existingPath = existingRes.rows[0].storage_path;
        if (fs.existsSync(existingPath)) {
          fs.unlinkSync(existingPath);
        }
        await pool.query('DELETE FROM sow_documents WHERE project_id = $1', [
          projectId,
        ]);
      }

      // Insert SOW metadata
      const insertRes = await pool.query(
        `INSERT INTO sow_documents
         (project_id, user_id, filename, file_type, file_size_bytes, storage_path)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, filename, file_size_bytes`,
        [
          projectId,
          userId,
          req.file.originalname,
          fileType,
          req.file.size,
          filePath,
        ]
      );

      const sowDocumentId = insertRes.rows[0].id;

      // Extract text asynchronously
      setImmediate(async () => {
        try {
          const extractedText = await extractTextFromFile(filePath, fileType);

          await pool.query(
            `INSERT INTO sow_content
             (project_id, sow_document_id, extracted_text, char_count, extraction_status)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (project_id) DO UPDATE SET
             extracted_text = $3, char_count = $4, extracted_at = NOW()`,
            [
              projectId,
              sowDocumentId,
              extractedText,
              extractedText.length,
              'success',
            ]
          );

          routeLogger.info(
            { projectId, charCount: extractedText.length },
            'SOW extraction completed'
          );
        } catch (error) {
          routeLogger.error({ projectId, err: error }, 'SOW extraction failed');
          await pool.query(
            `UPDATE sow_content SET extraction_status = $1 WHERE project_id = $2`,
            ['failed', projectId]
          );
        }
      });

      res.status(201).json({
        success: true,
        file: {
          id: sowDocumentId,
          filename: req.file.originalname,
          size: req.file.size,
          type: fileType,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      routeLogger.error({ err: error }, 'SOW upload error');
      if (req.file && fs.existsSync(path.join(uploadDir, req.file.filename))) {
        fs.unlinkSync(path.join(uploadDir, req.file.filename));
      }
      res.status(500).json({ error: 'Failed to upload SOW file' });
    }
  }
);

/**
 * GET /api/projects/:projectId/sow
 * Get SOW metadata and content for a project
 */
router.get('/:projectId/sow', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    const res_sow = await pool.query(
      `SELECT d.id, d.filename, d.file_size_bytes as size, d.file_type as type,
              d.uploaded_at as uploadedAt, d.use_in_analysis as useInAnalysis,
              c.extracted_text, c.char_count as charCount, c.extraction_status as extractionStatus
       FROM sow_documents d
       LEFT JOIN sow_content c ON d.project_id = c.project_id
       WHERE d.project_id = $1`,
      [projectId]
    );

    if (res_sow.rows.length === 0) {
      res.status(200).json({
        success: true,
        file: null,
      });
      return;
    }

    const sow = res_sow.rows[0];
    const preview = sow.extracted_text
      ? sow.extracted_text.substring(0, 500)
      : null;

    res.status(200).json({
      success: true,
      file: {
        id: sow.id,
        filename: sow.filename,
        size: sow.size,
        type: sow.type,
        uploadedAt: sow.uploadedat,
        useInAnalysis: sow.useinanalysis,
        charCount: sow.charcount,
        extractionStatus: sow.extractionstatus,
        preview: preview,
      },
    });
  } catch (error) {
    routeLogger.error({ err: error }, 'Get SOW error');
    res.status(500).json({ error: 'Failed to get SOW information' });
  }
});

/**
 * DELETE /api/projects/:projectId/sow
 * Delete SOW document for a project
 */
router.delete(
  '/:projectId/sow',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      const res_sow = await pool.query(
        'SELECT storage_path FROM sow_documents WHERE project_id = $1',
        [projectId]
      );

      if (res_sow.rows.length === 0) {
        res.status(404).json({ error: 'SOW not found' });
        return;
      }

      const filePath = res_sow.rows[0].storage_path;

      // Delete file from disk
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database
      await pool.query(
        'DELETE FROM sow_documents WHERE project_id = $1',
        [projectId]
      );

      res.status(200).json({
        success: true,
        message: 'SOW deleted successfully',
      });
    } catch (error) {
      routeLogger.error({ err: error }, 'Delete SOW error');
      res.status(500).json({ error: 'Failed to delete SOW' });
    }
  }
);

/**
 * PATCH /api/projects/:projectId/sow/toggle
 * Toggle use of SOW in analysis
 */
router.patch(
  '/:projectId/toggle',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { useInAnalysis } = req.body;

      if (typeof useInAnalysis !== 'boolean') {
        res.status(400).json({ error: 'useInAnalysis must be boolean' });
        return;
      }

      const res_update = await pool.query(
        'UPDATE sow_documents SET use_in_analysis = $1 WHERE project_id = $2 RETURNING use_in_analysis',
        [useInAnalysis, projectId]
      );

      if (res_update.rows.length === 0) {
        res.status(404).json({ error: 'SOW not found' });
        return;
      }

      res.status(200).json({
        success: true,
        useInAnalysis: res_update.rows[0].use_in_analysis,
      });
    } catch (error) {
      routeLogger.error({ err: error }, 'Toggle SOW error');
      res.status(500).json({ error: 'Failed to toggle SOW setting' });
    }
  }
);

/**
 * GET /api/projects/:projectId/sow/content
 * Get full extracted content (for analysis)
 */
router.get(
  '/:projectId/content',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      const res_content = await pool.query(
        `SELECT extracted_text, extraction_status, extracted_at
         FROM sow_content WHERE project_id = $1 AND extraction_status = 'success'`,
        [projectId]
      );

      if (res_content.rows.length === 0) {
        res.status(200).json({
          success: true,
          content: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        content: res_content.rows[0].extracted_text,
        extractedAt: res_content.rows[0].extracted_at,
      });
    } catch (error) {
      routeLogger.error({ err: error }, 'Get SOW content error');
      res.status(500).json({ error: 'Failed to get SOW content' });
    }
  }
);

export default router;
