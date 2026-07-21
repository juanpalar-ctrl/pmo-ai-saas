import express, { Request, Response } from 'express';
import { errorMessage } from '../core/errors';
import multer from 'multer';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { ExcelAdapter } from '../services/adapters/ExcelAdapter';
import { dataIngestService } from '../services/dataIngestService';
import { projectRepository } from '../repositories/projectRepository';
import { pool } from '../db';
import { UPLOAD_MESSAGES } from '../config/messages';
import { ProjectIdParamSchema, PaginationQuerySchema } from '../config/validation';
import { routeLogger } from '../core/logger';
import { computeHealthScore } from '../services/portfolioService';
import { TransformedRow } from '../services/frameworkMetrics';
import { AuthRequest } from '../middleware/requireAuth';
 
const router = express.Router();
 
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    // path.basename descarta cualquier componente de ruta ("../../x.xlsx") que
    // venga en originalname: sin esto, un nombre con traversal podía escribir el
    // archivo fuera de ./uploads al unirse con el destino.
    const safeName = path.basename(file.originalname).replace(/[^\w.\-]/g, '_');
    const filename = `${timestamp}-${safeName}`;
    cb(null, filename);
  },
});
 
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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
    const userId = (req as AuthRequest).user!.id;
    const result = await dataIngestService.ingestFromAdapterWithDetails(adapter, userId);
    
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
    
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage(error),
    });
  }
});
 
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const pq = PaginationQuerySchema.safeParse(req.query);
    if (!pq.success) return res.status(400).json({ success: false, error: pq.error.flatten() });
    const { page, limit } = pq.data;
    const userId = (req as AuthRequest).user!.id;

    const projects = await projectRepository.getAllProjects(userId, page, limit);

    res.json({
      success: true,
      count: projects.length,
      page,
      limit,
      data: projects,
    });

  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'GET /projects error');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

router.get('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ success: false, error: 'projectId inválido' });
    const { projectId } = params.data;
    const userId = (req as AuthRequest).user!.id;

    const project = await projectRepository.getProjectForAnalysis(projectId, userId);

    if (!project) {
      return res.status(404).json({ success: false, error: `Proyecto ${projectId} no encontrado` });
    }

    res.json({ success: true, data: project });

  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'GET /projects/:id error');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});
 
