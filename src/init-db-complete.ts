import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../pmo.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // PROYECTOS
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      name TEXT NOT NULL,
      budget REAL DEFAULT 0,
      spent REAL DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      status TEXT DEFAULT 'On Track',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clientId) REFERENCES clients(id)
    )
  `);

  // EPICS
  db.run(`
    CREATE TABLE IF NOT EXISTS epics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      name TEXT NOT NULL,
      budget REAL DEFAULT 0,
      spent REAL DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      status TEXT DEFAULT 'On Track',
      assignedTo TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    )
  `);

  // TAREAS
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      epicId INTEGER NOT NULL,
      name TEXT NOT NULL,
      budget REAL DEFAULT 0,
      spent REAL DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      percentComplete INTEGER DEFAULT 0,
      status TEXT DEFAULT 'On Track',
      assignedTo TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (epicId) REFERENCES epics(id)
    )
  `);

  // RIESGOS
  db.run(`
    CREATE TABLE IF NOT EXISTS risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      description TEXT NOT NULL,
      severity TEXT DEFAULT 'Medio',
      status TEXT DEFAULT 'Abierto',
      assignedTo TEXT,
      mitigation TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    )
  `);

  console.log('✅ Tablas creadas correctamente');
  db.close();
});
