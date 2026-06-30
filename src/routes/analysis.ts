import express, { Request, Response } from 'express';
import { orchestrator } from '../services/multiAgentOrchestrator';
import { pool } from '../db';
import { generateMockAnalysis, isMockEnabled, getCacheDurationHours } from '../utils/mockAnalysis';
import { ProjectIdParamSchema, AnalysisBodySchema, OrgQuerySchema } from '../config/validation';
import { routeLogger } from '../core/logger';

const router = express.Router();

// Función para verificar si análisis es válido en cache
async function getCachedAnalysis(projectId: number) {
  const cacheHours = getCacheDurationHours();
  const result = await pool.query(
    `SELECT output, generatedat FROM ai_analyses
     WHERE projectid = $1
     AND generatedat > NOW() - ($2 * INTERVAL '1 hour')
     ORDER BY generatedat DESC LIMIT 1`,
    [projectId, cacheHours]
  );
  return result.rows[0] || null;
}

router.post('/:projectId', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ success: false, error: 'projectId inválido' });
    const projectId = params.data.projectId;

    const body = AnalysisBodySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ success: false, error: body.error.flatten() });
    const { framework: fw, forceRefresh } = body.data;

    // Si USE_MOCK_DATA está activado, devolver mock sin llamar API
    if (isMockEnabled() && !forceRefresh) {
      const mockData = generateMockAnalysis(fw);
      
      // Guardar en BD para mantener consistencia
      await pool.query(
        `INSERT INTO ai_analyses (projectid, output) VALUES ($1, $2)
         ON CONFLICT (projectid) DO UPDATE SET output = $2, generatedat = NOW()`,
        [projectId, mockData]
      );
      
      return res.json({ 
        success: true, 
        data: mockData,
        cached: false,
        usedMock: true,
        message: '✅ Mock data (testing mode) - No API credits spent'
      });
    }

    // Verificar cache (24h por defecto)
    const cached = await getCachedAnalysis(projectId);
    if (cached && !forceRefresh) {
      return res.json({ 
        success: true, 
        data: cached.output,
        cached: true,
        cachedAt: cached.generatedat,
        message: '📦 Cached analysis - No API credits spent'
      });
    }

    // Si llegamos aquí, ejecutar análisis real (gasta API credits)
    const result = await orchestrator.analyzeProject(projectId, fw);
    
    return res.json({ 
      success: true, 
      data: result,
      cached: false,
      usedMock: false,
      message: '✨ Fresh analysis - API credits spent'
    });
    
  } catch (error: any) {
    routeLogger.error({ err: error.message }, "route error"); res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
});

router.get('/:projectId/latest', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ success: false, error: 'projectId inválido' });
    const projectId = params.data.projectId;
    const result = await pool.query(
      `SELECT output, generatedat FROM ai_analyses WHERE projectid = $1 ORDER BY generatedat DESC LIMIT 1`,
      [projectId]
    );
    
    if (!result.rows[0]) {
      return res.json({ success: false, message: 'No hay análisis' });
    }
    
    res.json({ success: true, generatedAt: result.rows[0].generatedat, data: result.rows[0].output });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, "route error"); res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

router.get('/:projectId/view', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ success: false, error: 'projectId inválido' });
    const projectId = params.data.projectId;

    const query = OrgQuerySchema.safeParse(req.query);
    const org = escapeHtml(query.success ? query.data.org : 'Sin especificar');

    const result = await pool.query(
      `SELECT output, generatedat FROM ai_analyses WHERE projectid = $1 ORDER BY generatedat DESC LIMIT 1`,
      [projectId]
    );
    
    if (!result.rows[0]) {
      return res.send(`<h1>No hay análisis</h1>`);
    }
    
    const data = result.rows[0].output;
    const risk = data.risk?.analysis?.analysis || {};
    const economic = data.economic?.analysis?.analysis || {};
    const reports = data.reports || {};

    const riskItems = (risk.topRisks || []).map((r: any) => `
      <div class="item">
        <strong>${escapeHtml(String(r.title || r.description || ''))}</strong>
        <p>${escapeHtml(String(r.description || ''))}</p>
        <small>Probabilidad: ${((r.probability || 0) * 100).toFixed(0)}% | Impacto: ${escapeHtml(String(r.impact || 'N/A'))}</small>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Análisis - PMO SaaS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .header h1 { color: #333; font-size: 2.5em; border-bottom: 3px solid #667eea; padding-bottom: 15px; margin-bottom: 10px; }
    .header-info { color: #666; font-size: 1.1em; }
    .section { background: white; padding: 25px; margin: 20px 0; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    h2 { color: white; margin: 0 -25px 20px -25px; padding: 15px 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0; }
    .risk h2 { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .economic h2 { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .report h2 { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
    .metric { display: inline-block; margin: 15px 20px 15px 0; }
    .metric-label { color: #666; font-size: 0.9em; }
    .metric-value { font-size: 2.2em; font-weight: bold; color: #667eea; }
    .item { background: #f9f9f9; padding: 15px; border-left: 4px solid #667eea; margin: 10px 0; border-radius: 4px; }
    h3 { color: #667eea; margin-top: 25px; margin-bottom: 15px; font-size: 1.3em; }
    .report-content { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 15px 0; line-height: 1.8; white-space: pre-wrap; border-left: 4px solid #667eea; }
    .back-btn { display: inline-block; margin-bottom: 20px; padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .back-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4); }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-btn">← Nuevo Análisis</a>
    
    <div class="header">
      <h1>📊 Análisis Multi-Agente IA</h1>
      <div class="header-info">
        <p><strong>Organización:</strong> ${org}</p>
        <p><strong>Proyecto ID:</strong> ${projectId}</p>
        <p><strong>Generado:</strong> ${new Date(result.rows[0].generatedat).toLocaleString('es-CO')}</p>
      </div>
    </div>
    
    <div class="section risk">
      <h2>🎯 Análisis de Riesgos</h2>
      <div class="metric">
        <div class="metric-label">Score de Riesgo</div>
        <div class="metric-value">${risk.overallRiskScore || 'N/A'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Probabilidad de Delay</div>
        <div class="metric-value">${((risk.delayProbability || 0) * 100).toFixed(1)}%</div>
      </div>
      
      <h3>Top Riesgos Identificados</h3>
      ${riskItems || '<p>Sin riesgos identificados</p>'}
    </div>
    
    <div class="section economic">
      <h2>💰 Análisis Económico</h2>
      <div class="metric">
        <div class="metric-label">Estado del Budget</div>
        <div class="metric-value" style="color: #0066cc; font-size: 1.5em;">${economic.budget_status || 'N/A'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Peor Caso</div>
        <div class="metric-value" style="color: #0066cc;">$${(economic.worst_case_total_cost || 0).toLocaleString()}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Costo del Delay</div>
        <div class="metric-value" style="color: #0066cc;">$${(economic.cost_of_delay || 0).toLocaleString()}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Daily Burn Rate</div>
        <div class="metric-value" style="color: #0066cc;">$${(economic.daily_burn_rate || 0).toLocaleString()}</div>
      </div>
    </div>
    
    <div class="section report">
      <h2>📄 Reportes Ejecutivos</h2>
      
      <h3>👔 Senior Report</h3>
      <div class="report-content">${escapeHtml(reports.senior_report || 'No disponible').replace(/\n/g, '<br>')}</div>

      <h3>🔧 Technical Report</h3>
      <div class="report-content">${escapeHtml(reports.technical_report || 'No disponible').replace(/\n/g, '<br>')}</div>
    </div>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error: any) {
    routeLogger.error({ err: error.message }, '[analysis/view] Error');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

export default router;