// DELETE /api/data/projects/:id
// :id is the project_data.id (same identifier used by the portfolio grid and
// the history sidebar to navigate to a project), not the business projectid.
router.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'id inválido' });
    }
    const userId = (req as AuthRequest).user!.id;

    const projectResult = await pool.query(`SELECT projectid FROM project_data WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }
    const realProjectId = projectResult.rows[0].projectid;

    await pool.query('DELETE FROM ai_analyses WHERE projectid = $1 AND user_id = $2', [realProjectId, userId]);
    await pool.query('DELETE FROM project_data WHERE id = $1', [id]);

    routeLogger.info({ id, realProjectId }, 'Project deleted');
    res.json({ success: true });
  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'DELETE /projects/:id error');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

router.get('/projects/history/latest', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const query = `
      SELECT pd.*, aa.output
      FROM project_data pd
      INNER JOIN ai_analyses aa ON pd.projectid = aa.projectid AND aa.user_id = pd.user_id
      WHERE aa.agenttype != 'normalization'
        AND pd.user_id = $1
        AND aa.id IN (
          SELECT MAX(id) FROM ai_analyses WHERE agenttype != 'normalization' AND user_id = $1 GROUP BY projectid
        )
      ORDER BY aa.id DESC
      LIMIT 10
    `;

    const { rows } = await pool.query(query, [userId]);
    
    const data = rows.map(row => ({
      projectId: row.id,
      projectName: row.projectname,
      org: row.output?.org || 'Sin especificar',
      framework: row.output?.metrics?.framework || 'unknown',
      timestamp: row.output?.timestamp || new Date().toISOString(),
      totalBudget: row.budgetdata?.totalBudget || parseFloat(row.output?.metrics?.bac || row.output?.metrics?.pv || 0) || 0,
      filename: row.filename || 'unknown'
    }));
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: errorMessage(error)
    });
  }
});
 
router.get('/analysis/:projectId/latest', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ success: false, message: 'projectId inválido' });
    }
    const { projectId } = params.data;
    const userId = (req as AuthRequest).user!.id;

    const projectResult = await pool.query(
      `SELECT projectid FROM project_data WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
 
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
 
    const realProjectId = projectResult.rows[0].projectid;
 
    const result = await pool.query(
      `SELECT output FROM ai_analyses
       WHERE projectid = $1 AND user_id = $2 AND agenttype = 'combined'
       ORDER BY generatedat DESC
       LIMIT 1`,
      [realProjectId, userId]
    );
 
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No hay análisis' });
    }
 
    const output = result.rows[0].output || {};

    // Compute healthScore/healthLabel here (same formula portfolioService.ts uses
    // for /portfolio) so the frontend displays this value instead of recomputing
    // it independently — that's what let the two pages disagree before. The
    // riskScore arg keeps this in sync with the AI risk agent's verdict too —
    // see the comment on riskScorePenalty() in portfolioService.ts.
    const { score: healthScore, label: healthLabel } = computeHealthScore(
      parseFloat(output.metrics?.cpi || 1),
      parseFloat(output.metrics?.spi || 1),
      output.earlyWarnings?.criticalCount || 0,
      output.earlyWarnings?.highCount || 0,
      output.risk?.analysis?.analysis?.overallRiskScore
    );

    // Pass the full stored output through rather than hand-picking fields —
    // a hand-picked whitelist here previously dropped earlyWarnings, dis and
    // frameworkMetrics silently (frontend read them as undefined, no error).
    res.json({
      success: true,
      data: { ...output, healthScore, healthLabel }
    });
  } catch (err) {
    routeLogger.error({ err: errorMessage(err) }, 'GET /analysis/:projectId/latest error');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// GET /api/data/analysis/:projectId/tasks
// Returns individual task rows from the normalization pass for Gantt rendering
router.get('/analysis/:projectId/tasks', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ success: false, error: 'projectId inválido' });
    }
    const { projectId } = params.data;
    const userId = (req as AuthRequest).user!.id;

    const projectResult = await pool.query(
      `SELECT projectid FROM project_data WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }
    const realProjectId = projectResult.rows[0].projectid;

    const result = await pool.query(
      `SELECT output FROM ai_analyses
       WHERE projectid = $1 AND user_id = $2 AND agenttype = 'normalization'
       ORDER BY generatedat DESC LIMIT 1`,
      [realProjectId, userId]
    );

    const tasks: TransformedRow[] = result.rows[0]?.output?.projects || [];

    const mapped = tasks.map((t) => ({
      name:     t.project_name  || 'Sin nombre',
      plan:     parseFloat(String(t.estimated_cost ?? ''))   || 0,
      actual:   parseFloat(String(t.actual_cost ?? ''))      || 0,
      progress: parseFloat(String(t.progress_percent ?? '')) || 0,
      status:   t.status        || '',
      start:    t.start_date    || null,
      end:      t.end_date      || null,
    }));

    routeLogger.info({ projectId, taskCount: mapped.length }, 'Tasks fetched for Gantt');
    res.json({ success: true, tasks: mapped });
  } catch (err) {
    routeLogger.error({ err: errorMessage(err) }, 'GET /analysis/:projectId/tasks error');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// GET /api/data/export/pdf
// Generate and download PDF report
router.get('/export/pdf', async (req: Request, res: Response) => {
  let browser;
  try {
    const { projectId, type } = req.query;
    const userId = (req as AuthRequest).user!.id;

    if (!projectId || !type) {
      return res.status(400).json({ success: false, error: 'projectId y type requeridos' });
    }

    if (type !== 'senior' && type !== 'technical') {
      return res.status(400).json({ success: false, error: 'type debe ser senior o technical' });
    }

    // Fetch project
    const projectResult = await pool.query(
      `SELECT projectid, projectname FROM project_data WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    const { projectid: realProjectId, projectname } = projectResult.rows[0];

    // Fetch analysis
    const analysisResult = await pool.query(
      `SELECT output FROM ai_analyses
       WHERE projectid = $1 AND user_id = $2 AND agenttype = 'combined'
       ORDER BY generatedat DESC LIMIT 1`,
      [realProjectId, userId]
    );

    if (analysisResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No hay análisis' });
    }

    const { output } = analysisResult.rows[0];
    const reportContent = type === 'senior'
      ? output.reports?.senior_report
      : output.reports?.technical_report;

    if (!reportContent) {
      return res.status(404).json({ success: false, error: 'Reporte no disponible' });
    }

    const reportType = type === 'senior' ? 'Ejecutivo' : 'Técnico';
    const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const fileName = `LARA_${projectname.replace(/[^\w]/g, '_')}_${type}_${new Date().toISOString().split('T')[0]}.pdf`;

    // Generate HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; background: white; }
          .header { border-bottom: 3px solid #17B8A0; padding: 20px 0 15px 0; margin-bottom: 30px; }
          .logo { font-size: 20px; font-weight: 900; color: #0B7B8C; }
          .meta { font-size: 12px; color: #666; margin-top: 8px; }
          .meta strong { color: #0B7B8C; }
          .content { font-size: 13px; line-height: 1.8; }
          h1 { color: #0B7B8C; font-size: 1.8em; margin: 25px 0 15px 0; }
          h2 { color: #0B7B8C; font-size: 1.4em; margin: 22px 0 12px 0; border-bottom: 2px solid #e6f4f5; padding-bottom: 8px; }
          h3 { color: #0B7B8C; font-size: 1.15em; margin: 18px 0 10px 0; }
          p { margin-bottom: 12px; }
          ul, ol { margin: 12px 0 12px 25px; }
          li { margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #d6e9eb; padding: 10px; text-align: left; }
          th { background: #e6f4f5; color: #0B7B8C; font-weight: bold; }
          tr:nth-child(even) td { background: #f7fcfc; }
          blockquote { border-left: 4px solid #17B8A0; background: #f0f9fa; padding: 12px 15px; margin: 15px 0; color: #0B7B8C; font-style: italic; }
          code { background: #f3f4f6; padding: 3px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 0.9em; }
          pre { background: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; margin: 15px 0; font-size: 0.9em; line-height: 1.4; }
          hr { border: none; border-top: 1px solid #d6e9eb; margin: 25px 0; }
          strong { color: #0B7B8C; font-weight: 600; }
          em { font-style: italic; }
          page { page-break-after: always; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">⬡ LARA</div>
          <div class="meta">
            <strong>${escapeHtmlContent(projectname)}</strong> | Reporte ${reportType} | ${today}
          </div>
        </div>
        <div class="content">
          ${reportContent}
        </div>
      </body>
      </html>
    `;

    // Launch Puppeteer
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
        timeout: 30000
      });
    } catch (launchErr) {
      routeLogger.error({ err: errorMessage(launchErr) }, 'Puppeteer launch failed');
      return res.status(500).json({ success: false, error: 'Error iniciando generador de PDF' });
    }

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
        timeout: 30000
      });

      // Send response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);

      routeLogger.info({ projectId, type }, 'PDF exported successfully');
    } catch (renderErr) {
      routeLogger.error({ err: errorMessage(renderErr) }, 'PDF rendering failed');
      return res.status(500).json({ success: false, error: 'Error generando PDF: ' + errorMessage(renderErr) });
    }
  } catch (err) {
    routeLogger.error({ err: errorMessage(err) }, 'GET /export/pdf error');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        routeLogger.error({ err: errorMessage(closeErr) }, 'Error closing browser');
      }
    }
  }
});

// Helper to escape HTML content
function escapeHtmlContent(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default router;