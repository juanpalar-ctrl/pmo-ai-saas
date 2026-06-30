import { detectWarnings } from '../../services/earlyWarning';
import { TransformedRow } from '../../services/frameworkMetrics';

// Fixed reference date so tests don't drift with time
const TODAY = new Date();
const daysAgo = (n: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const daysFromNow = (n: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const base: TransformedRow = { project_name: 'Task A' };

describe('detectWarnings — empty / clean projects', () => {
  it('returns no warnings for empty rows', () => {
    const result = detectWarnings([]);
    expect(result.warnings).toHaveLength(0);
    expect(result.hasAlerts).toBe(false);
    expect(result.criticalCount).toBe(0);
  });

  it('returns no warnings for all-done tasks', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'done', end_date: daysAgo(5) },
      { ...base, project_name: 'Task B', status: 'completed', end_date: daysAgo(3) },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings).toHaveLength(0);
  });
});

describe('detectWarnings — OVERDUE detector', () => {
  it('flags tasks past their end_date', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'in progress', end_date: daysAgo(10) },
    ];
    const result = detectWarnings(rows);
    const overdue = result.warnings.find(w => w.type === 'OVERDUE');
    expect(overdue).toBeDefined();
    expect(overdue!.affectedTasks).toContain('Task A');
  });

  it('is CRITICAL when max delay > 14 days', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'in progress', end_date: daysAgo(20) },
    ];
    const result = detectWarnings(rows);
    const overdue = result.warnings.find(w => w.type === 'OVERDUE');
    expect(overdue!.severity).toBe('CRITICAL');
    expect(result.criticalCount).toBeGreaterThanOrEqual(1);
  });

  it('does NOT flag done tasks as overdue', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'done', end_date: daysAgo(30) },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'OVERDUE')).toBeUndefined();
  });

  it('does NOT flag tasks with future end_date', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'in progress', end_date: daysFromNow(5) },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'OVERDUE')).toBeUndefined();
  });
});

describe('detectWarnings — STAGNANT detector', () => {
  it('flags in-progress tasks started > 5 days ago', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'in progress', start_date: daysAgo(10), progress_percent: 20 },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'STAGNANT')).toBeDefined();
  });

  it('is CRITICAL with >= 3 stagnant tasks', () => {
    const rows: TransformedRow[] = Array.from({ length: 3 }, (_, i) => ({
      project_name: `Task ${i}`,
      status: 'in progress',
      start_date: daysAgo(15),
      progress_percent: 10,
    }));
    const result = detectWarnings(rows);
    const w = result.warnings.find(w => w.type === 'STAGNANT');
    expect(w!.severity).toBe('CRITICAL');
  });

  it('does NOT flag tasks started only 3 days ago', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'in progress', start_date: daysAgo(3), progress_percent: 30 },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'STAGNANT')).toBeUndefined();
  });
});

describe('detectWarnings — BUDGET_OVERRUN detector', () => {
  it('flags tasks where actual > estimated * 1.1', () => {
    const rows: TransformedRow[] = [
      { ...base, estimated_cost: 1000, actual_cost: 1200 },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'BUDGET_OVERRUN')).toBeDefined();
  });

  it('does NOT flag tasks within 10% tolerance', () => {
    const rows: TransformedRow[] = [
      { ...base, estimated_cost: 1000, actual_cost: 1050 },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'BUDGET_OVERRUN')).toBeUndefined();
  });

  it('is CRITICAL when total overrun > 50000', () => {
    const rows: TransformedRow[] = [
      { ...base, estimated_cost: 10000, actual_cost: 80000 },
    ];
    const result = detectWarnings(rows);
    const w = result.warnings.find(w => w.type === 'BUDGET_OVERRUN');
    expect(w!.severity).toBe('CRITICAL');
  });
});

describe('detectWarnings — CRITICAL_PATH detector', () => {
  it('flags 0% tasks with risks and end_date within 14 days', () => {
    const rows: TransformedRow[] = [
      { ...base, progress_percent: 0, risks: 'dependency blocker', end_date: daysFromNow(5) },
    ];
    const result = detectWarnings(rows);
    const w = result.warnings.find(w => w.type === 'CRITICAL_PATH');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('CRITICAL');
  });

  it('does NOT flag tasks with progress > 0', () => {
    const rows: TransformedRow[] = [
      { ...base, progress_percent: 10, risks: 'some risk', end_date: daysFromNow(3) },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'CRITICAL_PATH')).toBeUndefined();
  });

  it('does NOT flag tasks with no risks', () => {
    const rows: TransformedRow[] = [
      { ...base, progress_percent: 0, risks: '', end_date: daysFromNow(3) },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'CRITICAL_PATH')).toBeUndefined();
  });
});

describe('detectWarnings — NEVER_STARTED detector', () => {
  it('flags tasks whose start_date passed but have 0% progress and are not in-progress', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'pending', start_date: daysAgo(5), progress_percent: 0 },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'NEVER_STARTED')).toBeDefined();
  });

  it('does NOT flag in-progress tasks', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'in progress', start_date: daysAgo(5), progress_percent: 0 },
    ];
    const result = detectWarnings(rows);
    expect(result.warnings.find(w => w.type === 'NEVER_STARTED')).toBeUndefined();
  });
});

describe('detectWarnings — summary and counts', () => {
  it('builds correct criticalCount and highCount', () => {
    const rows: TransformedRow[] = [
      { ...base, status: 'in progress', end_date: daysAgo(20) },       // OVERDUE CRITICAL (>14d)
      { ...base, project_name: 'B', estimated_cost: 1000, actual_cost: 80000 }, // BUDGET CRITICAL
    ];
    const result = detectWarnings(rows);
    expect(result.criticalCount).toBeGreaterThanOrEqual(1);
    expect(result.hasAlerts).toBe(true);
    expect(result.summary).toMatch(/CRÍTICA/i);
  });
});
