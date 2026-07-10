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
import { countCriticalDelayedTasks, computeDisconnectionLevel, daysSinceFeedback, DisconnectionLevel } from './teamAlerts';
import { wellbeingAgent } from '../agents/wellbeingAgent';

const DONE_STATUSES = ['done', 'completed', 'terminado', 'finalizado', 'cerrado', 'closed', 'complete'];
const isDone = (s?: string | null) => DONE_STATUSES.some(k => (s || '').toLowerCase().includes(k));

export interface TeamMemberCard {
  id: number;
  name: string;
  role: string | null;
  currentTasks: string[];
  lastFeedbackAt: string | null;
  latestWellbeingScore: number | null;
  disconnectionLevel: DisconnectionLevel;
  criticalDelayedCount: number;
}

export interface DisconnectionAlert {
  name: string;
  level: DisconnectionLevel;
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
  taskRows: TransformedRow[]
): Promise<{ members: TeamMemberCard[]; groupSatisfactionScore: number | null }> {
  const result = await pool.query(
    `SELECT id, name, role, last_feedback_at, latest_wellbeing_score
     FROM team_members WHERE project_id = $1 ORDER BY name ASC`,
    [projectId]
  );

  const members: TeamMemberCard[] = result.rows.map((row) => {
    const criticalDelayedCount = countCriticalDelayedTasks(taskRows, row.name);
    const lastFeedbackAt: Date | null = row.last_feedback_at ? new Date(row.last_feedback_at) : null;
    const disconnectionLevel = computeDisconnectionLevel(lastFeedbackAt, criticalDelayedCount);
    const target = row.name.trim().toLowerCase();
    const currentTasks = taskRows
      .filter((t) => (t.assignee || '').trim().toLowerCase() === target && !isDone(t.status))
      .slice(0, 5)
      .map((t) => t.project_name);

    return {
      id: row.id,
      name: row.name,
      role: row.role,
      currentTasks,
      lastFeedbackAt: lastFeedbackAt ? lastFeedbackAt.toISOString() : null,
      latestWellbeingScore: row.latest_wellbeing_score !== null ? parseFloat(row.latest_wellbeing_score) : null,
      disconnectionLevel,
      criticalDelayedCount,
    };
  });

  const scored = members.filter((m) => m.latestWellbeingScore !== null);
  const groupSatisfactionScore =
    scored.length > 0
      ? Math.round((scored.reduce((sum, m) => sum + (m.latestWellbeingScore as number), 0) / scored.length) * 100)
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
    const { members, groupSatisfactionScore } = await getTeamBoard(row.projectid, taskRows);
    if (members.length === 0) continue;
    projects.push({
      projectId: row.project_data_id,
      projectName: row.projectname,
      groupSatisfactionScore,
      members,
    });
  }

  const allScored = projects.flatMap((p) => p.members).filter((m) => m.latestWellbeingScore !== null);
  const groupSatisfactionScore =
    allScored.length > 0
      ? Math.round((allScored.reduce((sum, m) => sum + (m.latestWellbeingScore as number), 0) / allScored.length) * 100)
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
    `INSERT INTO team_feedback_notes (team_member_id, note_text, wellbeing_score, ai_reasoning)
     VALUES ($1, $2, $3, $4)`,
    [teamMemberId, noteText, wellbeingScore, reasoning]
  );

  await pool.query(
    `UPDATE team_members SET last_feedback_at = NOW(), latest_wellbeing_score = $1, updated_at = NOW() WHERE id = $2`,
    [wellbeingScore, teamMemberId]
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
    `SELECT id, note_text, wellbeing_score, ai_reasoning, created_at
     FROM team_feedback_notes WHERE team_member_id = $1 ORDER BY created_at DESC`,
    [teamMemberId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    noteText: row.note_text,
    wellbeingScore: row.wellbeing_score !== null ? parseFloat(row.wellbeing_score) : null,
    reasoning: row.ai_reasoning,
    createdAt: row.created_at,
  }));
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
 * Feature 5.3 — only orange/red members, reduced shape, meant to be injected
 * into the Risk Agent prompt (multiAgentOrchestrator.ts).
 */
async function getDisconnectionAlertsForRiskAgent(
  projectId: number,
  taskRows: TransformedRow[]
): Promise<DisconnectionAlert[]> {
  const { members } = await getTeamBoard(projectId, taskRows);
  return members
    .filter((m) => m.disconnectionLevel !== 'green')
    .map((m) => ({
      name: m.name,
      level: m.disconnectionLevel,
      daysSinceContact: m.lastFeedbackAt ? daysSinceFeedback(new Date(m.lastFeedbackAt)) : null,
      criticalDelayedCount: m.criticalDelayedCount,
    }));
}

export const teamService = {
  autoPopulateTeam,
  getTeamBoard,
  getTeamBoardsForUser,
  addFeedbackNote,
  getFeedbackNotes,
  updateMemberRole,
  getDisconnectionAlertsForRiskAgent,
};
