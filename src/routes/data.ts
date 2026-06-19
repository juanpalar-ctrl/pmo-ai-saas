import express from 'express';
import { ExcelAdapter } from '../services/adapters/ExcelAdapter';
import { dataIngestService } from '../services/dataIngestService';
import { projectRepository } from '../repositories/projectRepository';

const router = express.Router();

// POST /api/data/upload-excel
// Carga proyectos desde Excel a BD
router.post('/upload-excel', async (req: any, res: any) => {
  try {
    // Para testing: usar archivo en carpeta public
    const filePath = './projects.xlsx';
    
    const adapter = new ExcelAdapter(filePath);
    await dataIngestService.ingestFromAdapter(adapter);
    
    res.json({
      success: true,
      message: 'Proyectos cargados exitosamente',
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/data/projects
// Obtener todos los proyectos (paginated)
router.get('/projects', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    
    const projects = await projectRepository.getAllProjects(page, limit);
    
    res.json({
      success: true,
      count: projects.length,
      data: projects,
    });
    
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;