// ============================================
// RUTAS PARA GESTIÓN DE DATOS
// 
// PROPÓSITO: Endpoints para:
// - Subir archivos Excel
// - Obtener proyectos cargados
// - Administrar datos
// ============================================

import express, { Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import { ExcelAdapter } from '../services/adapters/ExcelAdapter';
import { dataIngestService } from '../services/dataIngestService';
import { projectRepository } from '../repositories/projectRepository';

const router = express.Router();

/**
 * CONFIGURAR MULTER
 * 
 * FUNCIÓN: Middleware que maneja subida de archivos
 * 
 * CONFIGURACIÓN:
 * - destination: Dónde guardar archivos (carpeta temporal)
 * - filename: Nombre del archivo guardado
 * - fileFilter: Solo acepta .xlsx
 * - limits: Máximo 10MB por archivo
 */
const storage = multer.diskStorage({
  // Carpeta donde guardar archivos temporales
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  
  // Nombre del archivo
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname}`;
    cb(null, filename);
  },
});

/**
 * FILTRO: Solo acepta archivos Excel (.xlsx)
 * 
 * Si usuario sube .txt o .pdf, lo rechaza
 */
const fileFilter = (req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext !== '.xlsx') {
    return cb(new Error('❌ Solo se aceptan archivos .xlsx'));
  }
  
  cb(null, true);
};

// Instancia de multer con configuración
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
});

// Crear carpeta uploads si no existe
import * as fs from 'fs';
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

/**
 * POST /api/data/upload-excel
 * 
 * FUNCIÓN: Recibe archivo Excel, lo carga en BD
 * 
 * CLIENTE ENVÍA:
 * - multipart/form-data
 * - Campo "file": archivo .xlsx
 * 
 * SERVIDOR HACE:
 * 1. Multer recibe el archivo
 * 2. Lo guarda en ./uploads/
 * 3. ExcelAdapter lo lee
 * 4. DataIngestService lo carga en BD
 * 5. Retorna cuántos proyectos se cargaron
 * 
 * RESPUESTA:
 * {
 *   "success": true,
 *   "message": "Proyectos cargados exitosamente",
 *   "projectsLoaded": 3,
 *   "filename": "1234567890-projects.xlsx"
 * }
 */
router.post('/upload-excel', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // Si no hay archivo, error
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se envió archivo',
      });
    }
    
    console.log(`\n📤 Archivo recibido: ${req.file.filename}`);
    
    // Crear adapter con la ruta del archivo guardado
    const adapter = new ExcelAdapter(req.file.path);
    
    // Procesar archivo (leer, validar, guardar en BD)
    // Procesar archivo (leer, validar, guardar en BD)
    const result = await dataIngestService.ingestFromAdapter(adapter);
    
    // Limpiar: eliminar archivo temporal
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      message: 'Proyectos cargados exitosamente',
      count: result.count,
      rejected: result.rejected,
      filename: req.file.filename,
    });
    
  } catch (error: any) {
    // Si hay error, eliminar archivo temporal
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('❌ Error en upload:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/data/projects
 * 
 * FUNCIÓN: Obtener lista de proyectos cargados
 * 
 * QUERY PARAMS:
 * - page: Número de página (default 1)
 * - limit: Registros por página (default 50)
 * 
 * RESPUESTA:
 * {
 *   "success": true,
 *   "count": 3,
 *   "data": [...]
 * }
 */
/**
 * GET /api/data/projects
 * 
 * FUNCIÓN: Obtener lista de proyectos cargados
 * 
 * QUERY PARAMS:
 * - page: Número de página (default 1)
 * - limit: Registros por página (default 50)
 * 
 * RESPUESTA:
 * {
 *   "success": true,
 *   "count": 3,
 *   "data": [...]
 * }
 */
router.get('/projects', async (req: Request, res: Response) => {
  try {
    console.log('📥 GET /api/data/projects - Iniciando...');
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    console.log(`   page=${page}, limit=${limit}`);
    
    // Obtener del repository
    const projects = await projectRepository.getAllProjects(page, limit);
    
    console.log(`   ✅ Se obtuvieron ${projects.length} proyectos`);
    
    res.json({
      success: true,
      count: projects.length,
      page,
      limit,
      data: projects,
    });
    
  } catch (error: any) {
    console.error('❌ Error en GET /projects:', error);
    console.error('   Mensaje:', error.message);
    console.error('   Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido',
    });
  }
});

/**
 * GET /api/data/projects/:projectId
 * 
 * FUNCIÓN: Obtener un proyecto específico
 * 
 * @param projectId - ID del proyecto
 * 
 * RESPUESTA:
 * {
 *   "success": true,
 *   "data": { projectId, projectName, ... }
 * }
 */
router.get('/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    // Obtener del repository
    const project = await projectRepository.getProjectForAnalysis(parseInt(projectId as string));
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: `Proyecto ${projectId} no encontrado`,
      });
    }
    
    res.json({
      success: true,
      data: project,
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;