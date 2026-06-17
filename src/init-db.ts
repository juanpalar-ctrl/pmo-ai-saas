import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../pmo.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Tabla de Clientes
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      selectedSkill TEXT DEFAULT 'Scrum',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de Métricas Generales
  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      roi REAL DEFAULT 0,
      plannedCosts REAL DEFAULT 0,
      actualCosts REAL DEFAULT 0,
      activeProjects INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clientId) REFERENCES clients(id)
    )
  `);

  // Tabla de Métricas por Skill
  db.run(`
    CREATE TABLE IF NOT EXISTS skillMetrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      skill TEXT NOT NULL,
      metricName TEXT NOT NULL,
      metricValue TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clientId) REFERENCES clients(id)
    )
  `);

  console.log('✅ BD inicializada correctamente');
  db.close();
});
