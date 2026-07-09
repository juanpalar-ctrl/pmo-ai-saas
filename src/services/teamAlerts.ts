/**
 * teamAlerts.ts
 * Pure logic for the team disconnection semaphore (Hito 5.3).
 * No DB/IO — same style as earlyWarning.ts, testable in isolation.
 */

import { TransformedRow } from './frameworkMetrics';

export type DisconnectionLevel = 'green' | 'orange' | 'red';

const DONE_STATUSES = ['done', 'completed', 'terminado', 'finalizado', 'cerrado', 'closed', 'complete'];
const isDone = (s?: string | null) => DONE_STATUSES.some(k => (s || '').toLowerCase().includes(k));

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
    if ((r.assignee || '').trim().toLowerCase() !== target) return false;
    if (isDone(r.status)) return false;
    if (!r.end_date || new Date(r.end_date) >= today) return false; // not delayed
    const progress = r.progress_percent || 0;
    if (progress > 0) return false;
    if (!r.risks || r.risks.trim() === '') return false;
    return true;
  }).length;
}

/**
 * Green: feedback within 30 days.
 * Orange: 30-45 days, or >45 days without enough critical/delayed tasks to
 * count as burnout (the doc doesn't define this case explicitly — falling
 * back to the lower alert level rather than inventing a 4th color).
 * Red: >45 days AND more than 3 critical+delayed tasks assigned.
 */
export function computeDisconnectionLevel(
  lastFeedbackAt: Date | null,
  criticalDelayedCount: number
): DisconnectionLevel {
  const daysSince = lastFeedbackAt
    ? Math.floor((Date.now() - lastFeedbackAt.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  if (daysSince < 30) return 'green';
  if (daysSince > 45 && criticalDelayedCount > 3) return 'red';
  return 'orange';
}

export function daysSinceFeedback(lastFeedbackAt: Date | null): number {
  if (!lastFeedbackAt) return Infinity;
  return Math.floor((Date.now() - lastFeedbackAt.getTime()) / (1000 * 60 * 60 * 24));
}
