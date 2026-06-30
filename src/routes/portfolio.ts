import express, { Request, Response } from 'express';
import { pool } from '../db';

const router = express.Router();

// GET /api/portfolio — consolidated view of all projects for C-Level
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        pd.id,
        pd.projectid,
        pd.projectname,
        aa.output,
        aa.generatedat
      FROM project_data pd
      INNER JOIN ai_analyses aa ON aa.projectid = pd.projectid
      WHERE aa.agenttype = 'combined'
        AND aa.id IN (
          SELECT MAX(id) FROM ai_analyses WHERE agenttype = 'combined' GROUP BY projectid
        )
      ORDER BY aa.generatedat DESC
      LIMIT 50
    `);

    const projects = result.rows.map(row => {
      const out = row.output || {};
      const metrics = out.metrics || {};
      const risk = out.risk?.analysis?.analysis || {};
      const economic = out.economic?.analysis?.analysis || {};
      const ew = out.earlyWarnings || {};

      const bac = parseFloat(metrics.bac || metrics.pv || 0);
      const ac = parseFloat(metrics.ac || 0);
      const ev = parseFloat(metrics.ev || 0);
      const cpi = parseFloat(metrics.cpi || 1);
      const spi = parseFloat(metrics.spi || 1);
      const vac = parseFloat(metrics.vac || 0);
      const eac = parseFloat(metrics.eac || bac);
      const percentComplete = parseFloat(metrics.percentComplete || 0);

      // Health score 0-100: weighted average of CPI, SPI, progress, alerts
      const cpiScore = Math.min(cpi, 1.5) / 1.5 * 40;
      const spiScore = Math.min(spi, 1.5) / 1.5 * 30;
      const alertPenalty = (ew.criticalCount || 0) * 10 + (ew.highCount || 0) * 5;
      const healthScore = Math.max(0, Math.min(100, Math.round(cpiScore + spiScore + 30 - alertPenalty)));

      const healthLabel = healthScore >= 75 ? 'HEALTHY' : healthScore >= 50 ? 'AT_RISK' : 'CRITICAL';
      const healthColor = healthScore >= 75 ? 'green' : healthScore >= 50 ? 'amber' : 'red';

      return {
        id: row.id,
        projectId: row.projectid,
        name: row.projectname,
        org: out.org || 'Sin especificar',
        framework: metrics.framework || 'unknown',
        generatedAt: row.generatedat,
        percentComplete,
        bac,
        ac,
        ev,
        cpi,
        spi,
        vac,
        eac,
        revenueAtStake: vac < 0 ? Math.abs(vac) : 0,
        riskScore: risk.overallRiskScore || 'N/A',
        budgetStatus: economic.budget_status || 'N/A',
        criticalAlerts: ew.criticalCount || 0,
        highAlerts: ew.highCount || 0,
        totalAlerts: ew.warnings?.length || 0,
        alertSummary: ew.summary || '',
        healthScore,
        healthLabel,
        healthColor,
      };
    });

    // Aggregate portfolio-level KPIs
    const totalProjects = projects.length;
    const totalBAC = projects.reduce((s, p) => s + p.bac, 0);
    const totalAC = projects.reduce((s, p) => s + p.ac, 0);
    const totalRevenueAtStake = projects.reduce((s, p) => s + p.revenueAtStake, 0);
    const criticalProjects = projects.filter(p => p.healthLabel === 'CRITICAL').length;
    const atRiskProjects = projects.filter(p => p.healthLabel === 'AT_RISK').length;
    const healthyProjects = projects.filter(p => p.healthLabel === 'HEALTHY').length;
    const avgCPI = projects.length > 0
      ? projects.reduce((s, p) => s + p.cpi, 0) / projects.length
      : 1;
    const avgSPI = projects.length > 0
      ? projects.reduce((s, p) => s + p.spi, 0) / projects.length
      : 1;
    const avgProgress = projects.length > 0
      ? projects.reduce((s, p) => s + p.percentComplete, 0) / projects.length
      : 0;
    const totalCriticalAlerts = projects.reduce((s, p) => s + p.criticalAlerts, 0);

    res.json({
      success: true,
      summary: {
        totalProjects,
        totalBAC,
        totalAC,
        totalRevenueAtStake,
        criticalProjects,
        atRiskProjects,
        healthyProjects,
        avgCPI: avgCPI.toFixed(2),
        avgSPI: avgSPI.toFixed(2),
        avgProgress: avgProgress.toFixed(1),
        totalCriticalAlerts,
        portfolioHealth: criticalProjects === 0 && atRiskProjects === 0
          ? 'HEALTHY'
          : criticalProjects > 0 ? 'CRITICAL' : 'AT_RISK',
      },
      projects,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
