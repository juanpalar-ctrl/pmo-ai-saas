import express from 'express';
import { orchestrator } from '../services/multiAgentOrchestrator';
import { pool } from '../db';

const router = express.Router();

router.post('/:projectId', async (req: any, res: any) => {
  try {
    const { projectId } = req.params;
    console.log(`\n🚀 Nueva solicitud de análisis para proyecto ${projectId}`);
    const result = await orchestrator.analyzeProject(parseInt(projectId));
    res.json({
      success: true,
      message: 'Análisis completado exitosamente',
      data: result,
    });
  } catch (error: any) {
    console.error('❌ Error en ruta /analysis:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
    res.json({
      success: true,
      generatedAt: result.rows[0].generatedat,
      data: result.rows[0].output,
    });
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
    const risk = data.risk?.analysis || {};
    const economic = data.economic?.analysis || {};

    // FORMATEAR RISK COMO HTML BONITO
    const riskHTML = `
      <div style="background: #fff5f7; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <h4 style="color: #d4324f; margin: 0 0 10px 0;">📊 Score de Riesgo</h4>
            <p style="font-size: 2em; font-weight: bold; color: #d4324f; margin: 0;">${risk.overallRiskScore || 'N/A'}</p>
          </div>
          <div>
            <h4 style="color: #d4324f; margin: 0 0 10px 0;">⚠️ Probabilidad de Delay</h4>
            <p style="font-size: 2em; font-weight: bold; color: #d4324f; margin: 0;">${(risk.delayProbability * 100).toFixed(1)}%</p>
          </div>
        </div>
        
        <h4 style="color: #333; margin: 20px 0 10px 0;">🎯 Top Riesgos</h4>
        ${risk.topRisks?.map((r: any) => `
          <div style="background: white; padding: 12px; border-left: 4px solid #d4324f; margin: 10px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #333;">${r.description}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9em;">Probabilidad: ${(r.probability * 100).toFixed(0)}%</p>
          </div>
        `).join('') || '<p>Sin riesgos identificados</p>'}
      </div>
    `;

    // FORMATEAR ECONOMIC COMO HTML BONITO
    const economicHTML = `
      <div style="background: #e6f7ff; padding: 20px; border-radius: 8px; margin: 15px 0;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
          <div style="background: white; padding: 15px; border-radius: 4px;">
            <h4 style="color: #0066cc; margin: 0 0 10px 0;">💰 Budget Status</h4>
            <p style="font-size: 1.5em; font-weight: bold; color: #0066cc; margin: 0;">${economic.budget_status || 'N/A'}</p>
          </div>
          <div style="background: white; padding: 15px; border-radius: 4px;">
            <h4 style="color: #0066cc; margin: 0 0 10px 0;">📈 Worst Case</h4>
            <p style="font-size: 1.5em; font-weight: bold; color: #0066cc; margin: 0;">$${(economic.worst_case_total_cost || 0).toLocaleString()}</p>
          </div>
          <div style="background: white; padding: 15px; border-radius: 4px;">
            <h4 style="color: #0066cc; margin: 0 0 10px 0;">📉 Costo del Delay</h4>
            <p style="font-size: 1.5em; font-weight: bold; color: #0066cc; margin: 0;">$${(economic.cost_of_delay || 0).toLocaleString()}</p>
          </div>
        </div>

        <h4 style="color: #333; margin: 20px 0 10px 0;">💡 Recomendaciones</h4>
        ${economic.recommendations?.slice(0, 3).map((r: any) => `
          <div style="background: white; padding: 12px; border-left: 4px solid #0066cc; margin: 10px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #333;">[${r.priority}] ${r.action}</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9em;">${r.expectedImpact || ''}</p>
          </div>
        `).join('') || '<p>Sin recomendaciones</p>'}
      </div>
    `;

    // REPORTES PROFESIONALES
    const seniorReport = `
      <h4 style="color: #333; margin: 0 0 10px 0;">🎯 Estado Actual</h4>
      <p>El proyecto presenta <strong style="color: #d4324f;">${risk.overallRiskScore}</strong> con probabilidad de delay del <strong>${(risk.delayProbability * 100).toFixed(1)}%</strong>. El estado del presupuesto es <strong style="color: #0066cc;">${economic.budget_status}</strong>.</p>
      
      <h4 style="color: #333; margin: 20px 0 10px 0;">⚠️ Riesgos Críticos</h4>
      <ul style="color: #666;">
        ${risk.topRisks?.slice(0, 3).map((r: any) => `<li>${r.description}</li>`).join('') || '<li>Sin riesgos críticos</li>'}
      </ul>
      
      <h4 style="color: #333; margin: 20px 0 10px 0;">💰 Impacto Financiero</h4>
      <p>Presupuesto en riesgo: <strong>$${(economic.worst_case_total_cost || 0).toLocaleString()}</strong> en peor escenario. Costo estimado del delay: <strong>$${(economic.cost_of_delay || 0).toLocaleString()}</strong>.</p>
      
      <h4 style="color: #333; margin: 20px 0 10px 0;">✅ Próximos Pasos</h4>
      <ol style="color: #666;">
        <li>Ejecutar plan de mitigación de riesgos esta semana</li>
        <li>Revisar capacidad del equipo vs trabajo pendiente</li>
        <li>Escalación a stakeholders si es necesario</li>
      </ol>
    `;

    const technicalReport = `
      <h4 style="color: #333; margin: 0 0 10px 0;">🔍 Análisis Técnico</h4>
      <p>Risk Score: <strong style="color: #d4324f;">${risk.overallRiskScore}</strong> | Delay Probability: <strong>${(risk.delayProbability * 100).toFixed(1)}%</strong></p>
      
      <h4 style="color: #333; margin: 20px 0 10px 0;">⚠️ Blockers Identificados</h4>
      <ul style="color: #666;">
        ${risk.topRisks?.slice(0, 5).map((r: any) => `<li><strong>${r.description}</strong> - ${(r.probability * 100).toFixed(0)}% probabilidad</li>`).join('') || '<li>Sin blockers identificados</li>'}
      </ul>
      
      <h4 style="color: #333; margin: 20px 0 10px 0;">📊 Métricas</h4>
      <p>Daily Burn Rate: <strong>$${economic.daily_burn_rate?.toFixed(2) || 'N/A'}</strong> | Monthly Cost: <strong>$${economic.monthly_resource_cost?.toLocaleString() || 'N/A'}</strong></p>
      
      <h4 style="color: #333; margin: 20px 0 10px 0;">🛠️ Recomendaciones Técnicas</h4>
      <ol style="color: #666;">
        <li>Code review intensivo de componentes críticos</li>
        <li>Testing automation para regression risk</li>
        <li>Documentación de arquitectura decisions</li>
        <li>Pair programming para knowledge sharing</li>
      </ol>
    `;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Análisis Proyecto ${projectId}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', sans-serif; 
      margin: 0; 
      padding: 20px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 { margin: 0; color: #333; font-size: 2.5em; border-bottom: 3px solid #667eea; padding-bottom: 15px; }
    .section { 
      background: white; 
      padding: 25px; 
      margin: 20px 0; 
      border-radius: 8px; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h2 { 
      color: white;
      margin: 0 -25px 20px -25px;
      padding: 15px 25px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px 8px 0 0;
    }
    .risk h2 { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .economic h2 { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .report h2 { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
    .report-content { background: #f9f9f9; padding: 20px; border-radius: 4px; margin: 15px 0; line-height: 1.8; }
    h3 { color: #667eea; margin-top: 25px; font-size: 1.2em; }
    .footer { text-align: center; color: white; margin-top: 40px; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Análisis Multi-Agente IA</h1>
      <p style="color: #666; margin: 10px 0 0 0;">Proyecto ID: <strong>${projectId}</strong></p>
    </div>
    
    <div class="section risk">
      <h2>🎯 Análisis de Riesgos</h2>
      ${riskHTML}
    </div>
    
    <div class="section economic">
      <h2>💰 Análisis Económico</h2>
      ${economicHTML}
    </div>
    
    <div class="section report">
      <h2>📄 Reportes Ejecutivos</h2>
      
      <h3>👔 Senior Report (para CTO/CFO/Sponsor)</h3>
      <div class="report-content">
        ${seniorReport}
      </div>
      
      <h3>🔧 Technical Report (para Tech Lead)</h3>
      <div class="report-content">
        ${technicalReport}
      </div>
    </div>
    
    <div class="footer">
      <p>Análisis generado por PMO SaaS AI System</p>
      <p style="font-size: 0.9em;">Generado: ${result.rows[0].generatedat}</p>
    </div>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error: any) {
    console.error('Error en /view:', error);
    res.status(500).send(`<h1>Error: ${error.message}</h1>`);
  }
});

export default router;