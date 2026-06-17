export const kanbanSkill = {
  name: 'Kanban',
  icon: '📋',
  description: 'Flujo continuo de trabajo, limitación de WIP y mejora incremental sin iteraciones fijas.',
  metrics: {
    general: ['ROI', 'Costos Planeados', 'Costos Reales', 'Proyectos Activos'],
    specific: [
      { name: 'Lead Time', value: '8.5 días', description: 'Tiempo desde solicitud hasta entrega' },
      { name: 'WIP Limit', value: '15 tareas', description: 'Máximo de tareas en progreso' },
      { name: 'Throughput', value: '12 tareas/semana', description: 'Tareas completadas por semana' }
    ]
  }
};
