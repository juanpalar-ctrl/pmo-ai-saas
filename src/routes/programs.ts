import express from 'express';
import { pool } from '../db';

const router = express.Router();

router.get('/client/:clientId', async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      'SELECT * FROM projects WHERE clientId = $1',
      [clientId]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/project/:projectId', async (req: any, res: any) => {
  try {
    const { projectId } = req.params;
    const project = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    const epics = await pool.query('SELECT * FROM epics WHERE projectId = $1', [projectId]);
    const risks = await pool.query('SELECT * FROM risks WHERE projectId = $1', [projectId]);
    res.json({
      project: project.rows[0],
      epics: epics.rows,
      risks: risks.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/epic/:epicId', async (req: any, res: any) => {
  try {
    const { epicId } = req.params;
    const epic = await pool.query('SELECT * FROM epics WHERE id = $1', [epicId]);
    const tasks = await pool.query('SELECT * FROM tasks WHERE epicId = $1', [epicId]);
    res.json({
      epic: epic.rows[0],
      tasks: tasks.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/project', async (req: any, res: any) => {
  try {
    const { clientId, name, budget, startDate, endDate } = req.body;
    const result = await pool.query(
      'INSERT INTO projects (clientId, name, budget, startDate, endDate) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [clientId, name, budget, startDate, endDate]
    );
    res.json({ id: result.rows[0].id, message: 'Proyecto creado' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
