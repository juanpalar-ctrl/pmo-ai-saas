import express, { Request, Response } from 'express';
import { allSkills } from '../skills/index';
import sqlite3 from 'sqlite3';
import path from 'path';

const router = express.Router();
const dbPath = path.join(__dirname, '../../pmo.db');

// GET: Traer todos los Skills disponibles
router.get('/', (_req: Request, res: Response) => {
  const skillsData = Object.values(allSkills).map(skill => ({
    name: skill.name,
    icon: skill.icon,
    description: skill.description,
    generalMetrics: skill.metrics.general,
    specificMetrics: skill.metrics.specific
  }));
  res.json(skillsData);
});

// POST: Guardar Skill seleccionado por cliente
router.post('/select', (req: Request, res: Response) => {
  const { clientName, clientEmail, selectedSkill } = req.body;

  const db = new sqlite3.Database(dbPath);

  db.run(
    'INSERT INTO clients (name, email, selectedSkill) VALUES (?, ?, ?)',
    [clientName, clientEmail, selectedSkill],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ 
          success: true, 
          clientId: this.lastID,
          message: `Cliente ${clientName} creado con Skill ${selectedSkill}`
        });
      }
      db.close();
    }
  );
});

// GET: Traer datos de un cliente específico
router.get('/:clientId', (req: Request, res: Response) => {
  const { clientId } = req.params;
  const db = new sqlite3.Database(dbPath);

  db.get(
    'SELECT * FROM clients WHERE id = ?',
    [clientId],
    (_err, client: any) => {
      if (client) {
        const skill = allSkills[client.selectedSkill.toLowerCase() as keyof typeof allSkills];
        res.json({
          client,
          skill: {
            name: skill.name,
            icon: skill.icon,
            description: skill.description,
            generalMetrics: skill.metrics.general,
            specificMetrics: skill.metrics.specific
          }
        });
      } else {
        res.status(404).json({ error: 'Cliente no encontrado' });
      }
      db.close();
    }
  );
});

export default router;
