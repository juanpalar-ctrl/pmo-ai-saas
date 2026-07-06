jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../agents/riskAgent', () => ({
  riskAgent: { setFramework: jest.fn(), analyze: jest.fn() },
}));
jest.mock('../../agents/economicAgent', () => ({
  economicAgent: { setFramework: jest.fn(), analyze: jest.fn() },
}));
jest.mock('../../agents/reportingAgent', () => ({
  reportingAgent: { setAnalysisOutputs: jest.fn(), analyze: jest.fn() },
}));
jest.mock('../../services/metricsCalculator', () => ({
  calculateProjectMetrics: jest.fn(),
}));
jest.mock('../../services/frameworkMetrics', () => ({
  calculateFrameworkMetrics: jest.fn(),
}));
jest.mock('../../services/earlyWarning', () => ({
  detectWarnings: jest.fn(),
}));

import { orchestrator } from '../../services/multiAgentOrchestrator';
import { pool } from '../../db';
import { riskAgent } from '../../agents/riskAgent';
import { economicAgent } from '../../agents/economicAgent';
import { reportingAgent } from '../../agents/reportingAgent';
import { calculateProjectMetrics } from '../../services/metricsCalculator';
import { calculateFrameworkMetrics } from '../../services/frameworkMetrics';
import { detectWarnings } from '../../services/earlyWarning';

const mockQuery = pool.query as jest.Mock;
const mockCalculateProjectMetrics = calculateProjectMetrics as jest.Mock;
const mockCalculateFrameworkMetrics = calculateFrameworkMetrics as jest.Mock;
const mockDetectWarnings = detectWarnings as jest.Mock;
const mockRiskAnalyze = riskAgent.analyze as jest.Mock;
const mockEconomicAnalyze = economicAgent.analyze as jest.Mock;
const mockReportingAnalyze = reportingAgent.analyze as jest.Mock;

const baseMetrics = {
  projectName: 'Proyecto X',
  percentComplete: '50',
  pv: '10000',
  ac: '4000',
  bac: '10000', ev: '5000', cv: '1000', sv: '-500',
  cpi: '1.25', spi: '0.9', eac: '8000', vac: '2000', tcpi: '1.1', roi: '15',
};

describe('orchestrator.analyzeProject', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockCalculateProjectMetrics.mockReset();
    mockCalculateFrameworkMetrics.mockReset();
    mockDetectWarnings.mockReset();
    mockRiskAnalyze.mockReset();
    mockEconomicAnalyze.mockReset();
    mockReportingAnalyze.mockReset();

    mockCalculateProjectMetrics.mockResolvedValue(baseMetrics);
    mockRiskAnalyze.mockResolvedValue({ analysis: { analysis: { overallRiskScore: 'MEDIUM' } } });
    mockEconomicAnalyze.mockResolvedValue({ analysis: { analysis: { budget_status: 'ON_TRACK' } } });
    mockReportingAnalyze.mockResolvedValue({ analysis: { senior_report: 'Senior text', technical_report: 'Tech text' } });
  });

  it('resolves org from the normalization record when not passed explicitly', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ org: 'Acme Corp' }] }) // org lookup
      .mockResolvedValueOnce({ rows: [] }) // normalization record lookup
      .mockResolvedValueOnce({ rows: [] }); // insert combined analysis

    const result = await orchestrator.analyzeProject(1, 'scrum');

    expect(result.org).toBe('Acme Corp');
  });

  it('defaults org to "Sin especificar" when no normalization record exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await orchestrator.analyzeProject(1, 'scrum');

    expect(result.org).toBe('Sin especificar');
  });

  it('skips the org lookup query when org is passed explicitly', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // normalization record lookup
      .mockResolvedValueOnce({ rows: [] }); // insert combined analysis

    await orchestrator.analyzeProject(1, 'scrum', 'Explicit Org');

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('sets the framework on both risk and economic agents before analyzing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await orchestrator.analyzeProject(1, 'kanban', 'Org');

    expect(riskAgent.setFramework).toHaveBeenCalledWith('kanban');
    expect(economicAgent.setFramework).toHaveBeenCalledWith('kanban');
  });

  it('passes risk and economic outputs into the reporting agent', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await orchestrator.analyzeProject(1, 'scrum', 'Org');

    expect(reportingAgent.setAnalysisOutputs).toHaveBeenCalledWith(
      { analysis: { analysis: { overallRiskScore: 'MEDIUM' } } },
      { analysis: { analysis: { budget_status: 'ON_TRACK' } } },
    );
  });

  it('reads senior/technical reports from analysis.* when present', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await orchestrator.analyzeProject(1, 'scrum', 'Org');

    expect(result.reports.senior_report).toBe('Senior text');
    expect(result.reports.technical_report).toBe('Tech text');
  });

  it('falls back to top-level senior_report/technical_report when analysis.* is absent', async () => {
    mockReportingAnalyze.mockResolvedValueOnce({ senior_report: 'Flat senior', technical_report: 'Flat tech' });
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await orchestrator.analyzeProject(1, 'scrum', 'Org');

    expect(result.reports.senior_report).toBe('Flat senior');
    expect(result.reports.technical_report).toBe('Flat tech');
  });

  it('computes frameworkMetrics and earlyWarnings when normalization tasks exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ output: { dis: { score: 80 }, projects: [{ project_name: 'Fase 1' }] } }] })
      .mockResolvedValueOnce({ rows: [] });
    mockCalculateFrameworkMetrics.mockReturnValue({ framework: 'scrum', insights: [] });
    mockDetectWarnings.mockReturnValue({ hasAlerts: false, warnings: [] });

    const result = await orchestrator.analyzeProject(1, 'scrum', 'Org');

    expect(result.dis).toEqual({ score: 80 });
    expect(result.frameworkMetrics).toEqual({ framework: 'scrum', insights: [] });
    expect(result.earlyWarnings).toEqual({ hasAlerts: false, warnings: [] });
    expect(mockCalculateFrameworkMetrics).toHaveBeenCalledWith([{ project_name: 'Fase 1' }], 'scrum');
  });

  it('leaves dis/frameworkMetrics/earlyWarnings null when there is no normalization record', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await orchestrator.analyzeProject(1, 'scrum', 'Org');

    expect(result.dis).toBeNull();
    expect(result.frameworkMetrics).toBeNull();
    expect(result.earlyWarnings).toBeNull();
    expect(mockCalculateFrameworkMetrics).not.toHaveBeenCalled();
  });

  it('persists the combined output to ai_analyses', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await orchestrator.analyzeProject(1, 'scrum', 'Org');

    const insertCall = mockQuery.mock.calls.find(call => String(call[0]).includes('INSERT INTO ai_analyses'));
    expect(insertCall).toBeDefined();
    expect(insertCall![1][0]).toBe(1);
    expect(insertCall![1][1]).toBe('combined');
  });

  it('runs risk and economic analysis concurrently, not sequentially', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const order: string[] = [];
    mockRiskAnalyze.mockImplementationOnce(async () => {
      order.push('risk-start');
      await Promise.resolve();
      order.push('risk-end');
      return { analysis: { analysis: {} } };
    });
    mockEconomicAnalyze.mockImplementationOnce(async () => {
      order.push('economic-start');
      await Promise.resolve();
      order.push('economic-end');
      return { analysis: { analysis: {} } };
    });

    await orchestrator.analyzeProject(1, 'scrum', 'Org');

    expect(order.indexOf('economic-start')).toBeLessThan(order.indexOf('risk-end'));
  });
});
