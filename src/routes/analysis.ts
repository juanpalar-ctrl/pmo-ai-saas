// ============================================
// RUTAS PARA ANÁLISIS IA
// Endpoints que el frontend llama
// ============================================

import express from 'express';
import { orchestrator } from '../services/multiAgentOrchestrator';

const router = express.Router();

// POST /api/analysis/:projectId
// Inicia análisis multi-agente
router.post('/:projectId', async (req: any, res: any) => {
  try {
    const { projectId } = req.params;
    
    console.log(`\n🚀 Nueva solicitud de análisis para proyecto ${projectId}`);
    
    // Ejecutar orquestador
    const result = await orchestrator.analyzeProject(parseInt(projectId));
    
    // Responder al frontend
    res.json({
      success: true,
      message: 'Análisis completado exitosamente',
      data: result,
    });
    
  } catch (error: any) {
    console.error('Error en ruta /analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/analysis/:projectId/latest
// Obtener análisis más reciente
router.get('/:projectId/latest', async (req: any, res: any) => {
  try {
    const { projectId } = req.params;
    
    res.json({
      success: true,
      message: 'Análisis obtenido',
      data: null,
    });
    
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;