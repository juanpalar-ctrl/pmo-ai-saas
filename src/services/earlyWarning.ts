/**
 * earlyWarning.ts
 * Early Warning System — detects project health issues from task rows.
 * Produces actionable alerts for the dashboard and the LARA chatbot.
 */

import { TransformedRow } from './frameworkMetrics';

export type WarningSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type WarningType =
  | 'STAGNANT'
  | 'OVERDUE'
  | 'NEVER_STARTED'
  | 'BUDGET_OVERRUN'
  | 'CRITICAL_PATH'
  | 'HIGH_WIP'
  | 'LOW_PROGRESS';

export interface EarlyWarning {
  type: WarningType;
  severity: WarningSeverity;
  title: string;
  description: string;
  action: string;
  affectedTasks: string[];
}

export interface EarlyWarningResult {
  warnings: EarlyWarning[];
  criticalCount: number;
  highCount: number;
  hasAlerts: boolean;
  summary: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const DONE_STATUSES = ['done', 'completed', 'terminado', 'finalizado', 'cerrado', 'closed', 'complete'];
const IN_PROGRESS_STATUSES = ['in progress', 'in_progress', 'en progreso', 'en curso', 'wip', 'doing', 'active'];

const isDone = (s?: string | null) => DONE_STATUSES.some(k => (s || '').toLowerCase().includes(k));
const isInProgress = (s?: string | null) => IN_PROGRESS_STATUSES.some(k => (s || '').toLowerCase().includes(k));

function daysSince(dateStr: string): number {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── detectors ────────────────────────────────────────────────────────────────

function detectStagnant(rows: TransformedRow[]): EarlyWarning | null {
  // Stagnant = in-progress for more than 5 days since start_date with <100% progress
  const stagnant = rows.filter(r => {
    if (isDone(r.status)) return false;
    if (!r.start_date) return false;
    const progress = r.progress_percent || 0;
    return isInProgress(r.status) && daysSince(r.start_date) > 5 && progress < 100;
  });

  if (stagnant.length === 0) return null;

  const avgDays = Math.round(
    stagnant.reduce((s, r) => s + daysSince(r.start_date!), 0) / stagnant.length
  );

  return {
    type: 'STAGNANT',
    severity: stagnant.length >= 3 ? 'CRITICAL' : 'HIGH',
    title: `${stagnant.length} tarea(s) estancada(s)`,
    description: `${stagnant.length} tarea(s) llevan en progreso más de 5 días sin completarse (promedio ${avgDays} días activas).`,
    action: 'Realiza un stand-up inmediato para identificar bloqueos. Considera mover estas tareas al top del backlog o reasignarlas.',
    affectedTasks: stagnant.slice(0, 5).map(r => r.project_name),
  };
}

function detectOverdue(rows: TransformedRow[]): EarlyWarning | null {
  const today = new Date();
  const overdue = rows.filter(r => {
    if (isDone(r.status)) return false;
    if (!r.end_date) return false;
    return new Date(r.end_date) < today;
  });

  if (overdue.length === 0) return null;

  const maxDelay = Math.max(...overdue.map(r => Math.abs(daysUntil(r.end_date!))));

  return {
    type: 'OVERDUE',
    severity: maxDelay > 14 ? 'CRITICAL' : overdue.length > 3 ? 'HIGH' : 'MEDIUM',
    title: `${overdue.length} tarea(s) fuera de fecha`,
    description: `${overdue.length} tarea(s) han superado su fecha límite. La más atrasada lleva ${maxDelay} días de retraso.`,
    action: 'Negocia nuevas fechas realistas con el equipo y comunica el desvío al stakeholder. Evalúa si el Critical Path está en riesgo.',
    affectedTasks: overdue
      .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime())
      .slice(0, 5)
      .map(r => r.project_name),
  };
}

function detectNeverStarted(rows: TransformedRow[]): EarlyWarning | null {
  const today = new Date();
  const neverStarted = rows.filter(r => {
    if (isDone(r.status) || isInProgress(r.status)) return false;
    if (!r.start_date) return false;
    const progress = r.progress_percent || 0;
    return new Date(r.start_date) < today && progress === 0;
  });

  if (neverStarted.length === 0) return null;

  return {
    type: 'NEVER_STARTED',
    severity: neverStarted.length >= 5 ? 'HIGH' : 'MEDIUM',
    title: `${neverStarted.length} tarea(s) no iniciadas pese a fecha de inicio pasada`,
    description: `${neverStarted.length} tarea(s) debían haber iniciado pero tienen 0% de avance.`,
    action: 'Verifica disponibilidad del equipo. Considera reorganizar el backlog o solicitar recursos adicionales.',
    affectedTasks: neverStarted.slice(0, 5).map(r => r.project_name),
  };
}

function detectBudgetOverrun(rows: TransformedRow[]): EarlyWarning | null {
  const withCosts = rows.filter(r => (r.estimated_cost || 0) > 0 && (r.actual_cost || 0) > 0);
  if (withCosts.length === 0) return null;

  const overBudget = withCosts.filter(r => (r.actual_cost || 0) > (r.estimated_cost || 1) * 1.1);
  if (overBudget.length === 0) return null;

  const totalOverrun = overBudget.reduce((s, r) => s + ((r.actual_cost || 0) - (r.estimated_cost || 0)), 0);

  return {
    type: 'BUDGET_OVERRUN',
    severity: totalOverrun > 50000 ? 'CRITICAL' : overBudget.length > 2 ? 'HIGH' : 'MEDIUM',
    title: `${overBudget.length} tarea(s) sobre presupuesto`,
    description: `${overBudget.length} tarea(s) superan su costo estimado en más de 10%. Sobrecosto total: $${Math.round(totalOverrun).toLocaleString()}.`,
    action: 'Congela gastos no críticos y solicita revisión presupuestaria. Analiza si el EAC refleja este escenario.',
    affectedTasks: overBudget
      .sort((a, b) => (b.actual_cost! - b.estimated_cost!) - (a.actual_cost! - a.estimated_cost!))
      .slice(0, 5)
      .map(r => r.project_name),
  };
}

function detectCriticalPath(rows: TransformedRow[]): EarlyWarning | null {
  // Critical = 0% progress + has documented risks + end_date within 7 days
  const critical = rows.filter(r => {
    if (isDone(r.status)) return false;
    const progress = r.progress_percent || 0;
    if (progress > 0) return false;
    if (!r.risks || r.risks.trim() === '') return false;
    if (!r.end_date) return false;
    const days = daysUntil(r.end_date);
    return days >= 0 && days <= 14;
  });

  if (critical.length === 0) return null;

  return {
    type: 'CRITICAL_PATH',
    severity: 'CRITICAL',
    title: `${critical.length} tarea(s) críticas sin iniciar`,
    description: `${critical.length} tarea(s) con riesgos documentados, 0% de avance y vencen en menos de 14 días.`,
    action: 'Prioridad máxima: asigna recursos inmediatamente. Escala al sponsor del proyecto si no hay capacidad disponible.',
    affectedTasks: critical.slice(0, 5).map(r => r.project_name),
  };
}

function detectLowProgress(rows: TransformedRow[]): EarlyWarning | null {
  const total = rows.length;
  if (total < 3) return null;

  const done = rows.filter(r => isDone(r.status));
  const completionRate = (done.length / total) * 100;

  // Check if we're past halfway through the project timeline
  const withDates = rows.filter(r => r.start_date && r.end_date);
  if (withDates.length === 0) return null;

  const starts = withDates.map(r => new Date(r.start_date!).getTime());
  const ends = withDates.map(r => new Date(r.end_date!).getTime());
  const projectStart = Math.min(...starts);
  const projectEnd = Math.max(...ends);
  const totalDuration = projectEnd - projectStart;
  const elapsed = Date.now() - projectStart;
  const timePercent = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

  // Alert if time elapsed > completion rate + 20% gap
  if (timePercent > completionRate + 20 && timePercent > 30) {
    return {
      type: 'LOW_PROGRESS',
      severity: timePercent - completionRate > 40 ? 'HIGH' : 'MEDIUM',
      title: 'Progreso retrasado respecto al tiempo',
      description: `${timePercent.toFixed(0)}% del tiempo ha transcurrido pero solo se completó el ${completionRate.toFixed(0)}% del trabajo. Brecha de ${(timePercent - completionRate).toFixed(0)}%.`,
      action: 'Revisa la planificación del sprint / PI. Considera reducir alcance (scope creep) o agregar capacidad al equipo.',
      affectedTasks: [],
    };
  }

  return null;
}

// ─── public entry point ───────────────────────────────────────────────────────

export function detectWarnings(rows: TransformedRow[], metrics?: { cpi?: string; spi?: string }): EarlyWarningResult {
  const detectors = [
    detectCriticalPath,
    detectStagnant,
    detectOverdue,
    detectBudgetOverrun,
    detectNeverStarted,
    detectLowProgress,
  ];

  const warnings: EarlyWarning[] = detectors
    .map(fn => fn(rows))
    .filter((w): w is EarlyWarning => w !== null);

  const criticalCount = warnings.filter(w => w.severity === 'CRITICAL').length;
  const highCount = warnings.filter(w => w.severity === 'HIGH').length;

  let summary = 'Sin alertas activas — el proyecto está en buen estado.';
  if (criticalCount > 0) {
    summary = `⚠️ ${criticalCount} alerta(s) CRÍTICA(s) requieren acción inmediata.`;
  } else if (highCount > 0) {
    summary = `${highCount} alerta(s) de alta prioridad detectadas.`;
  } else if (warnings.length > 0) {
    summary = `${warnings.length} punto(s) de atención a revisar.`;
  }

  return { warnings, criticalCount, highCount, hasAlerts: warnings.length > 0, summary };
}
