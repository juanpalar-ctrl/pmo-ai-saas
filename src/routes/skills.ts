import express from 'express';
import { allSkills } from '../skills/index';
import { pool } from '../db';

const router = express.Router();

router.get('/', (_req: any, res: any) => {
  const skillsData = Object.values(allSkills).map((skill: any) => ({
    name: skill.name,
    icon: skill.icon,
    description: skill.description,
    generalMetrics: skill.metrics.general,
    specificMetrics: skill.metrics.specific
  }));
  res.json(skillsData);
});

router.post('/select', async (req: any, res: any) => {
  try {
    const { clientName, clientEmail, selectedSkill } = req.body;
    const result = await pool.query(
      'INSERT INTO clients (name, email, selectedSkill) VALUES ($1, $2, $3) RETURNING id',
      [clientName, clientEmail, selectedSkill]
    );
    res.json({ 
      success: true, 
      clientId: result.rows[0].id,
      message: `Cliente ${clientName} creado con Skill ${selectedSkill}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:clientId', async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
    const client = result.rows[0];
    
    if (client) {
      const skill = (allSkills as any)[client.selectedSkill.toLowerCase()];
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
