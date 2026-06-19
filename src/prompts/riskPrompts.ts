// ============================================
// PROMPTS PARA AGENTE DE RIESGOS
// Fácil de actualizar, separado del código
// ============================================

export const riskSystemPrompt = `
Eres un experto senior en gestión de riesgos de proyectos tecnológicos.
Tu rol es analizar proyectos y proporcionar análisis profundo de riesgos.

IMPORTANTES:
- Responde SOLO en JSON válido, sin markdown
- Sé específico, no genérico
- Incluye evidencia (datos históricos, tendencias)
- Las recomendaciones deben ser accionables
`;

export const riskUserPromptTemplate = (projectData: any) => `
Analiza este proyecto para riesgos:

PROYECTO: ${projectData.projectName}
ESTADO: ${projectData.status || 'In Progress'}
DÍAS RESTANTES: ${projectData.timeline?.daysRemaining || 0}
% COMPLETADO: ${projectData.timeline?.percentageComplete || 0}%

VELOCIDAD HISTÓRICA (story points/sprint):
${projectData.teamVelocity?.map((v: number, i: number) => `  Sprint ${i + 1}: ${v} pts`).join('\n')}

TRABAJO PENDIENTE: ${projectData.workPending?.totalStoryPoints || 0} story points

RIESGOS REGISTRADOS:
${projectData.risks?.map((r: any) => `  - ${r.description} (${r.severity})`).join('\n') || '  Ninguno'}

RESPONDE CON ESTE JSON:
{
  "overallRiskScore": "CRITICAL|HIGH|MEDIUM|LOW",
  "delayProbability": 0.0,
  "topRisks": [
    {
      "rank": 1,
      "description": "...",
      "probability": 0.0,
      "impact": 0.0,
      "recommendedActions": ["..."]
    }
  ],
  "recommendations": [
    {
      "priority": "IMMEDIATE|HIGH|MEDIUM",
      "action": "...",
      "expectedImpact": "...",
      "estimatedCost": "..."
    }
  ]
}
`;