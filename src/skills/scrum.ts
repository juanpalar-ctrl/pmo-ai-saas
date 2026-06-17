export const scrumSkill = {
  name: 'Scrum',
  icon: '🎯',
  description: 'Sprints de 2 semanas, Daily Standups y Retrospectivas para iteración continua.',
  metrics: {
    general: ['ROI', 'Costos Planeados', 'Costos Reales', 'Proyectos Activos'],
    specific: [
      { name: 'Velocity', value: '32 puntos', description: 'Puntos completados por sprint' },
      { name: 'Burndown', value: '85%', description: 'Trabajo completado en sprint actual' },
      { name: 'Sprint Duration', value: '2 semanas', description: 'Duración estándar del sprint' }
    ]
  }
};
