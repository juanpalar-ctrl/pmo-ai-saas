import { routeLogger } from '../core/logger';
import express from 'express';
import { pool } from '../db';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// GET /api/dev/init-database - Crear tablas
router.get('/init-database', async (_req: any, res: any) => {
  try {
    // Tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de proyectos (ya existe)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_data (
        id SERIAL PRIMARY KEY,
        projectid INT,
        projectname VARCHAR(255),
        status VARCHAR(50),
        timelinedata JSONB,
        velocitydata JSONB,
        workpendingdata JSONB,
        budgetdata JSONB,
        resourcesdata JSONB,
        risksdata JSONB,
        uploadedat TIMESTAMP,
        updatedat TIMESTAMP
      )
    `);

    // Tabla de análisis (ya existe)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_analyses (
        id SERIAL PRIMARY KEY,
        projectid INT,
        agenttype VARCHAR(100),
        output JSONB,
        generatedat TIMESTAMP
      )
    `);

    res.json({ 
      success: true, 
      message: 'Database initialized',
      tables: ['users', 'project_data', 'ai_analyses']
    });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'Init DB error');
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dev/check-database
router.get('/check-database', async (_req: any, res: any) => {
  try {
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    res.json({ tables: tables.rows.map((t: any) => t.table_name) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dev/generate-dummy-excel
router.get('/generate-dummy-excel', async (_req: any, res: any) => {
  try {
    const xlsxPath = path.join(__dirname, '../../uploads/test-projects.xlsx');
    if (fs.existsSync(xlsxPath)) {
      res.download(xlsxPath, 'test-projects.xlsx');
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
