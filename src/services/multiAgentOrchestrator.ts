import { riskAgent } from '../agents/riskAgent';
import { economicAgent } from '../agents/economicAgent';
import { reportingAgent } from '../agents/reportingAgent';
import { pool } from '../db';
import { calculateProjectMetrics } from './metricsCalculator';
import { calculateFrameworkMetrics } from './frameworkMetrics';
import { detectWarnings } from './earlyWarning';

export const orchestrator = {
  async analyzeProject(projectId: number, framework: string, org?: string) {
    const metrics = await calculateProjectMetrics(projectId, framework);

    // Resolve org from normalization record if not passed directly
    if (!org) {
      const orgResult = await pool.query(
        `SELECT output->>'org' AS org FROM ai_analyses WHERE projectid = $1 AND agenttype = 'normalization' LIMIT 1`,
        [projectId]
      );
      org = orgResult.rows[0]?.org || 'Sin especificar';
    }

    const input = {
      projectId,
      projectName: metrics.projectName,
      timeline: { percentageComplete: parseFloat(metrics.percentComplete as string), daysRemaining: 30 },
      budget: { total: parseFloat(metrics.pv as string), spent: parseFloat(metrics.ac as string) }
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

    // Resolve DIS + task rows from normalization record
    let dis: any = null;
    let frameworkMetrics: any = null;
    let earlyWarningResult: any = null;
    const normResult = await pool.query(
      `SELECT output FROM ai_analyses WHERE projectid = $1 AND agenttype = 'normalization' LIMIT 1`,
      [projectId]
    );
    if (normResult.rows[0]?.output) {
      const normOutput = normResult.rows[0].output;
      dis = normOutput.dis || null;
      const taskRows = normOutput.projects || [];
      if (taskRows.length > 0) {
        frameworkMetrics = calculateFrameworkMetrics(taskRows, framework);
        earlyWarningResult = detectWarnings(taskRows, { cpi: metrics.cpi, spi: metrics.spi });
      }
    }

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
    };

    await pool.query(
      `INSERT INTO ai_analyses (projectid, agenttype, output, generatedat) VALUES ($1, $2, $3, NOW())`,
      [projectId, 'combined', JSON.stringify(output)]
    );

    return output;
  }
};