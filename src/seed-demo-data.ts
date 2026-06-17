import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../pmo.db');
const db = new sqlite3.Database(dbPath);

const clientId = 1;

db.serialize(() => {
  // Limpiar datos anteriores (opcional)
  db.run(`DELETE FROM tasks`);
  db.run(`DELETE FROM epics`);
  db.run(`DELETE FROM risks`);
  db.run(`DELETE FROM projects`);

  // PROYECTO 1: Website Redesign
  db.run(
    `INSERT INTO projects (clientId, name, budget, spent, startDate, endDate, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [clientId, 'Website Redesign', 150000, 95000, '2026-04-01', '2026-08-31', 'On Track'],
    function(projectId1) {
      // EPIC 1.1
      db.run(
        `INSERT INTO epics (projectId, name, budget, spent, startDate, endDate, status, assignedTo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId1, 'Frontend Redesign', 80000, 60000, '2026-04-01', '2026-06-30', 'On Track', 'María García'],
        function(epicId1) {
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId1, 'UI Design Mockups', 20000, 20000, '2026-04-01', '2026-04-15', 100, 'Completado', 'María García']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId1, 'React Components', 30000, 25000, '2026-04-16', '2026-05-31', 85, 'On Track', 'Juan Pérez']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId1, 'Testing & QA', 15000, 15000, '2026-06-01', '2026-06-30', 100, 'Completado', 'Ana López']);
        }
      );

      // EPIC 1.2
      db.run(
        `INSERT INTO epics (projectId, name, budget, spent, startDate, endDate, status, assignedTo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId1, 'Backend APIs', 70000, 35000, '2026-05-01', '2026-07-31', 'At Risk', 'Carlos Ruiz'],
        function(epicId2) {
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId2, 'API Architecture', 20000, 15000, '2026-05-01', '2026-05-20', 75, 'On Track', 'Carlos Ruiz']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId2, 'Database Optimization', 25000, 20000, '2026-05-21', '2026-06-30', 80, 'At Risk', 'Pedro Martinez']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId2, 'Security Audit', 25000, 0, '2026-07-01', '2026-07-31', 0, 'Planeado', 'Security Team']);
        }
      );

      // Riesgos Proyecto 1
      db.run(`INSERT INTO risks (projectId, description, severity, status, assignedTo, mitigation) VALUES (?, ?, ?, ?, ?, ?)`, [projectId1, 'Delay en Backend APIs', 'Alto', 'Abierto', 'Carlos Ruiz', 'Asignar más recursos']);
      db.run(`INSERT INTO risks (projectId, description, severity, status, assignedTo, mitigation) VALUES (?, ?, ?, ?, ?, ?)`, [projectId1, 'Cambios de scope', 'Medio', 'Abierto', 'Juan López', 'Control riguroso de cambios']);
    }
  );

  // PROYECTO 2: Mobile App v2
  db.run(
    `INSERT INTO projects (clientId, name, budget, spent, startDate, endDate, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [clientId, 'Mobile App v2', 200000, 120000, '2026-05-15', '2026-10-31', 'On Track'],
    function(projectId2) {
      // EPIC 2.1
      db.run(
        `INSERT INTO epics (projectId, name, budget, spent, startDate, endDate, status, assignedTo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId2, 'iOS Development', 100000, 70000, '2026-05-15', '2026-08-31', 'On Track', 'Sofia Chen'],
        function(epicId3) {
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId3, 'Swift Architecture', 30000, 25000, '2026-05-15', '2026-06-15', 85, 'On Track', 'Sofia Chen']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId3, 'Push Notifications', 25000, 22000, '2026-06-16', '2026-07-15', 88, 'On Track', 'David Kim']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId3, 'App Store Submission', 20000, 23000, '2026-08-01', '2026-08-31', 95, 'Critical', 'Sofia Chen']);
        }
      );

      // EPIC 2.2
      db.run(
        `INSERT INTO epics (projectId, name, budget, spent, startDate, endDate, status, assignedTo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId2, 'Android Development', 100000, 50000, '2026-06-01', '2026-09-30', 'On Track', 'Luis Torres'],
        function(epicId4) {
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId4, 'Kotlin Modules', 35000, 25000, '2026-06-01', '2026-07-15', 70, 'On Track', 'Luis Torres']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId4, 'Firebase Integration', 35000, 25000, '2026-07-16', '2026-08-31', 70, 'On Track', 'Miguel Sánchez']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId4, 'Play Store Launch', 30000, 0, '2026-09-01', '2026-09-30', 0, 'Planeado', 'Luis Torres']);
        }
      );

      // Riesgos Proyecto 2
      db.run(`INSERT INTO risks (projectId, description, severity, status, assignedTo, mitigation) VALUES (?, ?, ?, ?, ?, ?)`, [projectId2, 'Restricciones App Store', 'Crítico', 'Abierto', 'Sofia Chen', 'Validación temprana con Apple']);
    }
  );

  // PROYECTO 3: API Integration
  db.run(
    `INSERT INTO projects (clientId, name, budget, spent, startDate, endDate, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [clientId, 'API Integration', 120000, 75000, '2026-03-01', '2026-07-31', 'On Track'],
    function(projectId3) {
      // EPIC 3.1
      db.run(
        `INSERT INTO epics (projectId, name, budget, spent, startDate, endDate, status, assignedTo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId3, 'Payment Gateway', 60000, 45000, '2026-03-01', '2026-05-31', 'Completado', 'Roberto Díaz'],
        function(epicId5) {
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId5, 'Stripe Integration', 30000, 30000, '2026-03-01', '2026-04-15', 100, 'Completado', 'Roberto Díaz']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId5, 'Webhook Handlers', 15000, 15000, '2026-04-16', '2026-05-15', 100, 'Completado', 'Patricia Flores']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId5, 'Refunds & Disputes', 15000, 0, '2026-05-16', '2026-05-31', 0, 'Completado', 'Roberto Díaz']);
        }
      );

      // EPIC 3.2
      db.run(
        `INSERT INTO epics (projectId, name, budget, spent, startDate, endDate, status, assignedTo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId3, 'Third-party Services', 60000, 30000, '2026-04-01', '2026-07-31', 'On Track', 'Alejandra Gómez'],
        function(epicId6) {
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId6, 'Analytics API', 20000, 15000, '2026-04-01', '2026-05-15', 75, 'On Track', 'Alejandra Gómez']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId6, 'Email Service', 20000, 15000, '2026-05-16', '2026-06-30', 75, 'On Track', 'Marco Alves']);
          db.run(`INSERT INTO tasks (epicId, name, budget, spent, startDate, endDate, percentComplete, status, assignedTo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [epicId6, 'SMS Notifications', 20000, 0, '2026-07-01', '2026-07-31', 0, 'Planeado', 'Alejandra Gómez']);
        }
      );

      // Riesgos Proyecto 3
      db.run(`INSERT INTO risks (projectId, description, severity, status, assignedTo, mitigation) VALUES (?, ?, ?, ?, ?, ?)`, [projectId3, 'Rate limiting issues', 'Medio', 'Abierto', 'Marco Alves', 'Implementar caching']);
    }
  );

  console.log('✅ Base de datos poblada con datos DEMO');
  db.close();
});
