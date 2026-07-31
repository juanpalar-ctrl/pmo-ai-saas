-- Tabla: project_data
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

-- Tabla: ai_analyses
CREATE TABLE IF NOT EXISTS ai_analyses (
  id SERIAL PRIMARY KEY,
  projectid INTEGER,
  agenttype VARCHAR(50),
  output JSONB,
  generatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: risks (Risk Register)
CREATE TABLE IF NOT EXISTS risks (
  id SERIAL PRIMARY KEY,
  projectid INTEGER NOT NULL,
  description TEXT NOT NULL,
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  impact VARCHAR(50),
  response TEXT,
  status VARCHAR(50) DEFAULT 'open',
  createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projectid) REFERENCES project_data(projectid)
);

-- Tabla: raid_log (RAID Log)
CREATE TABLE IF NOT EXISTS raid_log (
  id SERIAL PRIMARY KEY,
  projectid INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  owner VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',
  impact VARCHAR(50),
  createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projectid) REFERENCES project_data(projectid)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_project_data_projectid ON project_data(projectid);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_projectid ON ai_analyses(projectid);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_agenttype ON ai_analyses(agenttype);
CREATE INDEX IF NOT EXISTS idx_risks_projectid ON risks(projectid);
CREATE INDEX IF NOT EXISTS idx_raid_log_projectid ON raid_log(projectid);
