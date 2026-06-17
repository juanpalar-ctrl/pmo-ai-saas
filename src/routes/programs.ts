import express, { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';

const router = express.Router();
const dbPath = path.join(__dirname, '../../pmo.db');

// GET: Todos los proyectos de un cliente
router.get('/client/:clientId', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const db = new sqlite3.Database(dbPath);

  db.all(
    `SELECT 
      p.id, p.name, p.budget, p.spent, p.startDate, p.endDate, p.status,
      ROUND(CAST(p.spent AS FLOAT) / p.budget * 100, 2) as percentSpent,
      (p.budget - p.spent) as available
    FROM projects WHERE clientId = ?`,
    [clientId],
    (_err, projects: any) => {
      res.json(projects || []);
      db.close();
    }
  );
});

// GET: Detalle de un proyecto + epics
router.get('/project/:projectId', (req: Request, res: Response) => {
  const { projectId } = req.params;
  const db = new sqlite3.Database(dbPath);

  db.get(
    `SELECT * FROM projects WHERE id = ?`,
    [projectId],
    (_err, project: any) => {
      db.all(
        `SELECT 
          id, name, budget, spent, startDate, endDate, status, assignedTo,
          ROUND(CAST(spent AS FLOAT) / budget * 100, 2) as percentSpent
        FROM epics WHERE projectId = ?`,
        [projectId],
        (_err, epics: any) => {
          db.all(
            `SELECT id, description, severity, status, assignedTo FROM risks WHERE projectId = ?`,
            [projectId],
            (_err, risks: any) => {
              res.json({
                project,
                epics: epics || [],
                risks: risks || []
              });
              db.close();
            }
          );
        }
      );
    }
  );
});

// GET: Detalle de un epic + tareas
router.get('/epic/:epicId', (req: Request, res: Response) => {
  const { epicId } = req.params;
  const db = new sqlite3.Database(dbPath);

  db.get(
    `SELECT * FROM epics WHERE id = ?`,
    [epicId],
    (_err, epic: any) => {
      db.all(
        `SELECT 
          id, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo,
          ROUND(CAST(spent AS FLOAT) / budget * 100, 2) as percentSpent
        FROM tasks WHERE epicId = ?`,
        [epicId],
        (_err, tasks: any) => {
          res.json({
            epic,
            tasks: tasks || []
          });
          db.close();
        }
      );
    }
  );
});

// POST: Crear proyecto
router.post('/project', (req: Request, res: Response) => {
  const { clientId, name, budget, startDate, endDate } = req.body;
  const db = new sqlite3.Database(dbPath);

  db.run(
    `INSERT INTO projects (clientId, name, budget, startDate, endDate) VALUES (?, ?, ?, ?, ?)`,
    [clientId, name, budget, startDate, endDate],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: 'Proyecto creado' });
      }
      db.close();
    }
  );
});

// POST: Crear epic
router.post('/epic', (req: Request, res: Response) => {
  const { projectId, name, budget, startDate, endDate, assignedTo } = req.body;
  const db = new sqlite3.Database(dbPath);

  db.run(
    `INSERT INTO epics (projectId, name, budget, startDate, endDate, assignedTo) VALUES (?, ?, ?, ?, ?, ?)`,
    [projectId, name, budget, startDate, endDate, assignedTo],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: 'Epic creado' });
      }
      db.close();
    }
  );
});

// POST: Crear tarea
router.post('/task', (req: Request, res: Response) => {
  const { epicId, name, budget, startDate, endDate, assignedTo } = req.body;
  const db = new sqlite3.Database(dbPath);

  db.run(
    `INSERT INTO tasks (epicId, name, budget, startDate, endDate, assignedTo) VALUES (?, ?, ?, ?, ?, ?)`,
    [epicId, name, budget, startDate, endDate, assignedTo],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: 'Tarea creada' });
      }
      db.close();
    }
  );
});

// POST: Crear riesgo
router.post('/risk', (req: Request, res: Response) => {
  const { projectId, description, severity, assignedTo } = req.body;
  const db = new sqlite3.Database(dbPath);

  db.run(
    `INSERT INTO risks (projectId, description, severity, assignedTo) VALUES (?, ?, ?, ?)`,
    [projectId, description, severity, assignedTo],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: 'Riesgo creado' });
      }
      db.close();
    }
  );
});

export default router;