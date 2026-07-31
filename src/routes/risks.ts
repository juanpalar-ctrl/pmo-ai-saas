import express, { Request, Response } from 'express';
import { riskRepository } from '../repositories/riskRepository';
import { routeLogger } from '../core/logger';

const router = express.Router();

const getProjectId = (projectId: string | string[]): string => {
  return Array.isArray(projectId) ? projectId[0] : projectId;
};

/**
 * RISK REGISTER ENDPOINTS
 */

// GET /api/projects/:projectId/risks
router.get('/projects/:projectId/risks', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const risks = await riskRepository.getRisks(parseInt(projectId));
    res.json(risks);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error fetching risks');
    res.status(500).json({ error: 'Error fetching risks' });
  }
});

// POST /api/projects/:projectId/risks
router.post('/projects/:projectId/risks', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const { description, probability, impact, response } = req.body;

    if (!description || probability === undefined || !impact || !response) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const risk = await riskRepository.createRisk({
      projectid: parseInt(projectId),
      description,
      probability: parseInt(probability),
      impact,
      response,
    });

    res.status(201).json(risk);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error creating risk');
    res.status(500).json({ error: 'Error creating risk' });
  }
});

// PATCH /api/projects/:projectId/risks/:riskId
router.patch('/projects/:projectId/risks/:riskId', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const riskId = getProjectId(req.params.riskId);
    const updates = req.body;

    const risk = await riskRepository.updateRisk(parseInt(riskId), parseInt(projectId), updates);

    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    res.json(risk);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error updating risk');
    res.status(500).json({ error: 'Error updating risk' });
  }
});

// DELETE /api/projects/:projectId/risks/:riskId
router.delete('/projects/:projectId/risks/:riskId', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const riskId = getProjectId(req.params.riskId);
    const deleted = await riskRepository.deleteRisk(parseInt(riskId), parseInt(projectId));

    if (!deleted) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error deleting risk');
    res.status(500).json({ error: 'Error deleting risk' });
  }
});

/**
 * RAID LOG ENDPOINTS
 */

// GET /api/projects/:projectId/raid
router.get('/projects/:projectId/raid', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const raidLog = await riskRepository.getRAIDLog(parseInt(projectId));
    res.json(raidLog);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error fetching RAID log');
    res.status(500).json({ error: 'Error fetching RAID log' });
  }
});

// POST /api/projects/:projectId/raid
router.post('/projects/:projectId/raid', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const { type, description, owner, status, impact } = req.body;

    if (!type || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const item = await riskRepository.createRAIDItem({
      projectid: parseInt(projectId),
      type,
      description,
      owner,
      status,
      impact,
    });

    res.status(201).json(item);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error creating RAID item');
    res.status(500).json({ error: 'Error creating RAID item' });
  }
});

// PATCH /api/projects/:projectId/raid/:raidId
router.patch('/projects/:projectId/raid/:raidId', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const raidId = getProjectId(req.params.raidId);
    const updates = req.body;

    const item = await riskRepository.updateRAIDItem(parseInt(raidId), parseInt(projectId), updates);

    if (!item) {
      return res.status(404).json({ error: 'RAID item not found' });
    }

    res.json(item);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error updating RAID item');
    res.status(500).json({ error: 'Error updating RAID item' });
  }
});

// DELETE /api/projects/:projectId/raid/:raidId
router.delete('/projects/:projectId/raid/:raidId', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const raidId = getProjectId(req.params.raidId);
    const deleted = await riskRepository.deleteRAIDItem(parseInt(raidId), parseInt(projectId));

    if (!deleted) {
      return res.status(404).json({ error: 'RAID item not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error deleting RAID item');
    res.status(500).json({ error: 'Error deleting RAID item' });
  }
});

export default router;
