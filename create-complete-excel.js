const XLSX = require('xlsx');

// Helper para crear datos JSON como strings
const createTimeline = (startStr, endStr, completed) => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const now = new Date('2026-08-18');
  const daysElapsed = Math.floor((now - start) / (1000*60*60*24));
  const daysRemaining = Math.floor((end - now) / (1000*60*60*24));
  const totalDays = Math.floor((end - start) / (1000*60*60*24));
  
  return JSON.stringify({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    daysElapsed: Math.max(0, daysElapsed),
    daysRemaining: Math.max(0, daysRemaining),
    percentageComplete: completed
  });
};

const data = [
  {
    'projectId': 1,
    'projectName': 'Alpha - Mobile App Redesign',
    'status': 'In Progress',
    'timeline': createTimeline('2026-08-01', '2026-10-31', 35),
    'teamVelocity': '[25, 28, 30]',
    'workPending': JSON.stringify({ epicsRemaining: 3, tasksRemaining: 15, totalStoryPoints: 45 }),
    'budget': JSON.stringify({ totalBudget: 150000, spent: 45000, remaining: 105000, percentageSpent: 30 }),
    'resources': JSON.stringify([
      { role: 'Tech Lead', count: 1, costPerMonth: 8000 },
      { role: 'PM', count: 1, costPerMonth: 7000 },
      { role: 'QA Lead', count: 1, costPerMonth: 6000 }
    ]),
    'Team Member': 'Juan Pérez',
    'Hours/Week': 30
  },
  {
    'projectId': 1,
    'projectName': 'Alpha - Mobile App Redesign',
    'status': 'In Progress',
    'timeline': createTimeline('2026-08-01', '2026-10-31', 35),
    'teamVelocity': '[25, 28, 30]',
    'workPending': JSON.stringify({ epicsRemaining: 3, tasksRemaining: 15, totalStoryPoints: 45 }),
    'budget': JSON.stringify({ totalBudget: 150000, spent: 45000, remaining: 105000, percentageSpent: 30 }),
    'resources': JSON.stringify([
      { role: 'Tech Lead', count: 1, costPerMonth: 8000 },
      { role: 'PM', count: 1, costPerMonth: 7000 },
      { role: 'QA Lead', count: 1, costPerMonth: 6000 }
    ]),
    'Team Member': 'Maria López',
    'Hours/Week': 32
  },
  {
    'projectId': 1,
    'projectName': 'Alpha - Mobile App Redesign',
    'status': 'In Progress',
    'timeline': createTimeline('2026-08-01', '2026-10-31', 35),
    'teamVelocity': '[25, 28, 30]',
    'workPending': JSON.stringify({ epicsRemaining: 3, tasksRemaining: 15, totalStoryPoints: 45 }),
    'budget': JSON.stringify({ totalBudget: 150000, spent: 45000, remaining: 105000, percentageSpent: 30 }),
    'resources': JSON.stringify([
      { role: 'Tech Lead', count: 1, costPerMonth: 8000 },
      { role: 'PM', count: 1, costPerMonth: 7000 },
      { role: 'QA Lead', count: 1, costPerMonth: 6000 }
    ]),
    'Team Member': 'Carlos Ruiz',
    'Hours/Week': 28
  },
  {
    'projectId': 2,
    'projectName': 'Beta - Cloud Migration',
    'status': 'In Progress',
    'timeline': createTimeline('2026-09-01', '2026-11-30', 5),
    'teamVelocity': '[20, 22, 25]',
    'workPending': JSON.stringify({ epicsRemaining: 5, tasksRemaining: 25, totalStoryPoints: 60 }),
    'budget': JSON.stringify({ totalBudget: 200000, spent: 0, remaining: 200000, percentageSpent: 0 }),
    'resources': JSON.stringify([
      { role: 'Tech Lead', count: 1, costPerMonth: 8000 },
      { role: 'PM', count: 1, costPerMonth: 7000 },
      { role: 'DevOps', count: 1, costPerMonth: 9000 }
    ]),
    'Team Member': 'Juan Pérez',
    'Hours/Week': 20
  },
  {
    'projectId': 2,
    'projectName': 'Beta - Cloud Migration',
    'status': 'In Progress',
    'timeline': createTimeline('2026-09-01', '2026-11-30', 5),
    'teamVelocity': '[20, 22, 25]',
    'workPending': JSON.stringify({ epicsRemaining: 5, tasksRemaining: 25, totalStoryPoints: 60 }),
    'budget': JSON.stringify({ totalBudget: 200000, spent: 0, remaining: 200000, percentageSpent: 0 }),
    'resources': JSON.stringify([
      { role: 'Tech Lead', count: 1, costPerMonth: 8000 },
      { role: 'PM', count: 1, costPerMonth: 7000 },
      { role: 'DevOps', count: 1, costPerMonth: 9000 }
    ]),
    'Team Member': 'Maria López',
    'Hours/Week': 16
  },
  {
    'projectId': 2,
    'projectName': 'Beta - Cloud Migration',
    'status': 'In Progress',
    'timeline': createTimeline('2026-09-01', '2026-11-30', 5),
    'teamVelocity': '[20, 22, 25]',
    'workPending': JSON.stringify({ epicsRemaining: 5, tasksRemaining: 25, totalStoryPoints: 60 }),
    'budget': JSON.stringify({ totalBudget: 200000, spent: 0, remaining: 200000, percentageSpent: 0 }),
    'resources': JSON.stringify([
      { role: 'Tech Lead', count: 1, costPerMonth: 8000 },
      { role: 'PM', count: 1, costPerMonth: 7000 },
      { role: 'DevOps', count: 1, costPerMonth: 9000 }
    ]),
    'Team Member': 'Roberto Silva',
    'Hours/Week': 40
  },
  {
    'projectId': 3,
    'projectName': 'Gamma - Analytics Dashboard',
    'status': 'Not Started',
    'timeline': createTimeline('2026-10-01', '2026-12-31', 0),
    'teamVelocity': '[15, 18, 20]',
    'workPending': JSON.stringify({ epicsRemaining: 2, tasksRemaining: 10, totalStoryPoints: 30 }),
    'budget': JSON.stringify({ totalBudget: 100000, spent: 0, remaining: 100000, percentageSpent: 0 }),
    'resources': JSON.stringify([
      { role: 'QA Lead', count: 1, costPerMonth: 6000 }
    ]),
    'Team Member': 'Carlos Ruiz',
    'Hours/Week': 12
  }
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);
ws['!cols'] = [
  { wch: 10 },
  { wch: 25 },
  { wch: 12 },
  { wch: 35 },
  { wch: 15 },
  { wch: 35 },
  { wch: 50 },
  { wch: 80 },
  { wch: 15 },
  { wch: 12 }
];

XLSX.utils.book_append_sheet(wb, ws, 'Projects');
XLSX.writeFile(wb, 'test-resources-complete.xlsx');
console.log('✅ Excel completo creado: test-resources-complete.xlsx');
