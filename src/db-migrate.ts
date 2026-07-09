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

  // Owner of each project — enables per-user data isolation (portfolio, history, chat context)
  // users.id is VARCHAR(255) (e.g. "user_<timestamp>"), not a serial int — match that type.
  await pool.query(`
    ALTER TABLE project_data ADD COLUMN IF NOT EXISTS user_id VARCHAR(255) REFERENCES users(id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_project_data_user_id ON project_data(user_id)
  `);
  // Backfill legacy rows (created before ownership existed) to the first admin,
  // so they stay accessible to someone instead of becoming permanently orphaned.
  await pool.query(`
    UPDATE project_data
    SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
    WHERE user_id IS NULL
      AND EXISTS (SELECT 1 FROM users WHERE role = 'admin')
  `);

  // Password resets table. On this DB it was created out-of-band with different
  // column names (userid/expiresat instead of user_id/expires_at) — rename in place
  // rather than duplicate the table under IF NOT EXISTS, which would silently no-op.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_resets') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'password_resets' AND column_name = 'userid') THEN
          ALTER TABLE password_resets RENAME COLUMN userid TO user_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'password_resets' AND column_name = 'expiresat') THEN
          ALTER TABLE password_resets RENAME COLUMN expiresat TO expires_at;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'password_resets' AND column_name = 'createdat') THEN
          ALTER TABLE password_resets RENAME COLUMN createdat TO created_at;
        END IF;
      ELSE
        CREATE TABLE password_resets (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      END IF;
    END $$;
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

  // Team members table — auto-populated from the "assignee" column on Excel
  // upload (Hito 5.1). project_id is the business projectid (matches
  // ai_analyses.projectid), same plain-int-link convention as the rest of
  // this schema — no FK.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      project_id INT NOT NULL,
      user_id VARCHAR(255) REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      role VARCHAR(255),
      last_feedback_at TIMESTAMP,
      latest_wellbeing_score NUMERIC(3,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Case-insensitive uniqueness: "Juan Pérez" and "juan perez" from different
  // rows of the same sheet must resolve to one team member.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_project_name_ci ON team_members (project_id, lower(name))
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_members_project_id ON team_members(project_id)
  `);

  // 1-on-1 feedback log per team member (Hito 5.2). wellbeing_score/ai_reasoning
  // come from wellbeingAgent's semantic analysis of note_text.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_feedback_notes (
      id SERIAL PRIMARY KEY,
      team_member_id INT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
      note_text TEXT NOT NULL,
      wellbeing_score NUMERIC(3,2),
      ai_reasoning TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_team_feedback_member_id ON team_feedback_notes(team_member_id)
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
