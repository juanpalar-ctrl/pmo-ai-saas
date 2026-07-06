jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { pool } from '../../db';
import { getPortfolioData, computeHealthScore } from '../../services/portfolioService';

const mockQuery = pool.query as jest.Mock;

const makeRow = (overrides: Partial<{
  cpi: number; spi: number; bac: number; ac: number; ev: number;
  criticalCount: number; highCount: number; vac: number; eac: number;
}> = {}) => {
  const cpi = overrides.cpi ?? 1;
  const spi = overrides.spi ?? 1;
  const bac = overrides.bac ?? 100000;
  const ac  = overrides.ac  ?? 90000;
  const ev  = overrides.ev  ?? 90000;
  const vac = overrides.vac ?? bac - (bac / cpi);
  const eac = overrides.eac ?? bac / cpi;
  return {
    id: 1, projectid: 1, projectname: 'Test Project', generatedat: new Date().toISOString(),
    output: {
      org: 'ACME',
      metrics: { bac: String(bac), ac: String(ac), ev: String(ev), cpi: String(cpi), spi: String(spi), vac: String(vac), eac: String(eac), percentComplete: '80', framework: 'scrum' },
      risk:     { analysis: { analysis: { overallRiskScore: 'Medium' } } },
      economic: { analysis: { analysis: { budget_status: 'On Track' } } },
      earlyWarnings: { criticalCount: overrides.criticalCount ?? 0, highCount: overrides.highCount ?? 0, warnings: [], summary: '' },
    },
  };
};

// ─── computeHealthScore ───────────────────────────────────────────────────────

describe('computeHealthScore', () => {
  it('returns HEALTHY/green for CPI=1, SPI=1, no alerts', () => {
    const { score, label, color } = computeHealthScore(1, 1, 0, 0);
    expect(score).toBeGreaterThanOrEqual(75);
    expect(label).toBe('HEALTHY');
    expect(color).toBe('green');
  });

  it('returns score=100 for CPI=1.5, SPI=1.5, no alerts', () => {
    const { score } = computeHealthScore(1.5, 1.5, 0, 0);
    expect(score).toBe(100);
  });

  it('returns CRITICAL/red for very low CPI and alerts', () => {
    const { label, color } = computeHealthScore(0.5, 0.5, 3, 2);
    expect(label).toBe('CRITICAL');
    expect(color).toBe('red');
  });

  it('returns AT_RISK/amber for mid-range metrics', () => {
    const { label, color } = computeHealthScore(0.85, 0.85, 0, 1);
    expect(label).toBe('AT_RISK');
    expect(color).toBe('amber');
  });

  it('score is always between 0 and 100', () => {
    const extreme = computeHealthScore(0.1, 0.1, 10, 10);
    expect(extreme.score).toBeGreaterThanOrEqual(0);
    expect(extreme.score).toBeLessThanOrEqual(100);
  });

  it('each critical alert penalises 10 points', () => {
    const no_alerts = computeHealthScore(1, 1, 0, 0);
    const one_crit  = computeHealthScore(1, 1, 1, 0);
    expect(no_alerts.score - one_crit.score).toBe(10);
  });

  // ─── riskScore penalty ────────────────────────────────────────────────────
  // Regression coverage for the 2026-07-06 fix: the AI risk agent's
  // overallRiskScore used to be completely ignored here, so a project could
  // show green/"Saludable" in the portfolio while its own detail page flagged
  // "Risk Score: HIGH" in red.

  it('defaults to no risk penalty when riskScore is omitted (backward compatible)', () => {
    const withoutArg = computeHealthScore(1, 1, 0, 0);
    const withLow    = computeHealthScore(1, 1, 0, 0, 'LOW');
    expect(withoutArg.score).toBe(withLow.score);
  });

  it('a HIGH AI risk verdict can pull an otherwise-healthy project out of HEALTHY', () => {
    const noRisk = computeHealthScore(1.1, 1.05, 0, 0);
    const highRisk = computeHealthScore(1.1, 1.05, 0, 0, 'HIGH');
    expect(noRisk.label).toBe('HEALTHY');
    expect(highRisk.score).toBe(noRisk.score - 15);
  });

  it('CRITICAL AI risk verdict penalises more than HIGH, which penalises more than MEDIUM', () => {
    const medium   = computeHealthScore(1, 1, 0, 0, 'MEDIUM');
    const high     = computeHealthScore(1, 1, 0, 0, 'HIGH');
    const critical = computeHealthScore(1, 1, 0, 0, 'CRITICAL');
    expect(medium.score).toBeGreaterThan(high.score);
    expect(high.score).toBeGreaterThan(critical.score);
  });

  it('is case-insensitive and treats unrecognized values like LOW (no penalty)', () => {
    const lower = computeHealthScore(1, 1, 0, 0, 'high');
    const upper = computeHealthScore(1, 1, 0, 0, 'HIGH');
    const bogus = computeHealthScore(1, 1, 0, 0, 'not-a-real-value');
    const low   = computeHealthScore(1, 1, 0, 0, 'LOW');
    expect(lower.score).toBe(upper.score);
    expect(bogus.score).toBe(low.score);
  });
});

