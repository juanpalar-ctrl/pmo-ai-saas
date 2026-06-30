import { calculateFrameworkMetrics } from '../../services/frameworkMetrics';
import { TransformedRow } from '../../services/frameworkMetrics';

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

describe('calculateFrameworkMetrics — empty rows', () => {
  it('returns empty cards for any framework when rows is empty', () => {
    for (const fw of ['scrum', 'kanban', 'safe', 'waterfall', 'unknown']) {
      const result = calculateFrameworkMetrics([], fw);
      expect(result.cards).toHaveLength(0);
      expect(result.insights).toContain('Sin datos de tareas disponibles');
    }
  });
});

describe('calculateFrameworkMetrics — Scrum', () => {
  const scrumRows: TransformedRow[] = [
    { project_name: 'T1', status: 'done',        start_date: daysAgo(28), end_date: daysAgo(14) },
    { project_name: 'T2', status: 'done',        start_date: daysAgo(28), end_date: daysAgo(10) },
    { project_name: 'T3', status: 'in progress', start_date: daysAgo(5),  end_date: daysFromNow(5) },
    { project_name: 'T4', status: 'pending',     start_date: daysAgo(2),  end_date: daysFromNow(10) },
  ];

  it('returns exactly 4 metric cards', () => {
    const result = calculateFrameworkMetrics(scrumRows, 'scrum');
    expect(result.cards).toHaveLength(4);
    expect(result.framework).toBe('scrum');
  });

  it('velocity is a positive integer', () => {
    const result = calculateFrameworkMetrics(scrumRows, 'scrum');
    const velocityCard = result.cards.find(c => c.label === 'Velocity');
    expect(velocityCard).toBeDefined();
    const value = parseInt(velocityCard!.value);
    expect(value).toBeGreaterThan(0);
  });

  it('completion rate reflects done tasks', () => {
    const result = calculateFrameworkMetrics(scrumRows, 'scrum');
    const rateCard = result.cards.find(c => c.label === 'Sprint Completion Rate');
    expect(rateCard!.value).toBe('50.0%'); // 2 of 4 done
  });

  it('defaults to scrum for unknown framework', () => {
    const result = calculateFrameworkMetrics(scrumRows, 'unknown');
    expect(result.framework).toBe('scrum');
    expect(result.cards).toHaveLength(4);
  });
});

describe('calculateFrameworkMetrics — Kanban', () => {
  const kanbanRows: TransformedRow[] = [
    { project_name: 'T1', status: 'done',        start_date: daysAgo(10), end_date: daysAgo(3) },
    { project_name: 'T2', status: 'done',        start_date: daysAgo(20), end_date: daysAgo(5) },
    { project_name: 'T3', status: 'in progress', start_date: daysAgo(5),  end_date: daysFromNow(3) },
    { project_name: 'T4', status: 'in progress', start_date: daysAgo(2),  end_date: daysFromNow(5), progress_percent: 40 },
  ];

  it('returns 4 cards', () => {
    const result = calculateFrameworkMetrics(kanbanRows, 'kanban');
    expect(result.cards).toHaveLength(4);
    expect(result.framework).toBe('kanban');
  });

  it('WIP card reflects in-progress count', () => {
    const result = calculateFrameworkMetrics(kanbanRows, 'kanban');
    const wip = result.cards.find(c => c.label === 'WIP Actual');
    expect(wip!.value).toBe('2 tareas');
  });

  it('cycle time is positive for done tasks with dates', () => {
    const result = calculateFrameworkMetrics(kanbanRows, 'kanban');
    const ct = result.cards.find(c => c.label === 'Cycle Time');
    expect(ct!.value).not.toBe('N/A');
    const days = parseFloat(ct!.value);
    expect(days).toBeGreaterThan(0);
  });

  it('cycle time is N/A when no done tasks', () => {
    const rows: TransformedRow[] = [
      { project_name: 'T1', status: 'in progress', start_date: daysAgo(5), end_date: daysFromNow(5) },
    ];
    const result = calculateFrameworkMetrics(rows, 'kanban');
    const ct = result.cards.find(c => c.label === 'Cycle Time');
    expect(ct!.value).toBe('N/A');
  });
});

describe('calculateFrameworkMetrics — SAFe', () => {
  const safeRows: TransformedRow[] = [
    { project_name: 'F1', status: 'done',        progress_percent: 100 },
    { project_name: 'F2', status: 'in progress', progress_percent: 60 },
    { project_name: 'F3', status: 'in progress', progress_percent: 40 },
    { project_name: 'F4', status: 'pending',     progress_percent: 0 },
  ];

  it('returns 4 cards', () => {
    const result = calculateFrameworkMetrics(safeRows, 'safe');
    expect(result.cards).toHaveLength(4);
    expect(result.framework).toBe('safe');
  });

  it('PPM reflects average progress', () => {
    const result = calculateFrameworkMetrics(safeRows, 'safe');
    const ppm = result.cards.find(c => c.label === 'PPM (Program Predictability)');
    expect(ppm).toBeDefined();
    // avg(100, 60, 40, 0) = 50
    expect(ppm!.value).toBe('50.0%');
  });

  it('flow load = in-progress + not-started', () => {
    const result = calculateFrameworkMetrics(safeRows, 'safe');
    const fl = result.cards.find(c => c.label === 'Flow Load');
    expect(fl!.value).toBe('3 features'); // 2 in-progress + 1 pending
  });

  it('PI Success Rate = done/total', () => {
    const result = calculateFrameworkMetrics(safeRows, 'safe');
    const pi = result.cards.find(c => c.label === 'PI Success Rate');
    expect(pi!.value).toBe('25.0%'); // 1 of 4
  });
});

describe('calculateFrameworkMetrics — Waterfall', () => {
  const wfRows: TransformedRow[] = [
    { project_name: 'Phase 1', status: 'done',        end_date: daysAgo(5) },
    { project_name: 'Phase 2', status: 'in progress', end_date: daysFromNow(10) },
    { project_name: 'Phase 3', status: 'pending',     end_date: daysAgo(2) },   // overdue
    { project_name: 'Phase 4', status: 'pending',     end_date: daysFromNow(20), progress_percent: 0, risks: 'dependency' }, // critical
  ];

  it('returns 4 cards', () => {
    const result = calculateFrameworkMetrics(wfRows, 'waterfall');
    expect(result.cards).toHaveLength(4);
    expect(result.framework).toBe('waterfall');
  });

  it('counts delayed tasks correctly', () => {
    const result = calculateFrameworkMetrics(wfRows, 'waterfall');
    const delayed = result.cards.find(c => c.label === 'Tareas Atrasadas');
    expect(delayed!.value).toBe('1'); // only Phase 3
  });

  it('counts critical path tasks (0% + risks)', () => {
    const result = calculateFrameworkMetrics(wfRows, 'waterfall');
    const cp = result.cards.find(c => c.label === 'Ruta Crítica');
    expect(cp!.value).toBe('1 tareas'); // Phase 4
  });

  it('done tasks are not counted as delayed', () => {
    const allDone: TransformedRow[] = [
      { project_name: 'P1', status: 'done', end_date: daysAgo(10) },
      { project_name: 'P2', status: 'done', end_date: daysAgo(5) },
    ];
    const result = calculateFrameworkMetrics(allDone, 'waterfall');
    const delayed = result.cards.find(c => c.label === 'Tareas Atrasadas');
    expect(delayed!.value).toBe('0');
  });
});
