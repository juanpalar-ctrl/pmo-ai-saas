/**
 * teamAlerts.ts
 * Pure logic for the team health semaphores (Hito 5.3 + Fase 1 desglose).
 * No DB/IO — same style as earlyWarning.ts, testable in isolation.
 *
 * Fase 1 splits the old single "disconnection" semaphore (which conflated
 * workload and feedback) into two independent axes plus a combined roll-up:
 *   - workloadLevel     → derived purely from tasks (carga de trabajo)
 *   - peopleHealthLevel → derived purely from feedback (bienestar)
 *   - overallLevel      → worst of the two (métrica combinada global)
 */

import { TransformedRow } from './frameworkMetrics';

export type HealthLevel = 'green' | 'yellow' | 'red';
// People health can additionally be "none" — a member who has never received
// feedback. That's a gray "sin datos" state, deliberately NOT a red alarm.
export type PeopleHealthLevel = HealthLevel | 'none';

const DONE_STATUSES = ['done', 'completed', 'terminado', 'finalizado', 'cerrado', 'closed', 'complete'];
const isDone = (s?: string | null) => DONE_STATUSES.some(k => (s || '').toLowerCase().includes(k));

const matchesAssignee = (row: TransformedRow, target: string) =>
  (row.assignee || '').trim().toLowerCase() === target;

/**
 * Counts tasks assigned to `assigneeName` that are both overdue (end_date in
 * the past, not done) and "critical" by the same 0%-progress + documented-risk
 * proxy already used for the Critical Path card in frameworkMetrics.calcWaterfall
 * — there's no real CPM/slack calculation in this codebase to build on.
 */
export function countCriticalDelayedTasks(rows: TransformedRow[], assigneeName: string): number {
  const target = assigneeName.trim().toLowerCase();
  if (!target) return 0;

  const today = new Date();

  return rows.filter(r => {
    if (!matchesAssignee(r, target)) return false;
    if (isDone(r.status)) return false;
    if (!r.end_date || new Date(r.end_date) >= today) return false; // not delayed
    const progress = r.progress_percent || 0;
    if (progress > 0) return false;
    if (!r.risks || r.risks.trim() === '') return false;
    return true;
  }).length;
}

/** Non-done tasks currently assigned to `assigneeName` — the person's active load. */
export function countActiveTasks(rows: TransformedRow[], assigneeName: string): number {
  const target = assigneeName.trim().toLowerCase();
  if (!target) return 0;
  return rows.filter(r => matchesAssignee(r, target) && !isDone(r.status)).length;
}

/** Non-done tasks past their end_date — late deliveries, whatever the reason. */
export function countOverdueTasks(rows: TransformedRow[], assigneeName: string): number {
  const target = assigneeName.trim().toLowerCase();
  if (!target) return 0;
  const today = new Date();
  return rows.filter(r => {
    if (!matchesAssignee(r, target)) return false;
    if (isDone(r.status)) return false;
    return !!r.end_date && new Date(r.end_date) < today;
  }).length;
}

/**
 * Workload semaphore (Fase 1). Overload is measured *relative to the project's
 * team average* because there's no historical per-person baseline yet (that's
 * Fase 3). teamAvgActive === 0 (nobody has active tasks) skips the relative
 * check and falls back to overdue/critical only.
 *   - red:    ≥ 1.5× the team average active load, or ≥1 critical+delayed task.
 *   - yellow: above the team average, or ≥1 overdue task.
 *   - green:  at/below the average with nothing overdue.
 */
export function computeWorkloadLevel(input: {
  activeCount: number;
  overdueCount: number;
  criticalDelayedCount: number;
  teamAvgActive: number;
}): HealthLevel {
  const { activeCount, overdueCount, criticalDelayedCount, teamAvgActive } = input;
  const overloaded = teamAvgActive > 0 && activeCount >= teamAvgActive * 1.5;
  const aboveAverage = teamAvgActive > 0 && activeCount > teamAvgActive;

  if (criticalDelayedCount >= 1 || overloaded) return 'red';
  if (overdueCount >= 1 || aboveAverage) return 'yellow';
  return 'green';
}

/**
 * People-health semaphore (Fase 1) — purely feedback-driven.
 *   - none:   never received feedback (gray "sin datos", not an alarm).
 *   - red:    wellbeing < 0.4, or last feedback more than 45 days ago.
 *   - yellow: wellbeing 0.4–0.7, or last feedback more than 30 days ago.
 *   - green:  wellbeing ≥ 0.7 and feedback within 30 days.
 */
export function computePeopleHealthLevel(input: {
  wellbeingScore: number | null;
  daysSinceFeedback: number;
}): PeopleHealthLevel {
  const { wellbeingScore, daysSinceFeedback } = input;
  if (wellbeingScore === null && !isFinite(daysSinceFeedback)) return 'none';

  if ((wellbeingScore !== null && wellbeingScore < 0.4) || daysSinceFeedback > 45) return 'red';
  if ((wellbeingScore !== null && wellbeingScore < 0.7) || daysSinceFeedback > 30) return 'yellow';
  return 'green';
}

const LEVEL_RANK: Record<HealthLevel, number> = { green: 0, yellow: 1, red: 2 };

/**
 * Combined roll-up = worst of the two axes. "none" people-health doesn't drag
 * the overall down (a member with no feedback but a healthy workload is green).
 */
export function computeOverallLevel(workload: HealthLevel, peopleHealth: PeopleHealthLevel): HealthLevel {
  const ph: HealthLevel = peopleHealth === 'none' ? 'green' : peopleHealth;
  return LEVEL_RANK[ph] > LEVEL_RANK[workload] ? ph : workload;
}

export function daysSinceFeedback(lastFeedbackAt: Date | null): number {
  if (!lastFeedbackAt) return Infinity;
  return Math.floor((Date.now() - lastFeedbackAt.getTime()) / (1000 * 60 * 60 * 24));
}
