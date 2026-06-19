// ============================================
// DATA DUMMY DE PROYECTOS PARA TESTING
// Fácil de cambiar y testear agentes
// ============================================

export const dummyProjects: any = {
  // Proyecto 1: EN RIESGO (para ver alertas)
  1: {
    projectId: 1,
    projectName: 'Transformación Digital - Banco XYZ',
    status: 'In Progress',
    timeline: {
      startDate: '2026-01-15',
      endDate: '2026-06-30',
      daysElapsed: 156,
      daysRemaining: 12,
      percentageComplete: 92.8,
    },
    teamVelocity: [45, 48, 42, 50, 40],
    workPending: {
      epicsRemaining: 2,
      tasksRemaining: 23,
      totalStoryPoints: 120,
    },
    budget: {
      totalBudget: 500000,
      spent: 432000,
      remaining: 68000,
      percentageSpent: 86.4,
    },
    resources: [
      { role: 'Architect', count: 1, costPerMonth: 15000 },
      { role: 'Senior Developer', count: 3, costPerMonth: 8000 },
      { role: 'QA', count: 2, costPerMonth: 4000 },
    ],
    risks: [
      { description: 'Legacy system integration', severity: 'critical', probability: 0.8 },
      { description: 'Team capacity shortage', severity: 'high', probability: 0.6 },
      { description: 'UAT delays', severity: 'medium', probability: 0.4 },
    ],
  },

  // Proyecto 2: ON TRACK (para comparar)
  2: {
    projectId: 2,
    projectName: 'Plataforma de E-commerce - Retail Co',
    status: 'In Progress',
    timeline: {
      startDate: '2026-02-01',
      endDate: '2026-08-31',
      daysElapsed: 140,
      daysRemaining: 74,
      percentageComplete: 65.4,
    },
    teamVelocity: [35, 38, 42, 45, 48],
    workPending: {
      epicsRemaining: 5,
      tasksRemaining: 45,
      totalStoryPoints: 180,
    },
    budget: {
      totalBudget: 750000,
      spent: 420000,
      remaining: 330000,
      percentageSpent: 56.0,
    },
    resources: [
      { role: 'Architect', count: 1, costPerMonth: 12000 },
      { role: 'Senior Developer', count: 4, costPerMonth: 7500 },
      { role: 'QA', count: 3, costPerMonth: 3500 },
    ],
    risks: [
      { description: 'Payment gateway integration', severity: 'high', probability: 0.3 },
      { description: 'Performance under load', severity: 'medium', probability: 0.2 },
    ],
  },

  // Proyecto 3: CRITICAL (peor que el 1)
  3: {
    projectId: 3,
    projectName: 'Migración a Cloud - Empresa Industrial',
    status: 'In Progress',
    timeline: {
      startDate: '2025-11-01',
      endDate: '2026-05-30',
      daysElapsed: 201,
      daysRemaining: 10,
      percentageComplete: 45.0,
    },
    teamVelocity: [60, 55, 50, 48, 40],
    workPending: {
      epicsRemaining: 8,
      tasksRemaining: 120,
      totalStoryPoints: 450,
    },
    budget: {
      totalBudget: 1200000,
      spent: 950000,
      remaining: 250000,
      percentageSpent: 79.2,
    },
    resources: [
      { role: 'Cloud Architect', count: 2, costPerMonth: 18000 },
      { role: 'DevOps Engineer', count: 3, costPerMonth: 10000 },
      { role: 'Infrastructure QA', count: 2, costPerMonth: 5000 },
    ],
    risks: [
      { description: 'Data migration complexity', severity: 'critical', probability: 0.9 },
      { description: 'Regulatory compliance gaps', severity: 'critical', probability: 0.7 },
      { description: 'Downtime risk', severity: 'high', probability: 0.6 },
    ],
  },

  // Proyecto 4: EXCELENTE (para referencia)
  4: {
    projectId: 4,
    projectName: 'Mobile App - Fintech Startup',
    status: 'In Progress',
    timeline: {
      startDate: '2026-04-01',
      endDate: '2026-07-15',
      daysElapsed: 80,
      daysRemaining: 36,
      percentageComplete: 69.0,
    },
    teamVelocity: [50, 52, 55, 58, 60],
    workPending: {
      epicsRemaining: 3,
      tasksRemaining: 35,
      totalStoryPoints: 140,
    },
    budget: {
      totalBudget: 400000,
      spent: 220000,
      remaining: 180000,
      percentageSpent: 55.0,
    },
    resources: [
      { role: 'Lead Developer', count: 1, costPerMonth: 10000 },
      { role: 'Developer', count: 3, costPerMonth: 6000 },
      { role: 'Mobile QA', count: 2, costPerMonth: 3500 },
    ],
    risks: [
      { description: 'App store approval delays', severity: 'low', probability: 0.2 },
    ],
  },
};

// Helper para obtener proyecto por ID
export function getDummyProject(projectId: number) {
  return dummyProjects[projectId] || dummyProjects[1];
}