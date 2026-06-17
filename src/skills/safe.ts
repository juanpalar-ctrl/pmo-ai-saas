// ============================================
// FRAMEWORK SAFE (Scaled Agile Framework)
// Sistema ágil para empresas grandes
// ============================================

// Exportar objeto con la definición de SAFe
export const safe = {
  // Nombre del framework
  name: 'SAFe',
  
  // Emoji/ícono para el dashboard
  icon: '🏢',
  
  // Descripción corta
  description: 'Marco escalable para múltiples equipos, alineados a nivel de programa.',
  
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
    
    // Métricas ESPECÍFICAS de SAFe
    specific: {
      // Número de equipos coordinados
      'Teams Aligned': '6 teams',
      
      // Alineación de objetivos entre equipos
      'Program Alignment': '94%',
      
      // Duración de cada incremento de programa
      'PI (Program Increment) Length': '10 semanas',
      
      // Porcentaje de objetivos cumplidos en el PI
      'PI Success Rate': '88%',
    },
  },
};