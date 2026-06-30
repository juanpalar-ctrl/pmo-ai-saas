/**
 * Auto-migration: runs at startup and ensures all tables exist with correct schema.
 * Safe to run multiple times (idempotent).
 */

import { pool } from './db';
import { dbLogger } from './core/logger';

export async function runMigrations(): Promise<void> {
  dbLogger.info('Running database migrations...');

  // Users table — includes role and status required by auth routes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add role/status columns if they were missing from an older schema
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'user'
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending_approval'
  `);

  // Project data table
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

  // AI analyses table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_analyses (
      id SERIAL PRIMARY KEY,
      projectid INT,
      agenttype VARCHAR(100),
      output JSONB,
      generatedat TIMESTAMP
    )
  `);

  // Password reset tokens table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Branding / organization config table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organization_config (
      id SERIAL PRIMARY KEY,
      organization_id VARCHAR(100) NOT NULL UNIQUE,
      primary_color VARCHAR(20),
      secondary_color VARCHAR(20),
      accent_color VARCHAR(20),
      logo_url VARCHAR(500),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  dbLogger.info('Database migrations complete');
}

/**
 * Seeds the first admin user if no users exist yet.
 * Credentials come from env vars ADMIN_EMAIL and ADMIN_PASSWORD.
 * Safe to call every startup — does nothing if a user already exists.
 */
export async function seedAdminUser(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    dbLogger.info('ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  const existing = await pool.query('SELECT id FROM users LIMIT 1');
  if (existing.rows.length > 0) {
    dbLogger.info('Users already exist — skipping admin seed');
    return;
  }

  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role, status)
     VALUES ($1, $2, 'admin', 'active')
     ON CONFLICT (email) DO NOTHING`,
    [email.toLowerCase(), hash]
  );
  dbLogger.info({ email }, 'Admin user seeded');
}
