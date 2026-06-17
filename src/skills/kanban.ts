// ============================================
// FRAMEWORK KANBAN
// Sistema de flujo continuo sin sprints
// ============================================

// Exportar objeto con la definición de Kanban
export const kanban = {
  // Nombre del framework
  name: 'Kanban',
  
  // Emoji/ícono para el dashboard
  icon: '📋',
  
  // Descripción corta
  description: 'Flujo continuo con límites de trabajo en progreso (WIP) y entregas frecuentes.',
  
  // MÉTRICAS (números que medimos)
  metrics: {
    // Métricas que usan TODOS los frameworks
    general: {
      // Retorno sobre inversión
      ROI: '+28%',
      
      // Dinero planeado para gastar
      'Costos Planeados': '$150K',
      
      // Dinero realmente gastado
      'Costos Reales': '$142K',
      
      // Cantidad de proyectos activos
      'Proyectos Activos': 8,
    },
    
    // Métricas ESPECÍFICAS de Kanban
    specific: {
      // Tiempo promedio desde inicio hasta finalización
      'Lead Time (días)': '8.5 días',
      
      // Tiempo que una tarea está en progreso
      'Cycle Time': '6 días',
      
      // Cantidad máxima de tareas en progreso
      'WIP Limit (max tasks)': '10',
      
      // Porcentaje de flujo sin bloqueos
      'Flow Efficiency': '79%',
    },
  },
};