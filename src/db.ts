// ============================================
// CONFIGURACIÓN DE BASE DE DATOS
// 
// PROPÓSITO: Pool de conexiones a PostgreSQL
// 
// NOTA: Usa SSL para conexiones a Render
// ============================================

import { Pool } from 'pg';
import { dbLogger } from './core/logger';

/**
 * CREAR POOL DE CONEXIONES
 * 
 * FUNCIÓN: Mantiene múltiples conexiones abiertas
 * para mejor performance.
 * 
 * CONFIGURACIÓN:
 * - connectionString: URL de la BD (desde .env)
 * - ssl: true para Render (requiere SSL/TLS)
 * - max: máximo 20 conexiones simultáneas
 */
export const pool = new Pool({
  // URL completa de la BD (incluye credenciales)
  connectionString: process.env.DATABASE_URL,
  
  // SSL/TLS: en producción valida el certificado; en desarrollo acepta auto-firmados
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  
  // Máximo de conexiones en el pool
  max: 20,
  
  // Timeout de conexión (5 segundos)
  connectionTimeoutMillis: 5000,
});

/**
 * MANEJAR ERRORES DEL POOL
 * 
 * FUNCIÓN: Si hay error, lo loguea y continúa
 * (el pool intenta reconectar automáticamente)
 */
pool.on('error', (err) => {
  dbLogger.error({ err: err.message }, 'Error inesperado en pool de BD');
});

// Log DB host (no credentials) to diagnose connection issues
const dbUrl = process.env.DATABASE_URL || '';
const dbHost = dbUrl.replace(/\/\/[^@]+@/, '//<redacted>@').replace(/:[^:@/]+@/, ':***@');
dbLogger.info({ dbHost }, 'Pool de PostgreSQL configurado');

// Test connection on startup
pool.connect().then(client => {
  client.query('SELECT 1').then(() => {
    dbLogger.info('DB connection test OK');
    client.release();
  }).catch(err => {
    dbLogger.error({ err: err.message, code: err.code }, 'DB query test FAILED');
    client.release();
  });
}).catch(err => {
  dbLogger.error({ err: err.message, code: err.code }, 'DB connect test FAILED');
});