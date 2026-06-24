import { riskAgent } from '../agents/riskAgent';
import { economicAgent } from '../agents/economicAgent';
import { reportingAgent } from '../agents/reportingAgent';
import { pool } from '../db';
import { calculateProjectMetrics } from './metricsCalculator';

export const orchestrator = {
  async analyzeProject(projectId: number, framework: string) {
    const metrics = await calculateProjectMetrics(projectId, framework);

    const input = {
      projectId,
      projectName: metrics.projectName,
      timeline: { percentageComplete: parseFloat(metrics.percentComplete as string), daysRemaining: 30 },
      budget: { total: parseFloat(metrics.pv as string), spent: parseFloat(metrics.ac as string) }
    };

    riskAgent.setFramework(framework);
    const riskAnalysis = await riskAgent.analyze(input);

    economicAgent.setFramework(framework);
    const economicAnalysis = await economicAgent.analyze(input);

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
        pv: metrics.pv, ev: metrics.ev, ac: metrics.ac, cv: metrics.cv, cpi: metrics.cpi, spi: metrics.spi, roi: metrics.roi,
        framework, percentComplete: metrics.percentComplete
      },
      timestamp: new Date().toISOString()
    };

    await pool.query(
      `INSERT INTO ai_analyses (projectid, agenttype, output, generatedat) VALUES ($1, $2, $3, NOW())`,
      [projectId, 'combined', JSON.stringify(output)]
    );

    return output;
  }
};