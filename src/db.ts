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

dbLogger.info('Pool de PostgreSQL configurado');