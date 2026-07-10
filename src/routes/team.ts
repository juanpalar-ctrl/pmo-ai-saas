import express, { Request, Response } from 'express';
import { pool } from '../db';
import { routeLogger } from '../core/logger';
import { AuthRequest } from '../middleware/requireAuth';
import { ProjectIdParamSchema, TeamFeedbackSchema, TeamRoleSchema } from '../config/validation';
import { teamService } from '../services/teamService';

const router = express.Router();

// :projectId in this router is project_data.id (same convention as
// /api/data/analysis/:projectId/tasks), not the business projectid.
async function resolveRealProjectId(projectId: number, userId: string): Promise<number | null> {
  const result = await pool.query(
    `SELECT projectid FROM project_data WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return result.rows.length > 0 ? result.rows[0].projectid : null;
}

async function resolveProject(projectId: number, userId: string): Promise<{ realProjectId: number; projectName: string } | null> {
  const result = await pool.query(
    `SELECT projectid, projectname FROM project_data WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  if (result.rows.length === 0) return null;
  return { realProjectId: result.rows[0].projectid, projectName: result.rows[0].projectname };
}

async function fetchTaskRows(realProjectId: number, userId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT output FROM ai_analyses
     WHERE projectid = $1 AND user_id = $2 AND agenttype = 'normalization'
     ORDER BY generatedat DESC LIMIT 1`,
    [realProjectId, userId]
  );
  return result.rows[0]?.output?.projects || [];
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const data = await teamService.getTeamBoardsForUser(userId);
    res.json({ success: true, data });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'GET /api/team error');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ success: false, error: 'projectId inválido' });
    }
    const { projectId } = params.data;
    const userId = (req as AuthRequest).user!.id;

    const project = await resolveProject(projectId, userId);
    if (project === null) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    const taskRows = await fetchTaskRows(project.realProjectId, userId);
    const { members, groupSatisfactionScore } = await teamService.getTeamBoard(project.realProjectId, taskRows);

    res.json({ success: true, data: { members, groupSatisfactionScore, projectName: project.projectName } });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'GET /api/team/:projectId error');
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

router.post('/:projectId/members/:memberId/feedback', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    const memberId = Number(req.params.memberId);
    if (!params.success || !Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({ success: false, error: 'Parámetros inválidos' });
    }
    const body = TeamFeedbackSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ success: false, error: body.error.flatten() });
    }
    const { projectId } = params.data;
    const userId = (req as AuthRequest).user!.id;

    const realProjectId = await resolveRealProjectId(projectId, userId);
    if (realProjectId === null) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    const result = await teamService.addFeedbackNote(
      memberId,
      realProjectId,
      userId,
      body.data.noteText,
      body.data.lang
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'POST /api/team/:projectId/members/:memberId/feedback error');
    if (error.message === 'Miembro de equipo no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

router.patch('/:projectId/members/:memberId', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    const memberId = Number(req.params.memberId);
    if (!params.success || !Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({ success: false, error: 'Parámetros inválidos' });
    }
    const body = TeamRoleSchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ success: false, error: body.error.flatten() });
    }
    const { projectId } = params.data;
    const userId = (req as AuthRequest).user!.id;

    const realProjectId = await resolveRealProjectId(projectId, userId);
    if (realProjectId === null) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    await teamService.updateMemberRole(memberId, realProjectId, userId, body.data.role);

    res.json({ success: true });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'PATCH /api/team/:projectId/members/:memberId error');
    if (error.message === 'Miembro de equipo no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

router.get('/:projectId/members/:memberId/notes', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    const memberId = Number(req.params.memberId);
    if (!params.success || !Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({ success: false, error: 'Parámetros inválidos' });
    }
    const { projectId } = params.data;
    const userId = (req as AuthRequest).user!.id;

    const realProjectId = await resolveRealProjectId(projectId, userId);
    if (realProjectId === null) {
      return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
    }

    const notes = await teamService.getFeedbackNotes(memberId, realProjectId, userId);
    res.json({ success: true, data: notes });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'GET /api/team/:projectId/members/:memberId/notes error');
    if (error.message === 'Miembro de equipo no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

export default router;
