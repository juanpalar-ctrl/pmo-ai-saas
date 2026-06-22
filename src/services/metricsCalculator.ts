import { pool } from '../db';

export async function calculateProjectMetrics(projectId: number, framework: string) {
  const projectRes = await pool.query(
    `SELECT * FROM project_data WHERE projectid = $1`,
    [projectId]
  );

  if (projectRes.rows.length === 0) {
    throw new Error('Project not found');
  }

  const project = projectRes.rows[0];
  const budgetData = project.budgetdata || {};
  const workData = project.workpendingdata || {};

  // Extraer valores correctamente
  const totalPlannedCost = parseFloat(budgetData.planned) || 100000;
  const totalActualCost = parseFloat(budgetData.spent) || 50000;
  const totalWork = parseFloat(workData.total) || 100;
  const completedWork = parseFloat(workData.completed) || 50;

  const percentComplete = (completedWork / totalWork) * 100;

  // EVM CALCULATIONS
  const pv = (percentComplete / 100) * totalPlannedCost;
  const ev = (completedWork / totalWork) * totalPlannedCost;
  const ac = totalActualCost;
  const cv = ev - ac;
  const cpi = ac > 0 ? ev / ac : 1;
  const spi = pv > 0 ? ev / pv : 1;
  const roi = ac > 0 ? ((ev - ac) / ac) * 100 : 0;

  return {
    projectId,
    projectName: project.projectname || 'Project',
    framework,
    pv: pv.toFixed(2),
    ev: ev.toFixed(2),
    ac: ac.toFixed(2),
    cv: cv.toFixed(2),
    cpi: cpi.toFixed(2),
    spi: spi.toFixed(2),
    roi: roi.toFixed(2),
    percentComplete: percentComplete.toFixed(1),
    projectData: JSON.stringify({
      planned: totalPlannedCost,
      spent: totalActualCost,
      percentComplete: percentComplete
    })
  };
}
