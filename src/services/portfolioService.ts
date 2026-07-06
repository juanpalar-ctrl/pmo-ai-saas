import { pool } from '../db';
import { routeLogger } from '../core/logger';

export interface ProjectSummary {
  id: number;
  projectId: number;
  name: string;
  org: string;
  framework: string;
  generatedAt: string;
  percentComplete: number;
  bac: number;
  ac: number;
  ev: number;
  cpi: number;
  spi: number;
  vac: number;
  eac: number;
  revenueAtStake: number;
  riskScore: string;
  budgetStatus: string;
  criticalAlerts: number;
  highAlerts: number;
  totalAlerts: number;
  alertSummary: string;
  healthScore: number;
  healthLabel: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  healthColor: 'green' | 'amber' | 'red';
}

export interface PortfolioSummary {
  totalProjects: number;
  totalBAC: number;
  totalAC: number;
  totalRevenueAtStake: number;
  criticalProjects: number;
  atRiskProjects: number;
  healthyProjects: number;
  avgCPI: string;
  avgSPI: string;
  avgProgress: string;
  totalCriticalAlerts: number;
  portfolioHealth: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
}

export interface PortfolioData {
  summary: PortfolioSummary;
  projects: ProjectSummary[];
}

// Penalty for the AI risk agent's overallRiskScore (LOW/MEDIUM/HIGH/CRITICAL).
// Without this, computeHealthScore only reflected CPI/SPI + deterministic
// early-warning alerts — a project could show green/"Saludable" in the
// portfolio grid while its own detail page flagged "Risk Score: HIGH/CRITICAL"
// in red, because the AI risk assessment (narrative risks like vendor
// dependency, team turnover) never moved CPI/SPI and never tripped an
// early-warning. Magnitudes are chosen to roughly match alertPenalty
// (criticalCount*10 / highCount*5) so one CRITICAL risk verdict moves the
// needle about as much as 2-3 critical alerts.
function riskScorePenalty(riskScore?: string): number {
  switch ((riskScore || '').toUpperCase()) {
    case 'CRITICAL': return 25;
    case 'HIGH':      return 15;
    case 'MEDIUM':    return 5;
    default:          return 0; // LOW, missing, or unrecognized
  }
}

export function computeHealthScore(
  cpi: number,
  spi: number,
  criticalCount: number,
  highCount: number,
  riskScore?: string
): { score: number; label: 'HEALTHY' | 'AT_RISK' | 'CRITICAL'; color: 'green' | 'amber' | 'red' } {
  const cpiScore    = Math.min(cpi, 1.5) / 1.5 * 40;
  const spiScore    = Math.min(spi, 1.5) / 1.5 * 30;
  const alertPenalty = criticalCount * 10 + highCount * 5 + riskScorePenalty(riskScore);
  const score       = Math.max(0, Math.min(100, Math.round(cpiScore + spiScore + 30 - alertPenalty)));
  const label       = score >= 75 ? 'HEALTHY' : score >= 50 ? 'AT_RISK' : 'CRITICAL';
  const color       = score >= 75 ? 'green'   : score >= 50 ? 'amber'   : 'red';
  return { score, label, color };
}

function mapRow(row: any): ProjectSummary {
  const out     = row.output   || {};
  const metrics = out.metrics  || {};
  const risk    = out.risk?.analysis?.analysis    || {};
  const economic = out.economic?.analysis?.analysis || {};
  const ew      = out.earlyWarnings || {};

  const bac = parseFloat(metrics.bac || metrics.pv || 0);
  const ac  = parseFloat(metrics.ac  || 0);
  const ev  = parseFloat(metrics.ev  || 0);
  const cpi = parseFloat(metrics.cpi || 1);
  const spi = parseFloat(metrics.spi || 1);
  const vac = parseFloat(metrics.vac || 0);
  const eac = parseFloat(metrics.eac || bac);
  const percentComplete = parseFloat(metrics.percentComplete || 0);

  const { score: healthScore, label: healthLabel, color: healthColor } =
    computeHealthScore(cpi, spi, ew.criticalCount || 0, ew.highCount || 0, risk.overallRiskScore);

  return {
    id:             row.id,
    projectId:      row.projectid,
    name:           row.projectname,
    org:            out.org || 'Sin especificar',
    framework:      metrics.framework || 'unknown',
    generatedAt:    row.generatedat,
    percentComplete,
    bac, ac, ev, cpi, spi, vac, eac,
    revenueAtStake: vac < 0 ? Math.abs(vac) : 0,
    riskScore:      risk.overallRiskScore  || 'N/A',
    budgetStatus:   economic.budget_status || 'N/A',
    criticalAlerts: ew.criticalCount       || 0,
    highAlerts:     ew.highCount           || 0,
    totalAlerts:    ew.warnings?.length    || 0,
    alertSummary:   ew.summary             || '',
    healthScore,
    healthLabel,
    healthColor,
  };
}

function aggregateSummary(projects: ProjectSummary[]): PortfolioSummary {
  const n = projects.length;
  const criticalProjects = projects.filter(p => p.healthLabel === 'CRITICAL').length;
  const atRiskProjects   = projects.filter(p => p.healthLabel === 'AT_RISK').length;
  const healthyProjects  = projects.filter(p => p.healthLabel === 'HEALTHY').length;

  const sum = (key: keyof ProjectSummary) =>
    projects.reduce((s, p) => s + (p[key] as number), 0);

  return {
    totalProjects:       n,
    totalBAC:            sum('bac'),
    totalAC:             sum('ac'),
    totalRevenueAtStake: sum('revenueAtStake'),
    criticalProjects,
    atRiskProjects,
    healthyProjects,
    avgCPI:     (n > 0 ? sum('cpi') / n : 1).toFixed(2),
    avgSPI:     (n > 0 ? sum('spi') / n : 1).toFixed(2),
    avgProgress:(n > 0 ? sum('percentComplete') / n : 0).toFixed(1),
    totalCriticalAlerts: sum('criticalAlerts'),
    portfolioHealth: criticalProjects > 0 ? 'CRITICAL'
      : atRiskProjects > 0              ? 'AT_RISK'
      : 'HEALTHY',
  };
}

export async function getPortfolioData(userId: string): Promise<PortfolioData> {
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
      AND pd.user_id = $1
      AND aa.id IN (
        SELECT MAX(id) FROM ai_analyses WHERE agenttype = 'combined' GROUP BY projectid
      )
    ORDER BY aa.generatedat DESC
    LIMIT 50
  `, [userId]);

  const projects = result.rows.map(mapRow);
  const summary  = aggregateSummary(projects);

  routeLogger.info({ totalProjects: projects.length }, 'Portfolio data fetched');

  return { summary, projects };
}
