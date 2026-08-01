/**
 * Migration: Create SOW (Statement of Work) tables
 * Tables: sow_documents, sow_content
 */

import { pool } from '../db';
import { dbLogger } from '../core/logger';

export async function up(): Promise<void> {
  try {
    dbLogger.info('Running migration: Create SOW tables');

    // Table: sow_documents (metadata)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sow_documents (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_type VARCHAR(10),
        file_size_bytes INT,
        storage_path VARCHAR(500),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        use_in_analysis BOOLEAN DEFAULT true,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT unique_sow_per_project UNIQUE (project_id)
      );
    `);

    dbLogger.info('Created sow_documents table');

    // Table: sow_content (extracted text)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sow_content (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL UNIQUE,
        sow_document_id INT NOT NULL,
        extracted_text TEXT,
        char_count INT,
        extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        extraction_status VARCHAR(50) DEFAULT 'pending',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (sow_document_id) REFERENCES sow_documents(id) ON DELETE CASCADE
      );
    `);

    dbLogger.info('Created sow_content table');

    // Create indexes
    await pool.query(`CREATE INDEX idx_sow_documents_project ON sow_documents(project_id);`);
    await pool.query(`CREATE INDEX idx_sow_content_project ON sow_content(project_id);`);

    dbLogger.info('Created indexes for SOW tables');
  } catch (error) {
    dbLogger.error({ err: error }, 'Migration failed');
    throw error;
  }
}

export async function down(): Promise<void> {
  try {
    dbLogger.info('Rolling back: Drop SOW tables');

    await pool.query('DROP TABLE IF EXISTS sow_content CASCADE;');
    await pool.query('DROP TABLE IF EXISTS sow_documents CASCADE;');
    await pool.query('DROP INDEX IF EXISTS idx_sow_documents_project;');
    await pool.query('DROP INDEX IF EXISTS idx_sow_content_project;');

    dbLogger.info('Rolled back SOW tables');
  } catch (error) {
    dbLogger.error({ err: error }, 'Rollback failed');
    throw error;
  }
}
