import express from 'express';
import { orchestrator } from '../services/multiAgentOrchestrator';
import { pool } from '../db';

const router = express.Router();

router.post('/:projectId', async (req: any, res: any) => {
  try {
    const { projectId } = req.params;
    const { framework } = req.body;
    const result = await orchestrator.analyzeProject(parseInt(projectId), framework || 'scrum');
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:projectId/latest', async (req: any, res: any) => {
  try {
    const { projectId } = req.params;
    const result = await pool.query(
      `SELECT output, generatedat FROM ai_analyses WHERE projectid = $1 ORDER BY generatedat DESC LIMIT 1`,
      [parseInt(projectId)]
    );
    
    if (!result.rows[0]) {
      return res.json({ success: false, message: 'No hay análisis' });
    }
    
    res.json({ success: true, generatedAt: result.rows[0].generatedat, data: result.rows[0].output });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:projectId/view', async (req: any, res: any) => {
  try {
    const { projectId } = req.params;
    const result = await pool.query(
      `SELECT output, generatedat FROM ai_analyses WHERE projectid = $1 ORDER BY generatedat DESC LIMIT 1`,
      [parseInt(projectId)]
    );
    
    if (!result.rows[0]) {
      return res.send(`<h1>No hay análisis</h1>`);
    }
    
    const data = result.rows[0].output;
    const risk = data.risk?.analysis?.analysis || {};
    const economic = data.economic?.analysis?.analysis || {};
    const reports = data.reports || {};

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Análisis</title>
  <style>
    body { font-family: Arial; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
    .section { background: white; padding: 25px; margin: 20px 0; border-radius: 8px; }
    h2 { color: white; background: #667eea; padding: 15px; margin: -25px -25px 20px -25px; border-radius: 8px 8px 0 0; }
    .risk h2 { background: #f5576c; }
    .economic h2 { background: #00f2fe; }
    .report h2 { background: #43e97b; }
    h3 { color: #333; margin-top: 20px; }
    .item { background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Análisis Multi-Agente - Proyecto ${projectId}</h1>
    </div>
    
    <div class="section risk">
      <h2>🎯 Análisis de Riesgos</h2>
      <p><strong>Score:</strong> ${risk.overallRiskScore || 'N/A'}</p>
      <p><strong>Delay Probability:</strong> ${((risk.delayProbability || 0) * 100).toFixed(1)}%</p>
      
      <h3>Top Riesgos</h3>
      ${risk.topRisks?.slice(0, 5).map((r: any) => `
        <div class="item">
          <strong>${r.title || r.description}</strong>
          <p>${r.description || ''}</p>
          <small>Probabilidad: ${((r.probability || 0) * 100).toFixed(0)}%</small>
        </div>
      `).join('') || '<p>Sin riesgos</p>'}
    </div>
    
    <div class="section economic">
      <h2>💰 Análisis Económico</h2>
      <p><strong>Budget Status:</strong> ${economic.budget_status || 'N/A'}</p>
      <p><strong>Worst Case Total:</strong> $${(economic.worst_case_total_cost || 0).toLocaleString()}</p>
      <p><strong>Cost of Delay:</strong> $${(economic.cost_of_delay || 0).toLocaleString()}</p>
      <p><strong>Daily Burn Rate:</strong> $${(economic.daily_burn_rate || 0).toLocaleString()}</p>
    </div>
    
    <div class="section report">
      <h2>📄 Reportes</h2>
      
      <h3>Senior Report</h3>
      <div class="item">${(reports.senior_report || 'No disponible').replace(/\n/g, '<br>')}</div>
      
      <h3>Technical Report</h3>
      <div class="item">${(reports.technical_report || 'No disponible').replace(/\n/g, '<br>')}</div>
    </div>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error: any) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

export default router;
