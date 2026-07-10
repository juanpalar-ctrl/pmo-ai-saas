import {
  countCriticalDelayedTasks,
  countActiveTasks,
  countOverdueTasks,
  computeWorkloadLevel,
  computePeopleHealthLevel,
  computeOverallLevel,
  daysSinceFeedback,
} from '../../services/teamAlerts';
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

describe('countActiveTasks', () => {
  const task = (assignee: string, status: string): TransformedRow => ({ project_name: 'T', assignee, status });

  it('counts non-done tasks for the assignee, case-insensitively', () => {
    const rows = [task('Ana', 'in progress'), task('  ana  ', 'todo'), task('Ana', 'done'), task('Beto', 'todo')];
    expect(countActiveTasks(rows, 'Ana')).toBe(2);
  });

  it('returns 0 for an empty assignee name', () => {
    expect(countActiveTasks([task('Ana', 'todo')], '')).toBe(0);
  });
});

describe('countOverdueTasks', () => {
  const task = (assignee: string, end: string, status = 'in progress'): TransformedRow => ({
    project_name: 'T', assignee, status, end_date: end,
  });

  it('counts non-done tasks past their end_date', () => {
    const rows = [task('Ana', daysAgo(3)), task('Ana', daysAhead(3)), task('Ana', daysAgo(1), 'done')];
    expect(countOverdueTasks(rows, 'Ana')).toBe(1);
  });

  it('ignores tasks without an end_date', () => {
    expect(countOverdueTasks([{ project_name: 'T', assignee: 'Ana', status: 'todo' }], 'Ana')).toBe(0);
  });
});

describe('computeWorkloadLevel', () => {
  const base = { activeCount: 0, overdueCount: 0, criticalDelayedCount: 0, teamAvgActive: 4 };

  it('is red when there is at least one critical+delayed task', () => {
    expect(computeWorkloadLevel({ ...base, criticalDelayedCount: 1 })).toBe('red');
  });

  it('is red when active load is 1.5x the team average or more (sobrecarga)', () => {
    expect(computeWorkloadLevel({ ...base, activeCount: 6, teamAvgActive: 4 })).toBe('red');
  });

  it('is yellow when above the team average but not overloaded', () => {
    expect(computeWorkloadLevel({ ...base, activeCount: 5, teamAvgActive: 4 })).toBe('yellow');
  });

  it('is yellow when there is an overdue task even at/below average', () => {
    expect(computeWorkloadLevel({ ...base, activeCount: 2, overdueCount: 1 })).toBe('yellow');
  });

  it('is green at or below the team average with nothing overdue', () => {
    expect(computeWorkloadLevel({ ...base, activeCount: 4, teamAvgActive: 4 })).toBe('green');
  });

  it('skips the relative check when the team average is 0', () => {
    expect(computeWorkloadLevel({ activeCount: 3, overdueCount: 0, criticalDelayedCount: 0, teamAvgActive: 0 })).toBe('green');
  });
});

describe('computePeopleHealthLevel', () => {
  it('is none when the member never received feedback', () => {
    expect(computePeopleHealthLevel({ wellbeingScore: null, daysSinceFeedback: Infinity })).toBe('none');
  });

  it('is red when wellbeing is below 0.4', () => {
    expect(computePeopleHealthLevel({ wellbeingScore: 0.3, daysSinceFeedback: 2 })).toBe('red');
  });

  it('is red when the last feedback is more than 45 days old', () => {
    expect(computePeopleHealthLevel({ wellbeingScore: 0.9, daysSinceFeedback: 50 })).toBe('red');
  });

  it('is yellow for a mid wellbeing score', () => {
    expect(computePeopleHealthLevel({ wellbeingScore: 0.5, daysSinceFeedback: 2 })).toBe('yellow');
  });

  it('is yellow when feedback is stale (30-45 days) even with a good score', () => {
    expect(computePeopleHealthLevel({ wellbeingScore: 0.9, daysSinceFeedback: 40 })).toBe('yellow');
  });

  it('is green with a high score and recent feedback', () => {
    expect(computePeopleHealthLevel({ wellbeingScore: 0.8, daysSinceFeedback: 8 })).toBe('green');
  });
});

describe('computeOverallLevel', () => {
  it('takes the worst of the two axes', () => {
    expect(computeOverallLevel('green', 'red')).toBe('red');
    expect(computeOverallLevel('yellow', 'green')).toBe('yellow');
    expect(computeOverallLevel('red', 'yellow')).toBe('red');
  });

  it('does not let "none" people-health drag the overall down', () => {
    expect(computeOverallLevel('red', 'none')).toBe('red');
    expect(computeOverallLevel('green', 'none')).toBe('green');
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
