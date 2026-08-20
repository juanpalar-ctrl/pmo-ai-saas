import { riskAgent } from '../agents/riskAgent';
import { economicAgent } from '../agents/economicAgent';
import { reportingAgent } from '../agents/reportingAgent';
import { pool } from '../db';
import { calculateProjectMetrics } from './metricsCalculator';
import { calculateFrameworkMetrics } from './frameworkMetrics';
import { detectWarnings } from './earlyWarning';
import { teamService } from './teamService';
import { detectResourceConflicts } from './resourceConflictDetector';
import { syncRisksFromAgent } from './riskSyncService';
import { routeLogger } from '../core/logger';

/**
 * Fetch SOW content for a project if it exists and is enabled for analysis
 */
async function getProjectSOW(projectId: string | number): Promise<{ content: string; fileName: string } | null> {
  try {
    const result = await pool.query(
      `SELECT c.extracted_text, d.filename
       FROM sow_content c
       INNER JOIN sow_documents d ON c.sow_document_id = d.id
       WHERE c.project_id = $1 AND d.use_in_analysis = true AND c.extraction_status = 'success'
       LIMIT 1`,
      [projectId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      content: result.rows[0].extracted_text,
      fileName: result.rows[0].filename
    };
  } catch (error) {
    routeLogger.warn({ err: error, projectId }, 'Failed to fetch SOW');
    return null;
  }
}

/**
 * Enrich analysis input with SOW content if available
 */
function enrichInputWithSOW(input: any, sowData: { content: string; fileName: string } | null): void {
  if (sowData) {
    // Truncate to 3000 characters to stay within token budget
    const truncatedContent = sowData.content.substring(0, 3000);
    input.sowContent = truncatedContent;
    input.sowFileName = sowData.fileName;
    input.sowTruncated = sowData.content.length > 3000;
  } else {
    input.sowContent = null;
    input.sowWarning = '⚠️ SOW no disponible: El análisis puede estar limitado en precisión respecto a duración, presupuesto y requisitos oficiales.';
  }
}

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
      moraleAlerts = await teamService.getDisconnectionAlertsForRiskAgent(projectId, userId, taskRows);
    } catch (err) {
      routeLogger.error({ err }, 'Failed to compute team disconnection alerts');
    }

    // Fetch resource allocation conflicts if available (Hito 6)
    let resourceAlerts: any = null;
    try {
      const conflictReport = await detectResourceConflicts(projectId, userId);
      if (conflictReport.conflicts.length > 0 || conflictReport.bottlenecks.length > 0) {
        resourceAlerts = {
          overbooked: conflictReport.conflicts,
          bottlenecks: conflictReport.bottlenecks,
          sharedDependencies: conflictReport.cross_project_dependencies
        };
      }
    } catch (err) {
      routeLogger.error({ err }, 'Failed to compute resource allocation conflicts');
    }

    // Fetch SOW if available
    const sowData = await getProjectSOW(projectId);

    const input = {
      projectId,
      projectName: metrics.projectName,
      timeline: { percentageComplete: parseFloat(metrics.percentComplete as string), daysRemaining: metrics.daysRemaining },
      budget: { total: parseFloat(metrics.pv as string), spent: parseFloat(metrics.ac as string) },
      moraleAlerts,
      resourceAlerts,
      lang,
    };

    // Enrich input with SOW content if available
    enrichInputWithSOW(input, sowData);

    riskAgent.setFramework(framework);
    economicAgent.setFramework(framework);

    // Run risk and economic agents in parallel
    const [riskAnalysis, economicAnalysis] = await Promise.all([
      riskAgent.analyze(input),
      economicAgent.analyze(input),
    ]);

    await syncRisksFromAgent(projectId, riskAnalysis.analysis?.analysis?.topRisks);

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