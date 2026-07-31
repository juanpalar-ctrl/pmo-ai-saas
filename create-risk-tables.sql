-- Create risks table if it doesn't exist
CREATE TABLE IF NOT EXISTS risks (
  id SERIAL PRIMARY KEY,
  projectid INTEGER NOT NULL,
  description TEXT NOT NULL,
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  impact VARCHAR(50),
  response TEXT,
  status VARCHAR(50) DEFAULT 'open',
  createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create raid_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS raid_log (
  id SERIAL PRIMARY KEY,
  projectid INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  owner VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',
  impact VARCHAR(50),
  createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_risks_projectid ON risks(projectid);
CREATE INDEX IF NOT EXISTS idx_raid_log_projectid ON raid_log(projectid);
