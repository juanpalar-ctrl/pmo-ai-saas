// ============================================
// RUTAS PARA GESTIONAR PROGRAMAS
// Proyectos, Epics, Tareas y Riesgos
// ============================================

import express from 'express';
import { pool } from '../db';

const router = express.Router();

// ============================================
// GET /api/programs/client/:clientId
// Obtiene TODOS los proyectos de un cliente
// ============================================
router.get('/client/:clientId', async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    
    // Consultar la BD: SELECT * FROM projects WHERE clientId = ?
    const result = await pool.query(
      'SELECT * FROM projects WHERE clientId = $1',
      [clientId]
    );
    
    // Devolver la lista de proyectos
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/programs/project/:projectId
// Obtiene un proyecto + sus epics + sus riesgos
// ============================================
router.get('/project/:projectId', async (req: any, res: any) => {
  try {
    const { projectId } = req.params;
    
    // Obtener proyecto
    const project = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    
    // Obtener epics (tareas grandes) del proyecto
    const epics = await pool.query('SELECT * FROM epics WHERE projectId = $1', [projectId]);
    
    // Obtener riesgos del proyecto
    const risks = await pool.query('SELECT * FROM risks WHERE projectId = $1', [projectId]);
    
    // Devolver todo junto
    res.json({
      project: project.rows[0],
      epics: epics.rows,
      risks: risks.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/programs/epic/:epicId
// Obtiene un epic + todas sus tareas
// ============================================
router.get('/epic/:epicId', async (req: any, res: any) => {
  try {
    const { epicId } = req.params;
    
    // Obtener epic (tarea grande)
    const epic = await pool.query('SELECT * FROM epics WHERE id = $1', [epicId]);
    
    // Obtener tareas del epic
    const tasks = await pool.query('SELECT * FROM tasks WHERE epicId = $1', [epicId]);
    
    // Devolver epic + tareas
    res.json({
      epic: epic.rows[0],
      tasks: tasks.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/programs/project
// CREAR un nuevo proyecto
// ============================================
router.post('/project', async (req: any, res: any) => {
  try {
    // Datos que vienen del formulario
    const { clientId, name, budget, startDate, endDate } = req.body;
    
    // Insertar en la BD
    const result = await pool.query(
      'INSERT INTO projects (clientId, name, budget, startDate, endDate) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [clientId, name, budget, startDate, endDate]
    );
    
    // Devolver el ID del proyecto creado
    res.json({ id: result.rows[0].id, message: 'Proyecto creado' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/programs/epic
// CREAR un nuevo epic (tarea grande)
// ============================================
router.post('/epic', async (req: any, res: any) => {
  try {
    const { projectId, name, budget, startDate, endDate, assignedTo } = req.body;
    
    const result = await pool.query(
      'INSERT INTO epics (projectId, name, budget, startDate, endDate, assignedTo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [projectId, name, budget, startDate, endDate, assignedTo]
    );
    
    res.json({ id: result.rows[0].id, message: 'Epic creado' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/programs/task
// CREAR una nueva tarea
// ============================================
router.post('/task', async (req: any, res: any) => {
  try {
    const { epicId, name, budget, startDate, endDate, assignedTo } = req.body;
    
    const result = await pool.query(
      'INSERT INTO tasks (epicId, name, budget, startDate, endDate, assignedTo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [epicId, name, budget, startDate, endDate, assignedTo]
    );
    
    res.json({ id: result.rows[0].id, message: 'Tarea creada' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/programs/risk
// CREAR un nuevo riesgo
// ============================================
router.post('/risk', async (req: any, res: any) => {
  try {
    const { projectId, description, severity, assignedTo } = req.body;
    
    const result = await pool.query(
      'INSERT INTO risks (projectId, description, severity, assignedTo) VALUES ($1, $2, $3, $4) RETURNING id',
      [projectId, description, severity, assignedTo]
    );
    
    res.json({ id: result.rows[0].id, message: 'Riesgo creado' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar router para usarlo en index.ts
export default router;