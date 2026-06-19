// ============================================
// RUTAS DE DESARROLLO
// 
// PROPÓSITO: Endpoints solo para testing/desarrollo
// (generar datos dummy, resetear BD, etc)
//
// NOTA: En producción, ELIMINAR estos endpoints
// ============================================

import express from 'express';
import * as XLSX from 'xlsx';

const router = express.Router();

/**
 * GET /api/dev/generate-dummy-excel
 * 
 * FUNCIÓN: Genera archivo Excel con 3 proyectos dummy
 * y lo descarga automáticamente
 * 
 * USO: 
 * 1. Ve a http://localhost:3001/api/dev/generate-dummy-excel
 * 2. Se descarga projects.xlsx
 * 3. Lo subes via POST /api/data/upload-excel
 */
router.get('/generate-dummy-excel', (req: any, res: any) => {
  try {
    console.log('\n📊 Generando Excel dummy...');
    
    // Datos de 3 proyectos del mismo programa
    const dummyProjects = [
      {
        projectId: 1,
        projectName: 'ERP Core Implementation - Phase 1',
        status: 'In Progress',
        timeline: JSON.stringify({
          startDate: '2026-01-15T00:00:00Z',
          endDate: '2026-06-30T00:00:00Z',
          daysElapsed: 156,
          daysRemaining: 12,
          percentageComplete: 92.8,
        }),
        teamVelocity: JSON.stringify([45, 48, 42, 50, 40]),
        workPending: JSON.stringify({
          epicsRemaining: 2,
          tasksRemaining: 23,
          totalStoryPoints: 120,
        }),
        budget: JSON.stringify({
          totalBudget: 500000,
          spent: 432000,
          remaining: 68000,
          percentageSpent: 86.4,
        }),
        resources: JSON.stringify([
          { role: 'Solution Architect', count: 1, costPerMonth: 15000 },
          { role: 'Senior Developer', count: 3, costPerMonth: 8000 },
          { role: 'QA Engineer', count: 2, costPerMonth: 4000 },
        ]),
        risks: JSON.stringify([
          {
            description: 'Legacy system integration complexity',
            severity: 'critical',
            probability: 0.8,
          },
        ]),
      },
      {
        projectId: 2,
        projectName: 'ERP Analytics & Reporting Module',
        status: 'In Progress',
        timeline: JSON.stringify({
          startDate: '2026-02-01T00:00:00Z',
          endDate: '2026-08-31T00:00:00Z',
          daysElapsed: 140,
          daysRemaining: 74,
          percentageComplete: 65.4,
        }),
        teamVelocity: JSON.stringify([35, 38, 42, 45, 48]),
        workPending: JSON.stringify({
          epicsRemaining: 5,
          tasksRemaining: 45,
          totalStoryPoints: 180,
        }),
        budget: JSON.stringify({
          totalBudget: 750000,
          spent: 420000,
          remaining: 330000,
          percentageSpent: 56.0,
        }),
        resources: JSON.stringify([
          { role: 'Analytics Architect', count: 1, costPerMonth: 12000 },
          { role: 'Senior Developer', count: 4, costPerMonth: 7500 },
          { role: 'QA Engineer', count: 3, costPerMonth: 3500 },
        ]),
        risks: JSON.stringify([
          {
            description: 'Third-party BI tool integration delays',
            severity: 'high',
            probability: 0.3,
          },
        ]),
      },
      {
        projectId: 3,
        projectName: 'ERP User Training & Change Management',
        status: 'In Progress',
        timeline: JSON.stringify({
          startDate: '2026-03-15T00:00:00Z',
          endDate: '2026-07-30T00:00:00Z',
          daysElapsed: 97,
          daysRemaining: 37,
          percentageComplete: 72.4,
        }),
        teamVelocity: JSON.stringify([50, 52, 55, 58, 60]),
        workPending: JSON.stringify({
          epicsRemaining: 2,
          tasksRemaining: 18,
          totalStoryPoints: 85,
        }),
        budget: JSON.stringify({
          totalBudget: 300000,
          spent: 165000,
          remaining: 135000,
          percentageSpent: 55.0,
        }),
        resources: JSON.stringify([
          { role: 'Change Manager', count: 1, costPerMonth: 10000 },
          { role: 'Training Specialist', count: 2, costPerMonth: 5000 },
          { role: 'Scrum Master', count: 1, costPerMonth: 6000 },
        ]),
        risks: JSON.stringify([
          {
            description: 'Low user adoption due to resistance',
            severity: 'medium',
            probability: 0.4,
          },
        ]),
      },
    ];
    
    // Crear worksheet
    const worksheet = XLSX.utils.json_to_sheet(dummyProjects);
    
    // Crear workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
    
    // Convertir a buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    
    // Enviar como descarga
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="projects.xlsx"');
    res.send(buffer);
    
    console.log('✅ Excel generado y descargado');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
/**
 * GET /api/dev/init-database
 * 
 * FUNCIÓN: Crea las tablas necesarias en la BD
 * 
 * USO: http://localhost:3001/api/dev/init-database
 * 
 * SOLO PARA DESARROLLO - Eliminar en producción
 */
router.get('/init-database', async (req: any, res: any) => {
  try {
    console.log('\n🔧 Inicializando base de datos...');
    
    // Importar pool
    const { pool } = require('../db');
    
    // SQL para crear tabla project_data
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS project_data (
        id SERIAL PRIMARY KEY,
        projectId INTEGER UNIQUE NOT NULL,
        projectName VARCHAR(255) NOT NULL,
        status VARCHAR(50),
        timelineData JSONB,
        velocityData JSONB,
        workPendingData JSONB,
        budgetData JSONB,
        resourcesData JSONB,
        risksData JSONB,
        uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Ejecutar SQL
    await pool.query(createTableSQL);
    
    console.log('✅ Tabla project_data creada');
    
    // SQL para crear tabla ai_analyses (para guardar resultados de agentes)
    const createAnalysesTableSQL = `
      CREATE TABLE IF NOT EXISTS ai_analyses (
        id SERIAL PRIMARY KEY,
        projectId INTEGER REFERENCES project_data(projectId),
        agentType VARCHAR(100),
        output JSONB,
        generatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(createAnalysesTableSQL);
    
    console.log('✅ Tabla ai_analyses creada');
    
    res.json({
      success: true,
      message: 'Base de datos inicializada correctamente',
      tables: ['project_data', 'ai_analyses'],
    });
    
  } catch (error: any) {
    console.error('❌ Error inicializando BD:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
/**
 * GET /api/dev/check-database
 * 
 * FUNCIÓN: Verifica estructura de la BD
 */
router.get('/check-database', async (req: any, res: any) => {
  try {
    const { pool } = require('../db');
    
    // Columnas de project_data
    const projectCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'project_data'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 COLUMNAS EN project_data:');
    projectCols.rows.forEach((col: any) => {
      console.log(`   - ${col.column_name}`);
    });
    
    // Columnas de ai_analyses
    const analysesCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ai_analyses'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 COLUMNAS EN ai_analyses:');
    analysesCols.rows.forEach((col: any) => {
      console.log(`   - ${col.column_name}`);
    });
    
    res.json({
      project_data_columns: projectCols.rows,
      ai_analyses_columns: analysesCols.rows,
    });
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
export default router;