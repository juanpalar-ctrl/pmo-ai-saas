/**
 * frameworkMetrics.ts
 * Calculates real framework-specific metrics from normalized task rows.
 * All inputs come from the Excel data uploaded by the user — no hardcoded values.
 */

export interface TransformedRow {
  project_name: string;
  status?: string | null;
  estimated_cost?: number;
  actual_cost?: number;
  progress_percent?: number;
  start_date?: string | null;
  end_date?: string | null;
  risks?: string | null;
  assignee?: string | null;
}

export interface FrameworkMetricCard {
  label: string;
  value: string;
  detail: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface FrameworkMetricsResult {
  framework: string;
  cards: FrameworkMetricCard[];
  insights: string[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const DONE_STATUSES = ['done', 'completed', 'terminado', 'finalizado', 'cerrado', 'closed', 'complete'];
const IN_PROGRESS_STATUSES = ['in progress', 'in_progress', 'en progreso', 'en curso', 'wip', 'doing', 'active'];

function isDone(status: string | null | undefined): boolean {
  return DONE_STATUSES.some(s => (status || '').toLowerCase().includes(s));
}

function isInProgress(status: string | null | undefined): boolean {
  return IN_PROGRESS_STATUSES.some(s => (status || '').toLowerCase().includes(s));
}

function daysBetween(a: string, b: string): number {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ─── Scrum ────────────────────────────────────────────────────────────────────

function calcScrum(rows: TransformedRow[]): FrameworkMetricsResult {
  const total = rows.length;
  const done = rows.filter(r => isDone(r.status));
  const completionRate = total > 0 ? (done.length / total) * 100 : 0;

  // Group into pseudo-sprints of 14-day windows from earliest start_date
  const datesValid = rows.filter(r => r.start_date && r.end_date);
  let velocity = 0;
  let sprintCount = 0;

  if (datesValid.length > 0) {
    const starts = datesValid.map(r => new Date(r.start_date!).getTime());
    const minStart = Math.min(...starts);

    // Bin tasks into 14-day sprint buckets by their end_date
    const sprintBuckets: Record<number, number> = {};
    for (const row of datesValid) {
      if (!isDone(row.status)) continue;
      const endMs = new Date(row.end_date!).getTime();
      const sprintNum = Math.floor((endMs - minStart) / (14 * 24 * 60 * 60 * 1000));
      sprintBuckets[sprintNum] = (sprintBuckets[sprintNum] || 0) + 1;
    }
    const bucketValues = Object.values(sprintBuckets);
    sprintCount = bucketValues.length;
    velocity = sprintCount > 0 ? Math.round(avg(bucketValues)) : done.length;
  } else {
    velocity = done.length;
  }

  // Team efficiency ≈ avg progress of done tasks vs planned
  const teamEfficiency = completionRate;

  const insights: string[] = [];
  if (completionRate < 70) insights.push(`Solo el ${completionRate.toFixed(0)}% de tareas completadas — revisar sprint planning`);
  if (velocity === 0) insights.push('Sin tareas cerradas aún — velocity se calculará al completar el primer sprint');
  if (sprintCount > 0) insights.push(`${sprintCount} sprint(s) detectado(s) a partir de fechas del Excel`);

  return {
    framework: 'scrum',
    cards: [
      { label: 'Velocity', value: `${velocity} tareas/sprint`, detail: `${sprintCount} sprints detectados`, trend: velocity > 0 ? 'up' : 'neutral' },
      { label: 'Sprint Completion Rate', value: `${completionRate.toFixed(1)}%`, detail: `${done.length} de ${total} tareas cerradas`, trend: completionRate >= 80 ? 'up' : completionRate >= 60 ? 'neutral' : 'down' },
      { label: 'Tareas en Sprint', value: `${total}`, detail: 'Total importadas del Excel', trend: 'neutral' },
      { label: 'Team Efficiency', value: `${teamEfficiency.toFixed(1)}%`, detail: 'Basado en tasa de cierre', trend: teamEfficiency >= 80 ? 'up' : 'down' },
    ],
    insights,
  };
}

// ─── Kanban ───────────────────────────────────────────────────────────────────

function calcKanban(rows: TransformedRow[]): FrameworkMetricsResult {
  const doneTasks = rows.filter(r => isDone(r.status) && r.start_date && r.end_date);
  const inProgressTasks = rows.filter(r => isInProgress(r.status));

  // Cycle Time = avg days from start to end for done tasks
  const cycleTimes = doneTasks.map(r => Math.max(0, daysBetween(r.start_date!, r.end_date!)));
  const avgCycleTime = cycleTimes.length > 0 ? avg(cycleTimes) : 0;

  // Lead Time = elapsed days across the whole dataset (earliest start → latest end)
  const allDatesValid = rows.filter(r => r.start_date && r.end_date);
  let avgLeadTime = 0;
  if (allDatesValid.length > 0) {
    const leadTimes = allDatesValid.map(r => Math.max(0, daysBetween(r.start_date!, r.end_date!)));
    avgLeadTime = avg(leadTimes);
  }

  const wip = inProgressTasks.length;

  // Throughput = done tasks / total elapsed weeks
  let throughput = 0;
  if (allDatesValid.length > 0) {
    const starts = allDatesValid.map(r => new Date(r.start_date!).getTime());
    const ends = allDatesValid.map(r => new Date(r.end_date!).getTime());
    const elapsedWeeks = Math.max(1, (Math.max(...ends) - Math.min(...starts)) / (7 * 24 * 60 * 60 * 1000));
    throughput = doneTasks.length / elapsedWeeks;
  }

  // Flow Efficiency ≈ avg progress of in-progress items
  const inProgressProgress = inProgressTasks.map(r => r.progress_percent || 0);
  const flowEfficiency = inProgressProgress.length > 0 ? avg(inProgressProgress) : 0;

  const insights: string[] = [];
  if (wip > 10) insights.push(`WIP alto (${wip} tareas activas) — riesgo de cuello de botella`);
  if (avgCycleTime > 10) insights.push(`Cycle Time elevado (${avgCycleTime.toFixed(1)} días) — revisar bloqueos`);
  if (throughput > 0) insights.push(`Throughput: ${throughput.toFixed(1)} tareas/semana`);

  return {
    framework: 'kanban',
    cards: [
      { label: 'Cycle Time', value: avgCycleTime > 0 ? `${avgCycleTime.toFixed(1)} días` : 'N/A', detail: `${doneTasks.length} tareas completadas`, trend: avgCycleTime <= 7 ? 'up' : avgCycleTime <= 14 ? 'neutral' : 'down' },
      { label: 'Lead Time', value: avgLeadTime > 0 ? `${avgLeadTime.toFixed(1)} días` : 'N/A', detail: 'Inicio → Fin promedio', trend: avgLeadTime <= 14 ? 'up' : 'down' },
      { label: 'WIP Actual', value: `${wip} tareas`, detail: 'En progreso ahora', trend: wip <= 10 ? 'up' : 'down' },
      { label: 'Flow Efficiency', value: `${flowEfficiency.toFixed(1)}%`, detail: 'Avance promedio de items activos', trend: flowEfficiency >= 60 ? 'up' : 'neutral' },
    ],
    insights,
  };
}

// ─── SAFe ─────────────────────────────────────────────────────────────────────

function calcSafe(rows: TransformedRow[]): FrameworkMetricsResult {
  const total = rows.length;
  const done = rows.filter(r => isDone(r.status));
  const inProgress = rows.filter(r => isInProgress(r.status));

  // PPM = Business Value Realizado / Business Value Planificado * 100
  // Proxy: avg progress_percent / 100
  const progValues = rows.map(r => r.progress_percent || 0);
  const avgProgress = avg(progValues);
  const ppm = avgProgress; // already 0–100

  // Flow Load = all active features (in-progress + backlog)
  const notStarted = rows.filter(r => !isDone(r.status) && !isInProgress(r.status));
  const flowLoad = inProgress.length + notStarted.length;

  // Teams proxy: assume ~8 tasks per team
  const estimatedTeams = Math.max(1, Math.round(total / 8));

  // PI Success Rate = done / total
  const piSuccess = total > 0 ? (done.length / total) * 100 : 0;

  const insights: string[] = [];
  if (ppm < 80) insights.push(`PPM ${ppm.toFixed(0)}% — por debajo del umbral ART recomendado (80%)`);
  if (flowLoad > 20) insights.push(`Flow Load alto (${flowLoad} features activas) — riesgo de saturación del ART`);
  insights.push(`${estimatedTeams} equipo(s) estimado(s) basado en carga de trabajo`);

  return {
    framework: 'safe',
    cards: [
      { label: 'PPM (Program Predictability)', value: `${ppm.toFixed(1)}%`, detail: 'Business Value realizado/planificado', trend: ppm >= 80 ? 'up' : ppm >= 60 ? 'neutral' : 'down' },
      { label: 'Flow Load', value: `${flowLoad} features`, detail: `${inProgress.length} activas · ${notStarted.length} backlog`, trend: flowLoad <= 20 ? 'up' : 'down' },
      { label: 'Equipos (estimado)', value: `${estimatedTeams}`, detail: `${total} tareas / ~8 por equipo`, trend: 'neutral' },
      { label: 'PI Success Rate', value: `${piSuccess.toFixed(1)}%`, detail: `${done.length} objetivos cumplidos`, trend: piSuccess >= 80 ? 'up' : 'down' },
    ],
    insights,
  };
}

// ─── Waterfall ────────────────────────────────────────────────────────────────

function calcWaterfall(rows: TransformedRow[]): FrameworkMetricsResult {
  const total = rows.length;
  const done = rows.filter(r => isDone(r.status));
  const today = new Date();

  // Delayed tasks = past end_date and not done
  const delayed = rows.filter(r => {
    if (isDone(r.status)) return false;
    if (!r.end_date) return false;
    return new Date(r.end_date) < today;
  });

  // Schedule adherence = non-delayed tasks / total
  const adherence = total > 0 ? ((total - delayed.length) / total) * 100 : 100;

  // Phase completion: group by status label → count
  const phaseCounts: Record<string, number> = {};
  for (const row of rows) {
    const s = (row.status || 'Sin estado').trim();
    phaseCounts[s] = (phaseCounts[s] || 0) + 1;
  }
  const topPhase = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0];

  // Average days overdue for delayed tasks
  const overdues = delayed
    .filter(r => r.end_date)
    .map(r => daysBetween(r.end_date!, today.toISOString()));
  const avgOverdue = overdues.length > 0 ? avg(overdues) : 0;

  // Critical path proxy: tasks with 0% progress that block others (have dependencies implied by risk field)
  const criticalRisk = rows.filter(r => (r.progress_percent || 0) === 0 && r.risks && r.risks.trim() !== '');

  const insights: string[] = [];
  if (delayed.length > 0) insights.push(`${delayed.length} tarea(s) atrasada(s) — promedio ${avgOverdue.toFixed(0)} días de retraso`);
  if (criticalRisk.length > 0) insights.push(`${criticalRisk.length} tarea(s) en ruta crítica con 0% avance y riesgos documentados`);
  if (adherence >= 90) insights.push('Adherencia al cronograma excelente (≥90%)');

  return {
    framework: 'waterfall',
    cards: [
      { label: 'Fases Completadas', value: `${done.length} / ${total}`, detail: `${((done.length / Math.max(total, 1)) * 100).toFixed(0)}% del proyecto`, trend: done.length / Math.max(total, 1) >= 0.5 ? 'up' : 'neutral' },
      { label: 'Tareas Atrasadas', value: `${delayed.length}`, detail: delayed.length > 0 ? `Avg ${avgOverdue.toFixed(0)} días fuera de fecha` : 'Todas en tiempo', trend: delayed.length === 0 ? 'up' : 'down' },
      { label: 'Adherencia al Plan', value: `${adherence.toFixed(1)}%`, detail: `${total - delayed.length} tareas en tiempo`, trend: adherence >= 80 ? 'up' : 'down' },
      { label: 'Ruta Crítica', value: `${criticalRisk.length} tareas`, detail: '0% avance con riesgos activos', trend: criticalRisk.length === 0 ? 'up' : 'down' },
    ],
    insights,
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function calculateFrameworkMetrics(
  rows: TransformedRow[],
  framework: string
): FrameworkMetricsResult {
  if (rows.length === 0) {
    return { framework, cards: [], insights: ['Sin datos de tareas disponibles'] };
  }

  switch (framework.toLowerCase()) {
    case 'scrum':     return calcScrum(rows);
    case 'kanban':    return calcKanban(rows);
    case 'safe':      return calcSafe(rows);
    case 'waterfall': return calcWaterfall(rows);
    default:          return calcScrum(rows);
  }
}
