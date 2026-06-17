// ============================================
// FRAMEWORK SCRUM
// Sistema de gestión ágil con sprints de 2 semanas
// ============================================

// Exportar objeto con la definición de Scrum
export const scrum = {
  // Nombre del framework
  name: 'Scrum',
  
  // Emoji/ícono para el dashboard
  icon: '🎯',
  
  // Descripción corta
  description: 'Sprints de 2 semanas, Daily Standups y Retrospectivas para iteración continua.',
  
  // MÉTRICAS (números que medimos)
  metrics: {
    // Métricas que usan TODOS los frameworks
    general: {
      // Retorno sobre inversión (ganancia/inversión)
      ROI: '+28%',
      
      // Dinero planeado para gastar
      'Costos Planeados': '$150K',
      
      // Dinero realmente gastado
      'Costos Reales': '$142K',
      
      // Cantidad de proyectos activos
      'Proyectos Activos': 8,
    },
    
    // Métricas ESPECÍFICAS de Scrum
    specific: {
      // Velocidad = cantidad de trabajo hecho por sprint
      'Velocity (puntos/sprint)': '45 pts',
      
      // Porcentaje de tareas completadas en el sprint
      'Sprint Completion Rate': '92%',
      
      // Días de duración del sprint
      'Sprint Duration': '14 días',
      
      // Eficiencia en el uso del tiempo
      'Team Efficiency': '87%',
    },
  },
};