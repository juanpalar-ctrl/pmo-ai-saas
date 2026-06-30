// ============================================
// CONFIGURACIÓN DE BASE DE DATOS
// 
// PROPÓSITO: Pool de conexiones a PostgreSQL
// 
// NOTA: Usa SSL para conexiones a Render
// ============================================

import { Pool } from 'pg';

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
    : { rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false },
  
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
  console.error('❌ Error inesperado en pool de BD:', err);
});

// Log de confirmación
console.log('✅ Pool de PostgreSQL configurado con SSL');