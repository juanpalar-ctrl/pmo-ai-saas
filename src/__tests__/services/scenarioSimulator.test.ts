import { simulateScenario, SimulationDelta, MetricSnapshot } from '../../services/scenarioSimulator';

const base: Partial<MetricSnapshot> = {
  bac: 100_000,
  ac:  90_000,
  ev:  80_000,
  pv:  100_000,
  percentComplete: 80,
};

describe('simulateScenario — schedule_delay', () => {
  it('increases AC and PV after a delay', () => {
    const delta: SimulationDelta = { type: 'schedule_delay', weeks: 4, label: 'Retraso 4 semanas' };
    const result = simulateScenario(base, delta);
    expect(result.after.ac).toBeGreaterThan(result.before.ac);
    expect(result.after.pv).toBeGreaterThan(result.before.pv);
  });

  it('worsens CPI and SPI after delay', () => {
    const delta: SimulationDelta = { type: 'schedule_delay', weeks: 4, label: 'Retraso 4 semanas' };
    const result = simulateScenario(base, delta);
    expect(result.after.cpi).toBeLessThan(result.before.cpi);
    expect(result.after.spi).toBeLessThan(result.before.spi);
  });

  it('deltaSummary.eacChange is positive (more expensive)', () => {
    const delta: SimulationDelta = { type: 'schedule_delay', weeks: 2, label: 'Retraso 2 semanas' };
    const result = simulateScenario(base, delta);
    expect(result.deltaSummary.eacChange).toBeGreaterThan(0);
  });
});

describe('simulateScenario — schedule_acceleration', () => {
  it('increases EV without changing BAC', () => {
    const delta: SimulationDelta = { type: 'schedule_acceleration', weeks: 2, label: 'Acelerar 2 semanas' };
    const result = simulateScenario(base, delta);
    expect(result.after.ev).toBeGreaterThan(result.before.ev);
    expect(result.after.bac).toBe(result.before.bac);
  });

  it('EV never exceeds BAC', () => {
    const nearDone: Partial<MetricSnapshot> = { ...base, ev: 99_000, percentComplete: 99 };
    const delta: SimulationDelta = { type: 'schedule_acceleration', weeks: 20, label: 'Acelerar mucho' };
    const result = simulateScenario(nearDone, delta);
    expect(result.after.ev).toBeLessThanOrEqual(result.after.bac);
  });
});

describe('simulateScenario — budget_increase', () => {
  it('raises BAC by the given percentage', () => {
    const delta: SimulationDelta = { type: 'budget_increase', percent: 10, label: '+10% presupuesto' };
    const result = simulateScenario(base, delta);
    expect(result.after.bac).toBeCloseTo(110_000, -2);
  });

  it('increases BAC and EAC proportionally', () => {
    const delta: SimulationDelta = { type: 'budget_increase', percent: 20, label: '+20% presupuesto' };
    const result = simulateScenario(base, delta);
    // Both BAC and EAC grow — the ratio (VAC/BAC) stays similar
    expect(result.after.bac).toBeGreaterThan(result.before.bac);
    expect(result.after.eac).toBeGreaterThan(result.before.eac);
  });
});

describe('simulateScenario — scope_reduction', () => {
  it('reduces BAC by the given percentage', () => {
    const delta: SimulationDelta = { type: 'scope_reduction', percent: 20, label: '-20% alcance' };
    const result = simulateScenario(base, delta);
    expect(result.after.bac).toBeCloseTo(80_000, -2);
  });

  it('improves CPI when scope is cut', () => {
    const delta: SimulationDelta = { type: 'scope_reduction', percent: 20, label: '-20% alcance' };
    const result = simulateScenario(base, delta);
    expect(result.after.cpi).toBeGreaterThanOrEqual(result.before.cpi);
  });
});

describe('simulateScenario — team_boost', () => {
  it('increases EV and reduces AC', () => {
    const delta: SimulationDelta = { type: 'team_boost', percent: 15, label: '+15% equipo' };
    const result = simulateScenario(base, delta);
    expect(result.after.ev).toBeGreaterThan(result.before.ev);
    expect(result.after.ac).toBeLessThan(result.before.ac);
  });

  it('improves CPI after team boost', () => {
    const delta: SimulationDelta = { type: 'team_boost', percent: 15, label: '+15% equipo' };
    const result = simulateScenario(base, delta);
    expect(result.after.cpi).toBeGreaterThan(result.before.cpi);
  });
});

describe('simulateScenario — edge cases', () => {
  it('handles zero-budget project without throwing', () => {
    const empty: Partial<MetricSnapshot> = { bac: 0, ac: 0, ev: 0, pv: 0, percentComplete: 0 };
    const delta: SimulationDelta = { type: 'schedule_delay', weeks: 2, label: 'Retraso' };
    expect(() => simulateScenario(empty, delta)).not.toThrow();
  });

  it('result includes before/after/deltaSummary/scenario fields', () => {
    const delta: SimulationDelta = { type: 'budget_increase', percent: 5, label: '+5%' };
    const result = simulateScenario(base, delta);
    expect(result).toHaveProperty('before');
    expect(result).toHaveProperty('after');
    expect(result).toHaveProperty('deltaSummary');
    expect(result).toHaveProperty('scenario');
  });

  it('revenueAtStake is 0 when VAC is positive', () => {
    const healthy: Partial<MetricSnapshot> = { bac: 100_000, ac: 80_000, ev: 90_000, pv: 85_000 };
    const delta: SimulationDelta = { type: 'budget_increase', percent: 20, label: '+20%' };
    const result = simulateScenario(healthy, delta);
    expect(result.after.revenueAtStake).toBe(0);
  });
});
