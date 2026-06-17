// ============================================
// CONEXIÓN A BASE DE DATOS POSTGRESQL
// Este archivo crea la conexión y la exporta
// para usarla en todas las rutas
// ============================================

import { Pool } from 'pg';

// Crear un "Pool" (grupo de conexiones a la BD)
// En lugar de una sola conexión, mantenemos varias
// activas para mejor rendimiento
const pool = new Pool({
  // URL de conexión a PostgreSQL
  // Viene del archivo .env o de Render
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/pmo_saas',
  
  // SSL: Si estamos en producción (Render), usar SSL
  // Si estamos en desarrollo local, no usar SSL
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Exportar el pool para usarlo en las rutas
// Ejemplo: pool.query('SELECT * FROM clients')
export { pool };