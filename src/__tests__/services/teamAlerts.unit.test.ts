import { countCriticalDelayedTasks, computeDisconnectionLevel, daysSinceFeedback } from '../../services/teamAlerts';
import { TransformedRow } from '../../services/frameworkMetrics';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

describe('countCriticalDelayedTasks', () => {
  const criticalDelayed = (assignee: string): TransformedRow => ({
    project_name: 'T',
    assignee,
    status: 'in progress',
    progress_percent: 0,
    risks: 'Bloqueado por dependencia externa',
    end_date: daysAgo(5),
  });

  it('counts tasks that are overdue, 0% progress and have documented risks', () => {
    const rows = [criticalDelayed('Ana'), criticalDelayed('Ana')];
    expect(countCriticalDelayedTasks(rows, 'Ana')).toBe(2);
  });

  it('matches assignee case-insensitively and trims whitespace', () => {
    const rows = [criticalDelayed('  ana torres  ')];
    expect(countCriticalDelayedTasks(rows, 'Ana Torres')).toBe(1);
  });

  it('excludes tasks assigned to someone else', () => {
    const rows = [criticalDelayed('Ana')];
    expect(countCriticalDelayedTasks(rows, 'Beto')).toBe(0);
  });

  it('excludes done tasks even if overdue with 0% progress', () => {
    const rows = [{ ...criticalDelayed('Ana'), status: 'done' }];
    expect(countCriticalDelayedTasks(rows, 'Ana')).toBe(0);
  });

  it('excludes tasks not yet overdue', () => {
    const rows = [{ ...criticalDelayed('Ana'), end_date: daysAhead(5) }];
    expect(countCriticalDelayedTasks(rows, 'Ana')).toBe(0);
  });

  it('excludes tasks with progress > 0', () => {
    const rows = [{ ...criticalDelayed('Ana'), progress_percent: 10 }];
    expect(countCriticalDelayedTasks(rows, 'Ana')).toBe(0);
  });

  it('excludes tasks without documented risks', () => {
    const rows = [{ ...criticalDelayed('Ana'), risks: '' }];
    expect(countCriticalDelayedTasks(rows, 'Ana')).toBe(0);
  });

  it('returns 0 for an empty assignee name', () => {
    expect(countCriticalDelayedTasks([criticalDelayed('Ana')], '')).toBe(0);
  });
});

describe('computeDisconnectionLevel', () => {
  it('is green when feedback is recent (< 30 days)', () => {
    expect(computeDisconnectionLevel(new Date(daysAgo(10)), 5)).toBe('green');
  });

  it('is green at exactly 29 days', () => {
    expect(computeDisconnectionLevel(new Date(daysAgo(29)), 5)).toBe('green');
  });

  it('is orange between 30 and 45 days regardless of critical task count', () => {
    expect(computeDisconnectionLevel(new Date(daysAgo(35)), 10)).toBe('orange');
  });

  it('is red past 45 days with more than 3 critical/delayed tasks', () => {
    expect(computeDisconnectionLevel(new Date(daysAgo(50)), 4)).toBe('red');
  });

  it('stays orange past 45 days when critical/delayed count is 3 or fewer', () => {
    expect(computeDisconnectionLevel(new Date(daysAgo(50)), 3)).toBe('orange');
  });

  it('treats a member who never received feedback as very overdue', () => {
    expect(computeDisconnectionLevel(null, 5)).toBe('red');
    expect(computeDisconnectionLevel(null, 1)).toBe('orange');
  });
});

describe('daysSinceFeedback', () => {
  it('returns Infinity when there is no feedback yet', () => {
    expect(daysSinceFeedback(null)).toBe(Infinity);
  });

  it('returns the number of whole days elapsed', () => {
    expect(daysSinceFeedback(new Date(daysAgo(10)))).toBe(10);
  });
});
