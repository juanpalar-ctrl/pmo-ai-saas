/**
 * Script para crear un Excel de prueba con datos de recursos
 * Simula un portafolio de 2 proyectos con equipo asignado
 */

const XLSX = require('xlsx');
const path = require('path');

// Crear workbook
const wb = XLSX.utils.book_new();

// Datos de prueba: 2 proyectos con equipo
const data = [
  {
    'Project Name': 'Alpha - Mobile App Redesign',
    'Status': 'In Progress',
    'Start Date': '2026-08-01',
    'End Date': '2026-10-31',
    'Total Budget': 150000,
    'Spent': 45000,
    'Progress %': 35,
    'Team Member': 'Juan Pérez',
    'Role': 'Tech Lead',
    'Hours/Week': 30,
    'Task': 'Architecture & API Integration'
  },
  {
    'Project Name': 'Alpha - Mobile App Redesign',
    'Status': 'In Progress',
    'Start Date': '2026-08-01',
    'End Date': '2026-10-31',
    'Total Budget': 150000,
    'Spent': 45000,
    'Progress %': 35,
    'Team Member': 'Maria López',
    'Role': 'PM',
    'Hours/Week': 32,
    'Task': 'Sprint Planning & Stakeholder Mgmt'
  },
  {
    'Project Name': 'Alpha - Mobile App Redesign',
    'Status': 'In Progress',
    'Start Date': '2026-08-01',
    'End Date': '2026-10-31',
    'Total Budget': 150000,
    'Spent': 45000,
    'Progress %': 35,
    'Team Member': 'Carlos Ruiz',
    'Role': 'QA Lead',
    'Hours/Week': 28,
    'Task': 'Testing & Bug Reports'
  },
  {
    'Project Name': 'Beta - Cloud Migration',
    'Status': 'Planning',
    'Start Date': '2026-09-01',
    'End Date': '2026-11-30',
    'Total Budget': 200000,
    'Spent': 0,
    'Progress %': 5,
    'Team Member': 'Juan Pérez',
    'Role': 'Tech Lead',
    'Hours/Week': 20,
    'Task': 'Infrastructure Design'
  },
  {
    'Project Name': 'Beta - Cloud Migration',
    'Status': 'Planning',
    'Start Date': '2026-09-01',
    'End Date': '2026-11-30',
    'Total Budget': 200000,
    'Spent': 0,
    'Progress %': 5,
    'Team Member': 'Maria López',
    'Role': 'PM',
    'Hours/Week': 16,
    'Task': 'Requirements & Planning'
  },
  {
    'Project Name': 'Beta - Cloud Migration',
    'Status': 'Planning',
    'Start Date': '2026-09-01',
    'End Date': '2026-11-30',
    'Total Budget': 200000,
    'Spent': 0,
    'Progress %': 5,
    'Team Member': 'Roberto Silva',
    'Role': 'DevOps Engineer',
    'Hours/Week': 40,
    'Task': 'Cloud Setup & Configuration'
  },
  {
    'Project Name': 'Gamma - Analytics Dashboard',
    'Status': 'Not Started',
    'Start Date': '2026-10-01',
    'End Date': '2026-12-31',
    'Total Budget': 100000,
    'Spent': 0,
    'Progress %': 0,
    'Team Member': 'Carlos Ruiz',
    'Role': 'QA Lead',
    'Hours/Week': 12,
    'Task': 'Test Planning'
  }
];

// Crear worksheet desde datos
const ws = XLSX.utils.json_to_sheet(data);

// Ajustar anchos de columna
ws['!cols'] = [
  { wch: 25 }, // Project Name
  { wch: 12 }, // Status
  { wch: 12 }, // Start Date
  { wch: 12 }, // End Date
  { wch: 12 }, // Total Budget
  { wch: 10 }, // Spent
  { wch: 10 }, // Progress %
  { wch: 15 }, // Team Member
  { wch: 15 }, // Role
  { wch: 12 }, // Hours/Week
  { wch: 30 }  // Task
];

// Agregar worksheet al workbook
XLSX.utils.book_append_sheet(wb, ws, 'Projects');

// Guardar archivo
const filePath = path.join(__dirname, 'test-upload-resources.xlsx');
XLSX.writeFile(wb, filePath);

console.log(`✅ Excel de prueba creado: ${filePath}`);
console.log(`
📋 Contenido:
- Proyecto Alpha (Mobile App): Juan (30h), Maria (32h), Carlos (28h)
  → Juan + Maria + Carlos total: 90h (overcapacity risk)
- Proyecto Beta (Cloud Migration): Juan (20h), Maria (16h), Roberto (40h)
  → Juan overbooked: 30h (Alpha) + 20h (Beta) = 50h (125% allocation)
- Proyecto Gamma (Analytics): Carlos (12h)
  → Carlos overbooked: 28h (Alpha) + 12h (Gamma) = 40h (100%)

🎯 Testing scenarios:
✅ Overbooking detection: Juan 125%, Carlos 100%
✅ Bottleneck detection: Juan & Carlos in 2 projects
✅ Shared resources: Juan & Maria & Carlos in Alpha+Beta mix
✅ Intelligent inference: Hours are explicit (no inference needed)
`);
