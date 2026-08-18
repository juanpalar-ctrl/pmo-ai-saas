const XLSX = require('xlsx');

// Datos de proyectos con información completa + equipo
const data = [
  {
    'projectId': 1,
    'projectName': 'Alpha - Mobile App Redesign',
    'status': 'In Progress',
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
    'projectId': 1,
    'projectName': 'Alpha - Mobile App Redesign',
    'status': 'In Progress',
    'Start Date': '2026-08-01',
    'End Date': '2026-10-31',
    'Total Budget': 150000,
    'Spent': 45000,
    'Progress %': 35,
    'Team Member': 'Maria López',
    'Role': 'PM',
    'Hours/Week': 32,
    'Task': 'Sprint Planning'
  },
  {
    'projectId': 1,
    'projectName': 'Alpha - Mobile App Redesign',
    'status': 'In Progress',
    'Start Date': '2026-08-01',
    'End Date': '2026-10-31',
    'Total Budget': 150000,
    'Spent': 45000,
    'Progress %': 35,
    'Team Member': 'Carlos Ruiz',
    'Role': 'QA Lead',
    'Hours/Week': 28,
    'Task': 'Testing'
  },
  {
    'projectId': 2,
    'projectName': 'Beta - Cloud Migration',
    'status': 'In Progress',
    'Start Date': '2026-09-01',
    'End Date': '2026-11-30',
    'Total Budget': 200000,
    'Spent': 0,
    'Progress %': 5,
    'Team Member': 'Juan Pérez',
    'Role': 'Tech Lead',
    'Hours/Week': 20,
    'Task': 'Infrastructure'
  },
  {
    'projectId': 2,
    'projectName': 'Beta - Cloud Migration',
    'status': 'In Progress',
    'Start Date': '2026-09-01',
    'End Date': '2026-11-30',
    'Total Budget': 200000,
    'Spent': 0,
    'Progress %': 5,
    'Team Member': 'Maria López',
    'Role': 'PM',
    'Hours/Week': 16,
    'Task': 'Planning'
  },
  {
    'projectId': 2,
    'projectName': 'Beta - Cloud Migration',
    'status': 'In Progress',
    'Start Date': '2026-09-01',
    'End Date': '2026-11-30',
    'Total Budget': 200000,
    'Spent': 0,
    'Progress %': 5,
    'Team Member': 'Roberto Silva',
    'Role': 'DevOps',
    'Hours/Week': 40,
    'Task': 'Cloud Setup'
  },
  {
    'projectId': 3,
    'projectName': 'Gamma - Analytics',
    'status': 'Not Started',
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

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);
ws['!cols'] = [
  { wch: 10 },
  { wch: 25 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 10 },
  { wch: 10 },
  { wch: 15 },
  { wch: 15 },
  { wch: 12 },
  { wch: 30 }
];

XLSX.utils.book_append_sheet(wb, ws, 'Projects');
XLSX.writeFile(wb, 'test-resources-better.xlsx');
console.log('✅ Excel mejorado creado: test-resources-better.xlsx');
