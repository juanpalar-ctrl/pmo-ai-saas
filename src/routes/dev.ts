import { routeLogger } from '../core/logger';
import { errorMessage } from '../core/errors';
import express, { Request, Response } from 'express';
import { pool } from '../db';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// GET /api/dev/init-database - Crear tablas
router.get('/init-database', async (_req: Request, res: Response) => {
  try {
    // Tabla de usuarios — debe coincidir con db-migrate.ts (fuente de verdad):
    // id VARCHAR (no SERIAL) + role/status. Antes creaba un esquema divergente
    // que rompía las FKs varchar y el signup en una BD nueva.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
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
        generatedat TIMESTAMP,
        user_id VARCHAR(255) REFERENCES users(id)
      )
    `);

    res.json({ 
      success: true, 
      message: 'Database initialized',
      tables: ['users', 'project_data', 'ai_analyses']
    });
  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'Init DB error');
    res.status(500).json({ error: errorMessage(error) });
  }
});

// GET /api/dev/check-database
router.get('/check-database', async (_req: Request, res: Response) => {
  try {
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    res.json({ tables: tables.rows.map((t: { table_name: string }) => t.table_name) });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

// GET /api/dev/generate-dummy-excel
router.get('/generate-dummy-excel', async (_req: Request, res: Response) => {
  try {
    const xlsxPath = path.join(__dirname, '../../uploads/test-projects.xlsx');
    if (fs.existsSync(xlsxPath)) {
      res.download(xlsxPath, 'test-projects.xlsx');
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

export default router;
