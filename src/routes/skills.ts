// ============================================
// RUTAS PARA GESTIONAR SKILLS (Frameworks)
// Scrum, Kanban, SAFe
// ============================================

import express from 'express';
import { allSkills } from '../skills/index';
import { pool } from '../db';

const router = express.Router();

// ============================================
// GET /api/skills
// Devuelve TODOS los frameworks disponibles
// ============================================
router.get('/', (_req: any, res: any) => {
  // Tomar todos los skills y formatearlos
  const skillsData = Object.values(allSkills).map((skill: any) => ({
    name: skill.name,                    // "Scrum", "Kanban", "SAFe"
    icon: skill.icon,                    // 🎯, 📋, 🏢
    description: skill.description,      // Descripción del framework
    generalMetrics: skill.metrics.general,      // Métricas comunes (ROI, Costos, etc)
    specificMetrics: skill.metrics.specific     // Métricas específicas por framework
  }));
  
  // Enviar como respuesta JSON
  res.json(skillsData);
});

// ============================================
// POST /api/skills/select
// Guarda que un cliente eligió un framework
// ============================================
router.post('/select', async (req: any, res: any) => {
  try {
    // Datos que viene del formulario del dashboard
    const { clientName, clientEmail, selectedSkill } = req.body;
    
    // Insertar en la BD PostgreSQL
    // $1, $2, $3 son placeholders para evitar SQL injection
    const result = await pool.query(
      'INSERT INTO clients (name, email, selectedSkill) VALUES ($1, $2, $3) RETURNING id',
      [clientName, clientEmail, selectedSkill]
    );
    
    // Responder con el ID del cliente creado
    res.json({ 
      success: true, 
      clientId: result.rows[0].id,
      message: `Cliente ${clientName} creado con Skill ${selectedSkill}`
    });
  } catch (error: any) {
    // Si hay error, devolverlo
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/skills/:clientId
// Obtiene los datos de un cliente específico
// ============================================
router.get('/:clientId', async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    
    // Buscar el cliente en la BD
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
    const client = result.rows[0];
    
    // Si el cliente existe
    if (client) {
      // Obtener el skill que eligió
      const skill = (allSkills as any)[client.selectedSkill.toLowerCase()];
      
      // Enviar cliente + detalles del skill
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
      // Si no existe, error 404
      res.status(404).json({ error: 'Cliente no encontrado' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar router para usarlo en index.ts
export default router;