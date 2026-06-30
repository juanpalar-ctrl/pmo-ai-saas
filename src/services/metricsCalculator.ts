import { pool } from '../db';

export async function calculateProjectMetrics(projectId: number, framework: string) {
  // Load project name
  const projectRes = await pool.query(
    `SELECT projectname FROM project_data WHERE projectid = $1`,
    [projectId]
  );
  if (projectRes.rows.length === 0) throw new Error('Project not found');
  const projectName = projectRes.rows[0].projectname || 'Project';

  // Load task rows from normalization record
  const normRes = await pool.query(
    `SELECT output FROM ai_analyses WHERE projectid = $1 AND agenttype = 'normalization' LIMIT 1`,
    [projectId]
  );

  const tasks: any[] = normRes.rows[0]?.output?.projects || [];

  // ── Aggregate from tasks ─────────────────────────────────────
  let totalPlanned = 0;
  let totalActual = 0;
  let totalTasks = tasks.length || 1;
  let completedTasks = 0;
  let weightedProgress = 0;
  let earliestStart: Date | null = null;
  let latestEnd: Date | null = null;

  for (const t of tasks) {
    const planned = parseFloat(t.estimated_cost) || 0;
    const actual  = parseFloat(t.actual_cost)    || 0;
    const pct     = parseFloat(t.progress_percent) || 0;

    totalPlanned += planned;
    totalActual  += actual;
    weightedProgress += pct;

    const isDone = (t.status || '').toLowerCase().replace(/\s/g, '') in
      { done: 1, completado: 1, completed: 1, cerrado: 1, closed: 1, finished: 1 };
    if (isDone || pct >= 100) completedTasks++;

    if (t.start_date) {
      const s = new Date(t.start_date);
      if (!isNaN(s.getTime()) && (!earliestStart || s < earliestStart)) earliestStart = s;
    }
    if (t.end_date) {
      const e = new Date(t.end_date);
      if (!isNaN(e.getTime()) && (!latestEnd || e > latestEnd)) latestEnd = e;
    }
  }

  // Use task sums if available, otherwise fall back to safe defaults
  const bac = totalPlanned > 0 ? totalPlanned : 100000;
  const ac  = totalActual  > 0 ? totalActual  : 0;
  const percentComplete = totalTasks > 0 ? weightedProgress / totalTasks : 0;

  // Timeline
  const now = new Date();
  const start = earliestStart || now;
  const end   = latestEnd    || new Date(now.getTime() + 30 * 86400000);
  const totalDays   = Math.max(1, (end.getTime()   - start.getTime()) / 86400000);
  const elapsedDays = Math.max(0, (now.getTime()   - start.getTime()) / 86400000);
  const daysRemaining = Math.max(0, (end.getTime() - now.getTime())   / 86400000);

  const planPercent = Math.min(100, (elapsedDays / totalDays) * 100);

  // EVM
  const pv = (planPercent / 100) * bac;
  const ev = (percentComplete / 100) * bac;
  const cv = ev - ac;
  const sv = ev - pv;

  const cpi  = ac   > 0 ? ev / ac   : 1.0;
  const spi  = pv   > 0 ? ev / pv   : 1.0;
  const eac  = cpi  > 0 ? bac / cpi : bac;
  const vac  = bac - eac;
  const roi  = ac   > 0 ? ((ev - ac) / ac) * 100 : 0;
  const tcpi = (bac - ac) > 0 ? (bac - ev) / (bac - ac) : 1.0;

  return {
    projectId,
    projectName,
    framework,
    bac:            bac.toFixed(2),
    pv:             pv.toFixed(2),
    ev:             ev.toFixed(2),
    ac:             ac.toFixed(2),
    cv:             cv.toFixed(2),
    sv:             sv.toFixed(2),
    cpi:            cpi.toFixed(2),
    spi:            spi.toFixed(2),
    eac:            eac.toFixed(2),
    vac:            vac.toFixed(2),
    tcpi:           tcpi.toFixed(2),
    roi:            roi.toFixed(2),
    percentComplete: percentComplete.toFixed(1),
    daysRemaining:   Math.round(daysRemaining),
    projectData: JSON.stringify({ planned: bac, spent: ac, percentComplete }),
  };
}
