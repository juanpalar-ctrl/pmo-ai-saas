import express, { Request, Response } from 'express';
import { riskRepository } from '../repositories/riskRepository';
import { routeLogger } from '../core/logger';
import { AuthRequest } from '../middleware/requireAuth';

const router = express.Router();

/**
 * RISK REGISTER ENDPOINTS
 */

// GET /api/projects/:projectId/risks
router.get('/projects/:projectId/risks', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const risks = await riskRepository.getRisks(parseInt(projectId));
    res.json(risks);
  } catch (error) {
    routeLogger.error('Error fetching risks:', error);
    res.status(500).json({ error: 'Error fetching risks' });
  }
});

// POST /api/projects/:projectId/risks
router.post('/projects/:projectId/risks', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
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
  } catch (error) {
    routeLogger.error('Error creating risk:', error);
    res.status(500).json({ error: 'Error creating risk' });
  }
});

// PATCH /api/projects/:projectId/risks/:riskId
router.patch('/projects/:projectId/risks/:riskId', async (req: Request, res: Response) => {
  try {
    const { projectId, riskId } = req.params;
    const updates = req.body;

    const risk = await riskRepository.updateRisk(parseInt(riskId), parseInt(projectId), updates);

    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    res.json(risk);
  } catch (error) {
    routeLogger.error('Error updating risk:', error);
    res.status(500).json({ error: 'Error updating risk' });
  }
});

// DELETE /api/projects/:projectId/risks/:riskId
router.delete('/projects/:projectId/risks/:riskId', async (req: Request, res: Response) => {
  try {
    const { projectId, riskId } = req.params;
    const deleted = await riskRepository.deleteRisk(parseInt(riskId), parseInt(projectId));

    if (!deleted) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    res.json({ success: true });
  } catch (error) {
    routeLogger.error('Error deleting risk:', error);
    res.status(500).json({ error: 'Error deleting risk' });
  }
});

/**
 * RAID LOG ENDPOINTS
 */

// GET /api/projects/:projectId/raid
router.get('/projects/:projectId/raid', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const raidLog = await riskRepository.getRAIDLog(parseInt(projectId));
    res.json(raidLog);
  } catch (error) {
    routeLogger.error('Error fetching RAID log:', error);
    res.status(500).json({ error: 'Error fetching RAID log' });
  }
});

// POST /api/projects/:projectId/raid
router.post('/projects/:projectId/raid', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
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
  } catch (error) {
    routeLogger.error('Error creating RAID item:', error);
    res.status(500).json({ error: 'Error creating RAID item' });
  }
});

// PATCH /api/projects/:projectId/raid/:raidId
router.patch('/projects/:projectId/raid/:raidId', async (req: Request, res: Response) => {
  try {
    const { projectId, raidId } = req.params;
    const updates = req.body;

    const item = await riskRepository.updateRAIDItem(parseInt(raidId), parseInt(projectId), updates);

    if (!item) {
      return res.status(404).json({ error: 'RAID item not found' });
    }

    res.json(item);
  } catch (error) {
    routeLogger.error('Error updating RAID item:', error);
    res.status(500).json({ error: 'Error updating RAID item' });
  }
});

// DELETE /api/projects/:projectId/raid/:raidId
router.delete('/projects/:projectId/raid/:raidId', async (req: Request, res: Response) => {
  try {
    const { projectId, raidId } = req.params;
    const deleted = await riskRepository.deleteRAIDItem(parseInt(raidId), parseInt(projectId));

    if (!deleted) {
      return res.status(404).json({ error: 'RAID item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    routeLogger.error('Error deleting RAID item:', error);
    res.status(500).json({ error: 'Error deleting RAID item' });
  }
});

export default router;
