jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../core/logger', () => ({
  dbLogger:      { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  serviceLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { pool } from '../../db';
import { calculateProjectMetrics } from '../../services/metricsCalculator';

const mockQuery = pool.query as jest.Mock;

const twoTasks = [
  { estimated_cost: '50000', actual_cost: '45000', progress_percent: '80', status: 'in progress', start_date: '2024-01-01', end_date: '2024-12-31' },
  { estimated_cost: '50000', actual_cost: '50000', progress_percent: '100', status: 'done',        start_date: '2024-01-01', end_date: '2024-06-30' },
];

function setupMocks(tasks = twoTasks, projectName = 'Test Project') {
  mockQuery.mockReset();
  mockQuery
    .mockResolvedValueOnce({ rows: [{ projectname: projectName }] })
    .mockResolvedValueOnce({ rows: [{ output: { projects: tasks } }] });
}

describe('calculateProjectMetrics — EVM math', () => {
  beforeEach(() => setupMocks());

  it('CPI ≈ EV / AC', async () => {
    const r = await calculateProjectMetrics(1, 'scrum');
    expect(parseFloat(r.cpi)).toBeCloseTo(parseFloat(r.ev) / parseFloat(r.ac), 1);
  });

  it('SPI ≈ EV / PV', async () => {
    const r = await calculateProjectMetrics(1, 'scrum');
    expect(parseFloat(r.spi)).toBeCloseTo(parseFloat(r.ev) / parseFloat(r.pv), 1);
  });

  it('EAC > BAC when CPI < 1 (project is over budget)', async () => {
    // tasks: ev=90000, ac=95000 → CPI < 1 → EAC > BAC
    const r = await calculateProjectMetrics(1, 'scrum');
    if (parseFloat(r.cpi) < 1) {
      expect(parseFloat(r.eac)).toBeGreaterThan(parseFloat(r.bac));
    } else {
      expect(parseFloat(r.eac)).toBeLessThanOrEqual(parseFloat(r.bac));
    }
  });

  it('VAC = BAC - EAC', async () => {
    const r = await calculateProjectMetrics(1, 'scrum');
    expect(parseFloat(r.vac)).toBeCloseTo(parseFloat(r.bac) - parseFloat(r.eac), 0);
  });

  it('percentComplete is between 0 and 100', async () => {
    const r = await calculateProjectMetrics(1, 'scrum');
    const pct = parseFloat(r.percentComplete);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it('returns all expected metric keys', async () => {
    const r = await calculateProjectMetrics(1, 'scrum');
    ['bac','pv','ev','ac','cv','sv','cpi','spi','eac','vac','percentComplete'].forEach(k =>
      expect(r).toHaveProperty(k)
    );
  });

  it('returns projectName from DB', async () => {
    const r = await calculateProjectMetrics(1, 'scrum');
    expect(r.projectName).toBe('Test Project');
  });
});

describe('calculateProjectMetrics — edge cases', () => {
  it('throws when project is not found', async () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(calculateProjectMetrics(999, 'scrum')).rejects.toThrow('Project not found');
  });

  it('handles empty task list without throwing', async () => {
    setupMocks([]);
    await expect(calculateProjectMetrics(1, 'scrum')).resolves.toBeDefined();
  });

  it('percentComplete reflects mixed-progress tasks', async () => {
    setupMocks([
      { estimated_cost: '10000', actual_cost: '10000', progress_percent: '100', status: 'done',        start_date: '2024-01-01', end_date: '2024-06-30' },
      { estimated_cost: '10000', actual_cost: '5000',  progress_percent: '50',  status: 'in progress', start_date: '2024-01-01', end_date: '2024-12-31' },
      { estimated_cost: '10000', actual_cost: '10000', progress_percent: '100', status: 'completed',   start_date: '2024-01-01', end_date: '2024-06-30' },
    ]);
    const r = await calculateProjectMetrics(1, 'scrum');
    expect(parseFloat(r.percentComplete)).toBeCloseTo(83.3, 0);
  });

  it('BAC falls back to 100000 when all tasks have zero cost', async () => {
    setupMocks([
      { estimated_cost: '0', actual_cost: '0', progress_percent: '0', status: 'pending', start_date: '2024-01-01', end_date: '2024-12-31' },
    ]);
    const r = await calculateProjectMetrics(1, 'scrum');
    expect(parseFloat(r.bac)).toBe(100000);
  });
});
