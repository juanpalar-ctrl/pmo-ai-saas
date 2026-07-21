import express, { Request, Response } from 'express';
import { errorMessage } from '../core/errors';
import multer from 'multer';
import * as path from 'path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
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

// GET /api/data/export/report
// Return printable HTML report (user prints to PDF via browser)
router.get('/export/report', async (req: Request, res: Response) => {
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
      return res.status(404).send('Proyecto no encontrado');
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
      return res.status(404).send('No hay análisis');
    }

    const { output } = analysisResult.rows[0];
    let reportContent = type === 'senior'
      ? output.reports?.senior_report
      : output.reports?.technical_report;

    if (!reportContent) {
      return res.status(404).send('Reporte no disponible');
    }

    // Parse markdown to HTML
    const htmlContent = await marked(reportContent);

    // Sanitize HTML to prevent XSS
    const sanitizedContent = sanitizeHtml(htmlContent, {
      allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'code', 'pre', 'hr', 'a'],
      allowedAttributes: { 'a': ['href'] }
    });

    const reportType = type === 'senior' ? 'Ejecutivo' : 'Técnico';
    const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

    // Return HTML that browser will print to PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LARA - ${projectname} - ${reportType}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            color: #1f2937;
            line-height: 1.7;
            background: white;
          }
          body {
            padding: 20px;
          }

          /* Screen-only styles */
          .screen-only {
            display: block;
            background: #f0fdfb;
            border: 1px solid #86efac;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
            color: #047857;
            font-weight: 500;
          }

          /* Header */
          .header {
            border-bottom: 3px solid #17B8A0;
            padding: 24px 0 20px 0;
            margin-bottom: 32px;
            page-break-after: avoid;
          }
          .logo {
            font-size: 24px;
            font-weight: 900;
            color: #0B7B8C;
            margin-bottom: 8px;
          }
          .meta {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.5;
          }
          .meta strong {
            color: #0B7B8C;
            display: block;
            margin-bottom: 4px;
          }

          /* Content */
          .content {
            font-size: 14px;
            line-height: 1.8;
          }

          /* Headings */
          h1 {
            color: #0B7B8C;
            font-size: 2em;
            margin: 32px 0 16px 0;
            page-break-after: avoid;
            font-weight: 700;
          }
          h2 {
            color: #0B7B8C;
            font-size: 1.5em;
            margin: 28px 0 14px 0;
            border-bottom: 2px solid #d6e9eb;
            padding-bottom: 10px;
            page-break-after: avoid;
            font-weight: 700;
          }
          h3 {
            color: #0B7B8C;
            font-size: 1.2em;
            margin: 20px 0 10px 0;
            page-break-after: avoid;
            font-weight: 600;
          }
          h4 {
            color: #1f2937;
            font-size: 1.05em;
            margin: 16px 0 8px 0;
            font-weight: 600;
          }

          /* Paragraphs and spacing */
          p {
            margin-bottom: 14px;
            widows: 2;
            orphans: 2;
          }

          /* Lists */
          ul, ol {
            margin: 16px 0 16px 32px;
          }
          li {
            margin-bottom: 8px;
            line-height: 1.7;
          }

          /* Tables */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
            page-break-inside: avoid;
            font-size: 13px;
          }
          th, td {
            border: 1px solid #d6e9eb;
            padding: 12px;
            text-align: left;
          }
          th {
            background: #e6f4f5;
            color: #0B7B8C;
            font-weight: 600;
          }
          tr:nth-child(even) td {
            background: #f9fcfd;
          }

          /* Code and blocks */
          code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #0B7B8C;
          }
          pre {
            background: #f3f4f6;
            padding: 14px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 16px 0;
            font-size: 0.9em;
            line-height: 1.5;
            border-left: 3px solid #17B8A0;
            page-break-inside: avoid;
          }
          pre code {
            background: none;
            padding: 0;
            color: #1f2937;
          }

          /* Blockquotes */
          blockquote {
            border-left: 4px solid #17B8A0;
            background: #f0f9fa;
            padding: 14px 16px;
            margin: 18px 0;
            color: #0B7B8C;
            font-style: italic;
            page-break-inside: avoid;
          }

          /* Horizontal rule */
          hr {
            border: none;
            border-top: 1px solid #d6e9eb;
            margin: 28px 0;
            page-break-after: avoid;
          }

          /* Emphasis */
          strong {
            color: #0B7B8C;
            font-weight: 600;
          }
          em {
            font-style: italic;
            color: #374151;
          }

          /* Links */
          a {
            color: #17B8A0;
            text-decoration: none;
            border-bottom: 1px dotted #17B8A0;
          }

          /* Print styles */
          @media print {
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
            }
            body {
              padding: 0.5in;
              font-size: 11pt;
            }
            .screen-only {
              display: none;
            }
            .content {
              font-size: 11pt;
            }
            h1 { font-size: 18pt; margin: 20pt 0 10pt 0; }
            h2 { font-size: 14pt; margin: 18pt 0 10pt 0; }
            h3 { font-size: 12pt; margin: 14pt 0 8pt 0; }
            p { margin-bottom: 10pt; }
            table { font-size: 10pt; }
            th, td { padding: 8pt; }
            pre { font-size: 9pt; }
            a {
              color: #0B7B8C;
              text-decoration: none;
            }
            a[href]::after {
              content: "";
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">⬡ LARA</div>
          <div class="meta">
            <strong>${projectname}</strong>
            <span>Reporte ${reportType} — ${today}</span>
          </div>
        </div>
        <div class="screen-only">
          📄 <strong>Para guardar como PDF:</strong> Presiona Ctrl+P (Cmd+P en Mac) → "Guardar como PDF"
        </div>
        <div class="content">
          ${sanitizedContent}
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);

    routeLogger.info({ projectId, type }, 'Report HTML sent successfully');
  } catch (err) {
    routeLogger.error({ err: errorMessage(err) }, 'GET /export/report error');
    res.status(500).send('Error generando reporte');
  }
});

export default router;