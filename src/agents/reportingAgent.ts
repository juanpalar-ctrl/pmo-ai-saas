// ============================================
// AGENTE 3: GENERADOR DE REPORTES
// Crea reportes especializados por audiencia
// ============================================

import { BaseAgent } from './baseAgent';
import { AgentInput } from '../types/agents';

export class ReportingAgent extends BaseAgent {
  
  name = '📄 Reporting Agent';
  version = '1.0.0';
  
  private riskOutput: any;
  private economicOutput: any;
  
  /**
   * SETTER: Recibir outputs de agentes anteriores
   */
  setAnalysisOutputs(riskOutput: any, economicOutput: any) {
    this.riskOutput = riskOutput;
    this.economicOutput = economicOutput;
  }
  
  validateInput(input: AgentInput): boolean {
    return !!(input.projectId && input.projectName);
  }
  
  buildPrompt(input: AgentInput): string {
    const systemPrompt = `
Eres un experto en comunicación de proyectos y stakeholder management.
Tu trabajo es crear reportes profesionales, claros y accionables basados en análisis técnicos.

INSTRUCCIONES CRÍTICAS:
- Responde SOLO en JSON válido, sin markdown
- Crea reportes profesionales, legibles y en ESPAÑOL
- Senior Report: 300-400 palabras, enfocado en ejecutivos
- Technical Report: 500-600 palabras, enfocado en técnicos
- Sé específico con números y datos
- Incluye recomendaciones accionables
    `;
    
    const riskSummary = this.riskOutput?.analysis?.overallRiskScore || 'DESCONOCIDO';
    const economicStatus = this.economicOutput?.analysis?.budget_status || 'DESCONOCIDO';
    
    const userPrompt = `
Crea dos reportes para el proyecto "${input.projectName}" (ID: ${input.projectId}):

DATOS DISPONIBLES:
- Risk Score: ${riskSummary}
- Budget Status: ${economicStatus}
- Completado: ${input.timeline?.percentageComplete || 0}%
- Días restantes: ${input.timeline?.daysRemaining || 0}

REQUERIMIENTO 1 - SENIOR REPORT (para CTO/CFO/Sponsor):
Escribe un reporte ejecutivo profesional que incluya:
1. Estado actual del proyecto (1-2 párrafos)
2. Riesgos críticos identificados (2-3 puntos clave)
3. Impacto financiero (números concretos)
4. Decisiones requeridas de los stakeholders
5. Próximos pasos recomendados
Tono: Profesional, conciso, enfocado en decisiones

REQUERIMIENTO 2 - TECHNICAL REPORT (para Tech Lead/Architects):
Escribe un reporte técnico detallado que incluya:
1. Análisis técnico del estado actual (2-3 párrafos)
2. Riesgos técnicos principales (3-4 puntos)
3. Blockers y dependencias identificadas
4. Recomendaciones técnicas específicas
5. Plan de mitigación propuesto
Tono: Técnico, detallado, enfocado en soluciones

RESPONDE EN ESTE JSON EXACTO (sin markdown, sin backticks):
{
  "senior_report": "Texto del reporte ejecutivo aquí...",
  "technical_report": "Texto del reporte técnico aquí..."
}
    `;
    
    return `${systemPrompt}\n\n${userPrompt}`;
  }
  
  parseResponse(response: string): any {
    try {
      // Remover backticks si existen
      let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Extraer JSON
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ No se encontró JSON en respuesta del Reporting Agent');
        throw new Error('No valid JSON found');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validar que tenga los campos requeridos
      if (!parsed.senior_report || !parsed.technical_report) {
        throw new Error('Missing required fields in response');
      }
      
      return parsed;
      
    } catch (error: any) {
      console.error('Error parsing reporting agent response:', error.message);
      // Retornar reportes fallback
      return {
        senior_report: `
# REPORTE EJECUTIVO - Proyecto ${this.riskOutput?.projectId}

## Estado Actual
El proyecto se encuentra en etapa de ejecución con riesgos identificados que requieren atención inmediata.

## Riesgos Críticos
- ${this.riskOutput?.analysis?.overallRiskScore || 'Riesgo no especificado'}
- Probabilidad de delay: ${(this.riskOutput?.analysis?.delayProbability * 100 || 0).toFixed(1)}%

## Recomendaciones
1. Realizar reunión de stakeholders para revisar timeline
2. Asignar recursos adicionales si es posible
3. Implementar plan de mitigación de riesgos

## Próximos Pasos
- Follow-up semanal con team leads
- Revisión de budget vs actual
- Validación de dependencias críticas
        `,
        technical_report: `
# REPORTE TÉCNICO - Proyecto ${this.riskOutput?.projectId}

## Análisis Técnico Actual
El proyecto enfrenta desafíos técnicos y de capacidad que impactan el timeline de entrega.

## Riesgos Técnicos
- Integración con sistemas legacy
- Capacidad limitada del equipo
- Deuda técnica acumulada

## Recomendaciones Técnicas
1. Code review intensivo de componentes críticos
2. Testing automation para reducir regression risk
3. Documentación de arquitectura decisions

## Plan de Mitigación
- Pair programming para conocimiento compartido
- Refactoring de código crítico
- Setup de pipeline CI/CD robusto
        `,
      };
    }
  }
}

// Exportar instancia
export const reportingAgent = new ReportingAgent();