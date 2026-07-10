import { riskAgent } from '../agents/riskAgent';
import { economicAgent } from '../agents/economicAgent';
import { reportingAgent } from '../agents/reportingAgent';
import { pool } from '../db';
import { calculateProjectMetrics } from './metricsCalculator';
import { calculateFrameworkMetrics } from './frameworkMetrics';
import { detectWarnings } from './earlyWarning';
import { teamService } from './teamService';
import { routeLogger } from '../core/logger';

export const orchestrator = {
  async analyzeProject(projectId: number, framework: string, userId: string, org?: string, lang: 'es' | 'en' = 'es') {
    const metrics = await calculateProjectMetrics(projectId, userId, framework);

    // Resolve org from normalization record if not passed directly
    if (!org) {
      const orgResult = await pool.query(
        `SELECT output->>'org' AS org FROM ai_analyses WHERE projectid = $1 AND user_id = $2 AND agenttype = 'normalization' LIMIT 1`,
        [projectId, userId]
      );
      org = orgResult.rows[0]?.org || 'Sin especificar';
    }

    // Resolve DIS + task rows from normalization record. Fetched before the
    // risk/economic agents run (not after, as before) so task rows are
    // available to compute team disconnection alerts (Hito 5.3) and feed
    // them into the Risk Agent's input.
    let dis: any = null;
    let frameworkMetrics: any = null;
    let earlyWarningResult: any = null;
    let taskRows: any[] = [];
    const normResult = await pool.query(
      `SELECT output FROM ai_analyses WHERE projectid = $1 AND user_id = $2 AND agenttype = 'normalization' LIMIT 1`,
      [projectId, userId]
    );
    if (normResult.rows[0]?.output) {
      const normOutput = normResult.rows[0].output;
      dis = normOutput.dis || null;
      taskRows = normOutput.projects || [];
      if (taskRows.length > 0) {
        frameworkMetrics = calculateFrameworkMetrics(taskRows, framework);
        earlyWarningResult = detectWarnings(taskRows, { cpi: metrics.cpi, spi: metrics.spi });
      }
    }

    let moraleAlerts: any[] = [];
    try {
      moraleAlerts = await teamService.getDisconnectionAlertsForRiskAgent(projectId, taskRows);
    } catch (err) {
      routeLogger.error({ err }, 'Failed to compute team disconnection alerts');
    }

    const input = {
      projectId,
      projectName: metrics.projectName,
      timeline: { percentageComplete: parseFloat(metrics.percentComplete as string), daysRemaining: metrics.daysRemaining },
      budget: { total: parseFloat(metrics.pv as string), spent: parseFloat(metrics.ac as string) },
      moraleAlerts,
      lang,
    };

    riskAgent.setFramework(framework);
    economicAgent.setFramework(framework);

    // Run risk and economic agents in parallel
    const [riskAnalysis, economicAnalysis] = await Promise.all([
      riskAgent.analyze(input),
      economicAgent.analyze(input),
    ]);

    reportingAgent.setAnalysisOutputs(riskAnalysis, economicAnalysis);
    const reportingAnalysis: any = await reportingAgent.analyze(input);

    const seniorReport = reportingAnalysis.analysis?.senior_report || reportingAnalysis.senior_report || 'Reporte disponible';
    const technicalReport = reportingAnalysis.analysis?.technical_report || reportingAnalysis.technical_report || 'Reporte disponible';

    const output = {
      risk: riskAnalysis,
      economic: economicAnalysis,
      reports: {
        senior_report: seniorReport,
        technical_report: technicalReport
      },
      metrics: {
        bac: metrics.bac, pv: metrics.pv, ev: metrics.ev, ac: metrics.ac,
        cv: metrics.cv, sv: metrics.sv, cpi: metrics.cpi, spi: metrics.spi,
        eac: metrics.eac, vac: metrics.vac, tcpi: metrics.tcpi, roi: metrics.roi,
        framework, percentComplete: metrics.percentComplete
      },
      dis,
      frameworkMetrics,
      earlyWarnings: earlyWarningResult,
      timestamp: new Date().toISOString(),
      org,
      lang,
    };

    await pool.query(
      `INSERT INTO ai_analyses (projectid, user_id, agenttype, output, generatedat) VALUES ($1, $2, $3, $4, NOW())`,
      [projectId, userId, 'combined', JSON.stringify(output)]
    );

    return output;
  }
};