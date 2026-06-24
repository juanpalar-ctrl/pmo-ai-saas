import express, { Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import { ExcelAdapter } from '../services/adapters/ExcelAdapter';
import { dataIngestService } from '../services/dataIngestService';
import { projectRepository } from '../repositories/projectRepository';
import { pool } from '../db';
import { UPLOAD_MESSAGES } from '../config/messages';
 
const router = express.Router();
 
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname}`;
    cb(null, filename);
  },
});
 
const fileFilter = (req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext !== '.xlsx') {
    return cb(new Error('❌ Solo se aceptan archivos .xlsx'));
  }
  
  cb(null, true);
};
 
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
 
import * as fs from 'fs';
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}
 
router.post('/upload-excel', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: UPLOAD_MESSAGES.INVALID_FORMAT,
      });
    }
    
    const adapter = new ExcelAdapter(req.file.path);
    const result = await dataIngestService.ingestFromAdapterWithDetails(adapter);
    
    fs.unlinkSync(req.file.path);
    
    if (result.count === 0) {
      return res.status(400).json({
        success: false,
        error: "No se encontraron filas válidas en el archivo.",
        rejected: result.rejected,
        rejectionReasons: result.rejectionReasons,
      });
    }
    
    res.json({
      success: true,
      message: UPLOAD_MESSAGES.UPLOAD_SUCCESS,
      count: result.count,
      rejected: result.rejected,
      rejectionReasons: result.rejected > 0 ? result.rejectionReasons : [],
      filename: req.file.filename,
    });
    
  } catch (error: any) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
 
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const projects = await projectRepository.getAllProjects(page, limit);
    
    res.json({
      success: true,
      count: projects.length,
      page,
      limit,
      data: projects,
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido',
    });
  }
});
 
router.get('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const project = await projectRepository.getProjectForAnalysis(parseInt(projectId as string));
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: `Proyecto ${projectId} no encontrado`,
      });
    }
    
    res.json({
      success: true,
      data: project,
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
 
router.get('/projects/history/latest', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT pd.*, aa.output
      FROM project_data pd
      INNER JOIN ai_analyses aa ON pd.id = aa.projectid
      WHERE aa.id IN (
        SELECT MAX(id) FROM ai_analyses GROUP BY projectid
      )
      ORDER BY aa.id DESC
      LIMIT 10
    `;
    
    const { rows } = await pool.query(query);
    
    const data = rows.map(row => ({
      projectId: row.id,
      projectName: row.projectname,
      framework: row.output?.metrics?.framework || 'unknown',
      timestamp: row.output?.timestamp || new Date().toISOString(),
      totalBudget: row.budgetdata?.totalBudget || 0,
      filename: row.filename || 'unknown'
    }));
    
    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
 
router.get('/analysis/:projectId/latest', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const projectResult = await pool.query(
      `SELECT projectid FROM project_data WHERE id = $1`,
      [projectId]
    );
 
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
 
    const realProjectId = projectResult.rows[0].projectid;
 
    const result = await pool.query(
      `SELECT output FROM ai_analyses 
       WHERE projectid = $1 AND agenttype = 'combined'
       ORDER BY generatedat DESC
       LIMIT 1`,
      [realProjectId]
    );
 
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No hay análisis' });
    }
 
    const output = result.rows[0].output || {};
 
    res.json({
      success: true,
      data: {
        risk: output.risk || {},
        economic: output.economic || {},
        reports: output.reports || {},
        metrics: output.metrics || {}
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
 
export default router;