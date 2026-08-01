import express, { Request, Response } from 'express';
import { stakeholderRepository } from '../repositories/stakeholderRepository';
import { routeLogger } from '../core/logger';
import { pool } from '../db';

const router = express.Router();

const getProjectId = (projectId: string | string[]): string => {
  return Array.isArray(projectId) ? projectId[0] : projectId;
};

// Ensure table exists before any request
router.use(async (_req, _res, next) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stakeholders (
        id SERIAL PRIMARY KEY,
        projectid INTEGER NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        rol VARCHAR(255) NOT NULL,
        raci VARCHAR(1) NOT NULL,
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stakeholders_projectid ON stakeholders(projectid)`);
  } catch (err: any) {
    routeLogger.error({ err: err?.message }, 'Failed to ensure stakeholders table exists');
  }
  next();
});

// GET /:projectId/stakeholders
router.get('/:projectId/stakeholders', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const stakeholders = await stakeholderRepository.getStakeholders(parseInt(projectId));
    res.json(stakeholders);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error fetching stakeholders');
    res.status(500).json({ error: 'Error fetching stakeholders' });
  }
});

// POST /:projectId/stakeholders
router.post('/:projectId/stakeholders', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const { nombre, email, rol, raci } = req.body;

    if (!nombre || !email || !rol || !raci) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['R', 'A', 'C', 'I'].includes(raci)) {
      return res.status(400).json({ error: 'Invalid RACI value. Must be R, A, C, or I' });
    }

    const stakeholder = await stakeholderRepository.createStakeholder({
      projectid: parseInt(projectId),
      nombre,
      email,
      rol,
      raci,
    });

    res.status(201).json(stakeholder);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error creating stakeholder');
    res.status(500).json({ error: 'Error creating stakeholder' });
  }
});

// PATCH /:projectId/stakeholders/:stakeholderId
router.patch('/:projectId/stakeholders/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const stakeholderId = getProjectId(req.params.stakeholderId);
    const updates = req.body;

    if (updates.raci && !['R', 'A', 'C', 'I'].includes(updates.raci)) {
      return res.status(400).json({ error: 'Invalid RACI value. Must be R, A, C, or I' });
    }

    const stakeholder = await stakeholderRepository.updateStakeholder(
      parseInt(stakeholderId),
      parseInt(projectId),
      updates
    );

    if (!stakeholder) {
      return res.status(404).json({ error: 'Stakeholder not found' });
    }

    res.json(stakeholder);
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error updating stakeholder');
    res.status(500).json({ error: 'Error updating stakeholder' });
  }
});

// DELETE /:projectId/stakeholders/:stakeholderId
router.delete('/:projectId/stakeholders/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req.params.projectId);
    const stakeholderId = getProjectId(req.params.stakeholderId);
    const deleted = await stakeholderRepository.deleteStakeholder(parseInt(stakeholderId), parseInt(projectId));

    if (!deleted) {
      return res.status(404).json({ error: 'Stakeholder not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    routeLogger.error({ err: error?.message }, 'Error deleting stakeholder');
    res.status(500).json({ error: 'Error deleting stakeholder' });
  }
});

export default router;
