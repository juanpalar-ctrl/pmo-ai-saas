import { pool } from './db';

export async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        selectedSkill VARCHAR(50) DEFAULT 'Scrum',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tablas PostgreSQL inicializadas');
  } catch (error) {
    console.log('ℹ️ Tablas ya existen');
  }
}