// ─── getPortfolioData ─────────────────────────────────────────────────────────

describe('getPortfolioData', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns empty projects and HEALTHY summary when no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const data = await getPortfolioData('user_1');
    expect(data.projects).toHaveLength(0);
    expect(data.summary.totalProjects).toBe(0);
    expect(data.summary.portfolioHealth).toBe('HEALTHY');
  });

  it('maps a healthy project correctly', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeRow({ cpi: 1.1, spi: 1.05 })] });
    const data = await getPortfolioData('user_1');
    expect(data.projects[0].healthLabel).toBe('HEALTHY');
    expect(data.projects[0].name).toBe('Test Project');
    expect(data.projects[0].framework).toBe('scrum');
  });

  it('marks portfolio as CRITICAL when a project is critical', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeRow({ cpi: 0.4, spi: 0.4, criticalCount: 4 })] });
    const data = await getPortfolioData('user_1');
    expect(data.summary.portfolioHealth).toBe('CRITICAL');
    expect(data.summary.criticalProjects).toBe(1);
  });

  it('revenueAtStake is |vac| when vac < 0', async () => {
    const row = makeRow({ bac: 100000, eac: 120000, vac: -20000 });
    mockQuery.mockResolvedValueOnce({ rows: [row] });
    const data = await getPortfolioData('user_1');
    expect(data.projects[0].revenueAtStake).toBe(20000);
  });

  it('revenueAtStake is 0 when project is under budget', async () => {
    const row = makeRow({ bac: 100000, eac: 90000, vac: 10000 });
    mockQuery.mockResolvedValueOnce({ rows: [row] });
    const data = await getPortfolioData('user_1');
    expect(data.projects[0].revenueAtStake).toBe(0);
  });

  it('summary totals are sum of all projects', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeRow({ bac: 100000, ac: 80000 }), makeRow({ bac: 50000, ac: 40000 })] });
    const data = await getPortfolioData('user_1');
    expect(data.summary.totalProjects).toBe(2);
    expect(data.summary.totalBAC).toBe(150000);
    expect(data.summary.totalAC).toBe(120000);
  });

  it('propagates DB errors', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));
    await expect(getPortfolioData('user_1')).rejects.toThrow('DB connection lost');
  });

  it('a HIGH AI risk verdict downgrades healthLabel even with clean CPI/SPI and no early warnings', async () => {
    const healthyRow = makeRow({ cpi: 1.1, spi: 1.05 });
    healthyRow.output.risk.analysis.analysis.overallRiskScore = 'HIGH';
    mockQuery.mockResolvedValueOnce({ rows: [healthyRow] });

    const data = await getPortfolioData('user_1');

    expect(data.projects[0].healthLabel).not.toBe('HEALTHY');
    expect(data.projects[0].riskScore).toBe('HIGH');
  });
});
