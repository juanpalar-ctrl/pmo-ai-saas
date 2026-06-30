/**
 * scenarioSimulator.ts
 * Deterministic EVM recalculation for "what-if" scenarios.
 * Claude parses the user's natural-language question → SimulationDelta.
 * This module applies the math — no LLM involved in the numbers.
 */

export type ScenarioType =
  | 'schedule_delay'       // project slips N weeks
  | 'schedule_acceleration' // team speeds up, gains N weeks
  | 'budget_increase'      // budget is raised by X%
  | 'scope_reduction'      // scope cut by X% (reduces BAC and remaining EV)
  | 'team_boost';          // adding resources → CPI/SPI improve by X%

export interface SimulationDelta {
  type: ScenarioType;
  weeks?: number;   // for schedule scenarios
  percent?: number; // for budget/scope/team scenarios (0–100)
  label: string;    // human-readable description of the scenario
}

export interface MetricSnapshot {
  cpi: number;
  spi: number;
  eac: number;
  vac: number;
  bac: number;
  ac:  number;
  ev:  number;
  pv:  number;
  percentComplete: number;
  revenueAtStake: number; // |vac| when vac < 0
}

export interface SimulationResult {
  scenario:  string;
  before:    MetricSnapshot;
  after:     MetricSnapshot;
  deltaSummary: {
    eacChange:           number; // positive = cost increase
    vacChange:           number;
    revenueAtStakeChange: number;
    cpiChange:           number;
    spiChange:           number;
  };
}

function toSnap(m: Partial<MetricSnapshot>): MetricSnapshot {
  const bac = m.bac ?? 0;
  const ac  = m.ac  ?? 0;
  const ev  = m.ev  ?? 0;
  const pv  = m.pv  ?? 0;
  const cpi = ac > 0 ? ev / ac : 1;
  const spi = pv > 0 ? ev / pv : 1;
  const eac = cpi > 0 ? bac / cpi : bac;
  const vac = bac - eac;
  return {
    bac,
    ac,
    ev,
    pv,
    cpi:             Math.round(cpi  * 1000) / 1000,
    spi:             Math.round(spi  * 1000) / 1000,
    eac:             Math.round(eac),
    vac:             Math.round(vac),
    percentComplete: m.percentComplete ?? (bac > 0 ? (ev / bac) * 100 : 0),
    revenueAtStake:  vac < 0 ? Math.abs(Math.round(vac)) : 0,
  };
}

export function simulateScenario(
  current: Partial<MetricSnapshot>,
  delta: SimulationDelta
): SimulationResult {
  const before = toSnap(current);

  let newAC  = before.ac;
  let newEV  = before.ev;
  let newPV  = before.pv;
  let newBAC = before.bac;

  switch (delta.type) {
    case 'schedule_delay': {
      // Delay N weeks → PV falls (schedule falls behind), SPI worsens.
      // Cost of delay = daily burn rate × days delayed.
      const weeksDelay = delta.weeks ?? 2;
      // SPI decreases proportionally: spi_new = spi / (1 + delay_ratio)
      // where delay_ratio = (weeks_delay / total_remaining_weeks)
      // Approximate total remaining weeks = (1 - pct_complete) * project_duration
      // We don't have project duration, so use a reasonable proxy: pv / (weekly burn)
      const weeklyBurn  = before.ac / Math.max(1, (before.percentComplete / 100) * 52);
      const addedCost   = weeklyBurn * weeksDelay;
      newAC  = before.ac + addedCost;
      // EV stays the same (work done doesn't change), PV increases (more was planned)
      newPV  = before.pv + weeklyBurn * weeksDelay;
      break;
    }

    case 'schedule_acceleration': {
      // Gain N weeks → team delivers more EV in the same time window.
      const weeksGain  = delta.weeks ?? 1;
      const weeklyEV   = before.ev / Math.max(1, (before.percentComplete / 100) * 52);
      newEV  = Math.min(before.bac, before.ev + weeklyEV * weeksGain);
      break;
    }

    case 'budget_increase': {
      // BAC raised by X% → EAC and VAC shift
      const pct   = (delta.percent ?? 10) / 100;
      newBAC = before.bac * (1 + pct);
      break;
    }

    case 'scope_reduction': {
      // Scope cut by X% → BAC decreases, remaining EV also decreases
      const pct   = (delta.percent ?? 20) / 100;
      newBAC = before.bac * (1 - pct);
      // EV stays (already completed), but BAC shrinks → CPI/VAC improve
      break;
    }

    case 'team_boost': {
      // Adding resources → CPI improves by X%, and SPI improves by X%
      const pct    = (delta.percent ?? 15) / 100;
      // Model as increased EV and reduced AC going forward
      const remainingWork = before.bac - before.ev;
      newEV  = before.ev + remainingWork * pct * 0.5; // partial EV gain
      newAC  = before.ac * (1 - pct * 0.3);           // slight AC increase (overhead)
      break;
    }
  }

  const after = toSnap({ bac: newBAC, ac: newAC, ev: newEV, pv: newPV, percentComplete: before.percentComplete });

  return {
    scenario: delta.label,
    before,
    after,
    deltaSummary: {
      eacChange:            after.eac - before.eac,
      vacChange:            after.vac - before.vac,
      revenueAtStakeChange: after.revenueAtStake - before.revenueAtStake,
      cpiChange:            Math.round((after.cpi - before.cpi) * 1000) / 1000,
      spiChange:            Math.round((after.spi - before.spi) * 1000) / 1000,
    },
  };
}
