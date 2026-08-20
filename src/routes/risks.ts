import express, { Request, Response } from 'express';
import { riskRepository } from '../repositories/riskRepository';
import { routeLogger } from '../core/logger';
import { pool } from '../db';

const router = express.Router();

const getProjectId = (projectId: string | string[]): string => {
  return Array.isArray(projectId) ? projectId[0] : projectId;
};

// Ensure tables exist before any request
router.use(async (_req, _res, next) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS risks (
        id SERIAL PRIMARY KEY,
        projectid INTEGER NOT NULL,
        description TEXT NOT NULL,
        probability INTEGER CHECK (probability >= 0 AND probability <= 100),
        impact VARCHAR(50),
        response TEXT,
        status VARCHAR(50) DEFAULT 'open',
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS raid_log (
        id SERIAL PRIMARY KEY,
        projectid INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        owner VARCHAR(255),
        status VARCHAR(50) DEFAULT 'open',
        impact VARCHAR(50),
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_risks_projectid ON risks(projectid)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_raid_log_projectid ON raid_log(projectid)`);
  } catch (err: any) {
    routeLogger.error({ err: err?.message }, 'Failed to ensure tables exist');
  }
  next();
});

/**
 * RISK REGISTER ENDPOINTS
 */

// GET /:projectId/risks
router.get('/:projectId/risks', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const risks = await riskRepository.getRisks(parseInt(projectId));
    res.json(risks);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error fetching risks');
    res.status(500).json({ error: 'Error fetching risks' });
  }
});

// POST /:projectId/risks
router.post('/:projectId/risks', async (req: Request, res: Response) => {
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

// GET /:projectId/risks/:riskId
router.get('/:projectId/risks/:riskId', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const riskId = getProjectId(req.params.riskId);
    const risk = await riskRepository.getRisk(parseInt(riskId), parseInt(projectId));

    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    res.json(risk);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error fetching risk');
    res.status(500).json({ error: 'Error fetching risk' });
  }
});

// PATCH /:projectId/risks/:riskId
router.patch('/:projectId/risks/:riskId', async (req: Request, res: Response) => {
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

// DELETE /:projectId/risks/:riskId
router.delete('/:projectId/risks/:riskId', async (req: Request, res: Response) => {
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

// GET /:projectId/raid
router.get('/:projectId/raid', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const raidLog = await riskRepository.getRAIDLog(parseInt(projectId));
    res.json(raidLog);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error fetching RAID log');
    res.status(500).json({ error: 'Error fetching RAID log' });
  }
});

// POST /:projectId/raid
router.post('/:projectId/raid', async (req: Request, res: Response) => {
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

// GET /:projectId/raid/:raidId
router.get('/:projectId/raid/:raidId', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const raidId = getProjectId(req.params.raidId);
    const item = await riskRepository.getRAIDItem(parseInt(raidId), parseInt(projectId));

    if (!item) {
      return res.status(404).json({ error: 'RAID item not found' });
    }

    res.json(item);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error fetching RAID item');
    res.status(500).json({ error: 'Error fetching RAID item' });
  }
});

// PATCH /:projectId/raid/:raidId
router.patch('/:projectId/raid/:raidId', async (req: Request, res: Response) => {
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

// DELETE /:projectId/raid/:raidId
router.delete('/:projectId/raid/:raidId', async (req: Request, res: Response) => {
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
