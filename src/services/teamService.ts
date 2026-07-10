/**
 * teamService.ts
 * Data access + business logic for the team board (Hito 5: auto-populate,
 * feedback log, wellbeing scoring, disconnection semaphore).
 * Inline pool.query, same convention as ai_analyses elsewhere in this repo
 * (no dedicated repository class for that table either).
 */

import { pool } from '../db';
import { serviceLogger } from '../core/logger';
import { TransformedRow } from './frameworkMetrics';
import {
  countCriticalDelayedTasks,
  countActiveTasks,
  countOverdueTasks,
  computeWorkloadLevel,
  computePeopleHealthLevel,
  computeOverallLevel,
  daysSinceFeedback,
  HealthLevel,
  PeopleHealthLevel,
} from './teamAlerts';
import { wellbeingAgent } from '../agents/wellbeingAgent';

const DONE_STATUSES = ['done', 'completed', 'terminado', 'finalizado', 'cerrado', 'closed', 'complete'];
const isDone = (s?: string | null) => DONE_STATUSES.some(k => (s || '').toLowerCase().includes(k));

// Carga de trabajo — derived purely from tasks.
export interface TeamMemberWorkload {
  activeCount: number;
  overdueCount: number;
  criticalDelayedCount: number;
  teamAvgActive: number; // project-wide average active load, for the "sobrecarga" comparison
  level: HealthLevel;
}

// People health — derived purely from feedback.
export interface TeamMemberPeopleHealth {
  wellbeingScore: number | null;
  lastFeedbackAt: string | null;
  daysSinceFeedback: number | null;
  sentiment: string | null;
  level: PeopleHealthLevel;
}

export interface TeamMemberCard {
  id: number;
  name: string;
  role: string | null;
  currentTasks: string[];
  workload: TeamMemberWorkload;
  peopleHealth: TeamMemberPeopleHealth;
  overallLevel: HealthLevel; // combined roll-up = worst of the two axes
}

export interface DisconnectionAlert {
  name: string;
  level: HealthLevel;
  daysSinceContact: number | null;
  criticalDelayedCount: number;
}

export interface TeamProjectGroup {
  projectId: number; // project_data.id — matches the :projectId convention used by /api/team/:projectId
  projectName: string;
  groupSatisfactionScore: number | null;
  members: TeamMemberCard[];
}

/**
 * Feature 5.1 — extracts distinct assignee names from the normalized task
 * rows and upserts them as team members. Called right after upload; safe to
 * re-run (ON CONFLICT DO NOTHING against the case-insensitive unique index).
 */
