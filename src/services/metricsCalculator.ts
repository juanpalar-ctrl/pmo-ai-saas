/**
 * src/services/metricsCalculator.ts
 * Calculate project metrics with zero-division protection.
 * Phase 2: Added division-by-zero safeguards and audit logging.
 */

import { pool } from '../db';
import { METRICS_MESSAGES } from '../config/messages';

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

  // Extract values safely with defaults
  const totalPlannedCost = parseFloat(budgetData.totalBudget) || 100000;
  const totalActualCost = parseFloat(budgetData.spent) || 50000;
  const totalWork = parseFloat(workData.total) || 100;
  const completedWork = parseFloat(workData.completed) || 50;

  const percentComplete = (completedWork / totalWork) * 100;

  // EVM CALCULATIONS - PV based on time, not progress
  const daysElapsed = project.timelinedata?.daysElapsed || 0;
  const daysTotal = (project.timelinedata?.daysRemaining || 0) + daysElapsed;
  const planPercent = daysTotal > 0 ? (daysElapsed / daysTotal) * 100 : 0;
  const pv = (planPercent / 100) * totalPlannedCost;
  const ev = (completedWork / totalWork) * totalPlannedCost;
  const ac = totalActualCost;
  const cv = ev - ac;

  /**
   * CRITICAL: Division by zero protection for SPI and CPI
   * If PV or AC are zero, return 1.00 by default
   * Log warning for audit trail
   */
  let cpi = 1.0;
  let spi = 1.0;

  // CPI = EV / AC (Cost Performance Index)
  if (ac > 0) {
    cpi = ev / ac;
  } else {
    console.warn(
      `⚠️ ${METRICS_MESSAGES.ZERO_VALUE_WARNING} (AC=0 for projectId=${projectId})`
    );
  }

  // SPI = EV / PV (Schedule Performance Index)
  if (pv > 0) {
    spi = ev / pv;
  } else {
    console.warn(
      `⚠️ ${METRICS_MESSAGES.ZERO_VALUE_WARNING} (PV=0 for projectId=${projectId})`
    );
  }

  // ROI = (EV - AC) / AC * 100
  let roi = 0;
  if (ac > 0) {
    roi = ((ev - ac) / ac) * 100;
  } else {
    console.warn(
      `⚠️ ${METRICS_MESSAGES.ZERO_VALUE_WARNING} (AC=0, ROI defaulting to 0 for projectId=${projectId})`
    );
  }

  // BAC = Budget at Completion (total planned cost baseline)
  const bac = totalPlannedCost;

  // EAC = Estimate at Completion = BAC / CPI
  const eac = cpi > 0 ? bac / cpi : bac;

  // VAC = Variance at Completion = BAC - EAC (negative = over budget forecast)
  const vac = bac - eac;

  // SV = Schedule Variance = EV - PV
  const sv = ev - pv;

  // TCPI = To-Complete Performance Index = (BAC - EV) / (BAC - AC)
  let tcpi = 1.0;
  const tcpiDenominator = bac - ac;
  if (tcpiDenominator > 0) {
    tcpi = (bac - ev) / tcpiDenominator;
  }

  return {
    projectId,
    projectName: project.projectname || 'Project',
    framework,
    bac: bac.toFixed(2),
    pv: pv.toFixed(2),
    ev: ev.toFixed(2),
    ac: ac.toFixed(2),
    cv: cv.toFixed(2),
    sv: sv.toFixed(2),
    cpi: cpi.toFixed(2),
    spi: spi.toFixed(2),
    eac: eac.toFixed(2),
    vac: vac.toFixed(2),
    tcpi: tcpi.toFixed(2),
    roi: roi.toFixed(2),
    percentComplete: percentComplete.toFixed(1),
    projectData: JSON.stringify({
      planned: totalPlannedCost,
      spent: totalActualCost,
      percentComplete: percentComplete
    })
  };
}
