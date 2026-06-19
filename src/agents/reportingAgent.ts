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
  
  setAnalysisOutputs(riskOutput: any, economicOutput: any) {
    this.riskOutput = riskOutput;
    this.economicOutput = economicOutput;
  }
  
  validateInput(input: AgentInput): boolean {
    return !!(input.projectId && input.projectName);
  }
  
  buildPrompt(input: AgentInput): string {
    const systemPrompt = `
      Eres un experto en comunicación de proyectos.
      Creas reportes profesionales especializados por audiencia.
      Responde en JSON con dos propiedades: senior_report y technical_report
    `;
    
    const userPrompt = `
      CREA DOS REPORTES para el proyecto "${input.projectName}":
      
      1. SENIOR REPORT (para CTO/CFO/Sponsor):
         - 2 páginas máximo (markdown)
         - Enfoque: Decisiones necesarias, financiero, riesgos críticos
         - Tono: Ejecutivo, conciso
         - Incluye: Status, números clave, qué necesitas de ellos
      
      2. TECHNICAL REPORT (para Tech Lead/Architects):
         - 4 páginas (markdown)
         - Enfoque: Blockers técnicos, capacidad, próximas prioridades
         - Tono: Detallado, técnico
         - Incluye: Velocity, trabajo pendiente, riesgos técnicos
      
      DATOS DEL RISK AGENT:
      ${JSON.stringify(this.riskOutput?.analysis)}
      
      DATOS DEL ECONOMIC AGENT:
      ${JSON.stringify(this.economicOutput?.analysis)}
      
      Responde SOLO en JSON válido:
      {
        "senior_report": "Markdown aquí...",
        "technical_report": "Markdown aquí..."
      }
    `;
    
    return `${systemPrompt}\n\n${userPrompt}`;
  }
  
 parseResponse(response: string): any {
    try {
      let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      return JSON.parse(jsonMatch[0]);
    } catch (error: any) {
      console.error('Error parsing reporting agent response:', error.message);
      return {
        senior_report: '# Reporte Ejecutivo\n\nAnálisis en progreso...',
        technical_report: '# Reporte Técnico\n\nAnálisis en progreso...',
      };
    }
  }
}

// Exportar instancia
export const reportingAgent = new ReportingAgent();