// The "assignee" field comes from whatever Excel column the user mapped to
// it during upload — nothing guarantees that column actually holds person
// names. Column mismatches (e.g. mapping a "resources" breakdown column
// instead of "Responsable") produce JSON blobs here; reject anything that
// doesn't plausibly look like a name rather than polluting the team board.
function looksLikePersonName(value: string): boolean {
  if (value.length === 0 || value.length > 100) return false;
  if (/^[[{]/.test(value)) return false;
  return true;
}

async function autoPopulateTeam(projectId: number, userId: string, taskRows: TransformedRow[]): Promise<void> {
  const names = new Set<string>();
  for (const row of taskRows) {
    const name = (row.assignee || '').trim();
    if (name && looksLikePersonName(name)) names.add(name);
  }

  for (const name of names) {
    try {
      await pool.query(
        `INSERT INTO team_members (project_id, user_id, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, lower(name)) DO NOTHING`,
        [projectId, userId, name]
      );
    } catch (error: any) {
      serviceLogger.error({ err: error.message, projectId, name }, 'Failed to auto-populate team member');
    }
  }
}

/**
 * Feature 5.1 + 5.3 — team board: one card per member with current tasks,
 * wellbeing score and disconnection semaphore, plus the aggregate GSS
 * (Feature 5.2 formula: average of individual scores * 100).
 */
async function getTeamBoard(
  projectId: number,
  userId: string,
  taskRows: TransformedRow[]
): Promise<{ members: TeamMemberCard[]; groupSatisfactionScore: number | null }> {
  // Scoped by user_id as well as project_id: the business projectid is not
  // globally unique across tenants (append-only history, same collision class
  // that was closed on ai_analyses), so filtering by project_id alone could
  // surface another user's team members.
  const result = await pool.query(
    `SELECT id, name, role, last_feedback_at, latest_wellbeing_score, latest_sentiment
     FROM team_members WHERE project_id = $1 AND user_id = $2 ORDER BY name ASC`,
    [projectId, userId]
  );

  // First pass: raw per-member counts. We need the team-wide average active
  // load before we can decide each member's *relative* workload level.
  const interim = result.rows.map((row) => {
    const activeCount = countActiveTasks(taskRows, row.name);
    const overdueCount = countOverdueTasks(taskRows, row.name);
    const criticalDelayedCount = countCriticalDelayedTasks(taskRows, row.name);
    const lastFeedbackAt: Date | null = row.last_feedback_at ? new Date(row.last_feedback_at) : null;
    const target = row.name.trim().toLowerCase();
    const currentTasks = taskRows
      .filter((t) => (t.assignee || '').trim().toLowerCase() === target && !isDone(t.status))
      .slice(0, 5)
      .map((t) => t.project_name);
    const wellbeingScore = row.latest_wellbeing_score !== null ? parseFloat(row.latest_wellbeing_score) : null;
    return { row, activeCount, overdueCount, criticalDelayedCount, lastFeedbackAt, currentTasks, wellbeingScore };
  });

  const teamAvgActive =
    interim.length > 0 ? interim.reduce((sum, m) => sum + m.activeCount, 0) / interim.length : 0;

  const members: TeamMemberCard[] = interim.map((m) => {
    const workloadLevel = computeWorkloadLevel({
      activeCount: m.activeCount,
      overdueCount: m.overdueCount,
      criticalDelayedCount: m.criticalDelayedCount,
      teamAvgActive,
    });
    const days = daysSinceFeedback(m.lastFeedbackAt);
    const peopleHealthLevel = computePeopleHealthLevel({ wellbeingScore: m.wellbeingScore, daysSinceFeedback: days });

    return {
      id: m.row.id,
      name: m.row.name,
      role: m.row.role,
      currentTasks: m.currentTasks,
      workload: {
        activeCount: m.activeCount,
        overdueCount: m.overdueCount,
        criticalDelayedCount: m.criticalDelayedCount,
        teamAvgActive: Math.round(teamAvgActive),
        level: workloadLevel,
      },
      peopleHealth: {
        wellbeingScore: m.wellbeingScore,
        lastFeedbackAt: m.lastFeedbackAt ? m.lastFeedbackAt.toISOString() : null,
        daysSinceFeedback: isFinite(days) ? days : null,
        sentiment: m.row.latest_sentiment ?? null,
        level: peopleHealthLevel,
      },
      overallLevel: computeOverallLevel(workloadLevel, peopleHealthLevel),
    };
  });

  const scored = members.filter((m) => m.peopleHealth.wellbeingScore !== null);
  const groupSatisfactionScore =
    scored.length > 0
      ? Math.round((scored.reduce((sum, m) => sum + (m.peopleHealth.wellbeingScore as number), 0) / scored.length) * 100)
      : null;

  return { members, groupSatisfactionScore };
}

async function fetchTaskRowsForProject(realProjectId: number, userId: string): Promise<TransformedRow[]> {
  const result = await pool.query(
    `SELECT output FROM ai_analyses
     WHERE projectid = $1 AND user_id = $2 AND agenttype = 'normalization'
     ORDER BY generatedat DESC LIMIT 1`,
    [realProjectId, userId]
  );
  return result.rows[0]?.output?.projects || [];
}

/**
 * Team Morale (portfolio-wide) — same per-member computation as getTeamBoard,
 * fanned out across every project of the user that has team members, plus an
 * overall GSS across all of them. Backs GET /api/team (no projectId), used
 * when the Team Morale page is opened from the portfolio rather than from a
 * single project.
 */
async function getTeamBoardsForUser(
  userId: string
): Promise<{ groupSatisfactionScore: number | null; projects: TeamProjectGroup[] }> {
  const projectRows = await pool.query(
    `SELECT DISTINCT pd.id AS project_data_id, pd.projectid, pd.projectname
     FROM team_members tm
     JOIN project_data pd ON pd.projectid = tm.project_id
     WHERE tm.user_id = $1
     ORDER BY pd.projectname ASC
     LIMIT 50`,
    [userId]
  );

  const projects: TeamProjectGroup[] = [];
  for (const row of projectRows.rows) {
    const taskRows = await fetchTaskRowsForProject(row.projectid, userId);
    const { members, groupSatisfactionScore } = await getTeamBoard(row.projectid, userId, taskRows);
    if (members.length === 0) continue;
    projects.push({
      projectId: row.project_data_id,
      projectName: row.projectname,
      groupSatisfactionScore,
      members,
    });
  }

  const allScored = projects.flatMap((p) => p.members).filter((m) => m.peopleHealth.wellbeingScore !== null);
  const groupSatisfactionScore =
    allScored.length > 0
      ? Math.round((allScored.reduce((sum, m) => sum + (m.peopleHealth.wellbeingScore as number), 0) / allScored.length) * 100)
      : null;

  return { groupSatisfactionScore, projects };
}

/**
 * Feature 5.2 — analyzes a 1-on-1 note with wellbeingAgent, logs it, and
 * refreshes the member's denormalized last_feedback_at/latest_wellbeing_score.
 */
async function addFeedbackNote(
  teamMemberId: number,
  projectId: number,
  userId: string,
  noteText: string,
  lang?: 'es' | 'en'
): Promise<{ wellbeingScore: number; sentiment: string; reasoning: string }> {
  const memberResult = await pool.query(
    `SELECT id, name FROM team_members WHERE id = $1 AND project_id = $2 AND user_id = $3`,
    [teamMemberId, projectId, userId]
  );
  if (memberResult.rows.length === 0) {
    throw new Error('Miembro de equipo no encontrado');
  }
  const member = memberResult.rows[0];

  const output: any = await wellbeingAgent.analyze({
    projectId,
    projectName: member.name,
    noteText,
    lang,
  });
  const { wellbeingScore, sentiment, reasoning } = output.analysis;

  await pool.query(
    `INSERT INTO team_feedback_notes (team_member_id, note_text, wellbeing_score, sentiment, ai_reasoning)
     VALUES ($1, $2, $3, $4, $5)`,
    [teamMemberId, noteText, wellbeingScore, sentiment, reasoning]
  );

  await pool.query(
    `UPDATE team_members SET last_feedback_at = NOW(), latest_wellbeing_score = $1, latest_sentiment = $2, updated_at = NOW() WHERE id = $3`,
    [wellbeingScore, sentiment, teamMemberId]
  );

  return { wellbeingScore, sentiment, reasoning };
}

async function getFeedbackNotes(teamMemberId: number, projectId: number, userId: string) {
  const memberResult = await pool.query(
    `SELECT id FROM team_members WHERE id = $1 AND project_id = $2 AND user_id = $3`,
    [teamMemberId, projectId, userId]
  );
  if (memberResult.rows.length === 0) {
    throw new Error('Miembro de equipo no encontrado');
  }

  const result = await pool.query(
    `SELECT id, note_text, wellbeing_score, sentiment, ai_reasoning, created_at
     FROM team_feedback_notes WHERE team_member_id = $1 ORDER BY created_at DESC`,
    [teamMemberId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    noteText: row.note_text,
    wellbeingScore: row.wellbeing_score !== null ? parseFloat(row.wellbeing_score) : null,
    sentiment: row.sentiment ?? null,
    reasoning: row.ai_reasoning,
    createdAt: row.created_at,
  }));
}

/**
 * Manual resource management — lets the user add a team member who wasn't in
 * the uploaded file (or remove one). Complements autoPopulateTeam: same table,
 * same case-insensitive uniqueness (idx_team_members_project_name_ci).
 */
async function createMember(
  projectId: number,
  userId: string,
  name: string,
  role?: string | null
): Promise<{ id: number; name: string; role: string | null }> {
  try {
    const result = await pool.query(
      `INSERT INTO team_members (project_id, user_id, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, role`,
      [projectId, userId, name, role?.trim() || null]
    );
    return result.rows[0];
  } catch (error: any) {
    // 23505 = unique_violation against the (project_id, lower(name)) index.
    if (error.code === '23505') {
      throw new Error('Ya existe un recurso con ese nombre en el proyecto');
    }
    throw error;
  }
}

/**
 * Hard-deletes a team member (and, via ON DELETE CASCADE, their feedback notes).
 * Scoped by project_id + user_id so it can't touch another tenant's row.
 * Note: a member auto-populated from the "assignee" column will re-appear on the
 * next upload of that same file — manual delete is permanent only for people not
 * present in the source data.
 */
async function deleteMember(teamMemberId: number, projectId: number, userId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM team_members WHERE id = $1 AND project_id = $2 AND user_id = $3`,
    [teamMemberId, projectId, userId]
  );
  if (result.rowCount === 0) {
    throw new Error('Miembro de equipo no encontrado');
  }
}

async function updateMemberRole(teamMemberId: number, projectId: number, userId: string, role: string): Promise<void> {
  const result = await pool.query(
    `UPDATE team_members SET role = $1, updated_at = NOW() WHERE id = $2 AND project_id = $3 AND user_id = $4`,
    [role, teamMemberId, projectId, userId]
  );
  if (result.rowCount === 0) {
    throw new Error('Miembro de equipo no encontrado');
  }
}

/**
 * Feature 5.3 — only non-green members (by the combined overallLevel), reduced
 * shape, meant to be injected into the Risk Agent prompt (multiAgentOrchestrator.ts).
 */
async function getDisconnectionAlertsForRiskAgent(
  projectId: number,
  userId: string,
  taskRows: TransformedRow[]
): Promise<DisconnectionAlert[]> {
  const { members } = await getTeamBoard(projectId, userId, taskRows);
  return members
    .filter((m) => m.overallLevel !== 'green')
    .map((m) => ({
      name: m.name,
      level: m.overallLevel,
      daysSinceContact: m.peopleHealth.daysSinceFeedback,
      criticalDelayedCount: m.workload.criticalDelayedCount,
    }));
}

export const teamService = {
  autoPopulateTeam,
  getTeamBoard,
  getTeamBoardsForUser,
  addFeedbackNote,
  getFeedbackNotes,
  createMember,
  deleteMember,
  updateMemberRole,
  getDisconnectionAlertsForRiskAgent,
};
