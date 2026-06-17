import sqlite3 from 'sqlite3';
import path from 'path';
import * as fs from 'fs';

const dbPath = path.join(__dirname, '../../pmo.db');
const demoDataPath = path.join(__dirname, '../data/demo-data.json');

export function loadDemoData(clientId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const demoData = JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));
      const db = new sqlite3.Database(dbPath);

      db.serialize(() => {
        // Insertar Proyectos
        demoData.projects.forEach((project: any) => {
          db.run(
            `INSERT OR IGNORE INTO projects (clientId, name, budget, spent, startDate, endDate, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [clientId, project.name, project.budget, project.spent, project.startDate, project.endDate, project.status]
          );
        });

        // Insertar Epics
        demoData.epics.forEach((epic: any) => {
          db.run(
            `INSERT OR IGNORE INTO epics (projectId, name, budget, spent, startDate, endDate, status, assignedTo) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [epic.projectId, epic.name, epic.budget, epic.spent, epic.startDate, epic.endDate, epic.status, epic.assignedTo]
          );
        });

        // Insertar Tasks
        demoData.tasks.forEach((task: any) => {
          db.run(
            `INSERT OR IGNORE INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [task.epicId, task.name, task.budget, task.spent, task.startDate, task.endDate, task.percentComplete, task.status, task.assignedTo]
          );
        });

        // Insertar Risks
        demoData.risks.forEach((risk: any) => {
          db.run(
            `INSERT OR IGNORE INTO risks (projectId, description, severity, status, assignedTo, mitigation) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [risk.projectId, risk.description, risk.severity, risk.status, risk.assignedTo, risk.mitigation]
          );
        });

        setTimeout(() => {
          db.close();
          resolve(`✅ Datos DEMO cargados para cliente ${clientId}`);
        }, 500);
      });
    } catch (error) {
      reject(error);
    }
  });
}
