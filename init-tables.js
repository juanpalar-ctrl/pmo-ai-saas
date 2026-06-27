require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
CREATE TABLE IF NOT EXISTS project_data (
  id SERIAL PRIMARY KEY,
  projectid INTEGER,
  projectname VARCHAR(255),
  status VARCHAR(50),
  timelinedata JSONB,
  budgetdata JSONB,
  workpendingdata JSONB,
  resourcesdata JSONB,
  risksdata JSONB,
  uploadedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_analyses (
  id SERIAL PRIMARY KEY,
  projectid INTEGER,
  agenttype VARCHAR(50),
  output JSONB,
  generatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_data_projectid ON project_data(projectid);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_projectid ON ai_analyses(projectid);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_agenttype ON ai_analyses(agenttype);
`;

pool.query(sql)
  .then(() => {
    console.log('✅ Tablas creadas exitosamente');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
