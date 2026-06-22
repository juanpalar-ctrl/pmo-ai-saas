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
    return `Eres experto en reportes. Genera DOS reportes simples.

Proyecto: ${input.projectName}
Risk: ${this.riskOutput?.analysis?.analysis?.overallRiskScore || 'MEDIUM'}
Budget: ${this.economicOutput?.analysis?.analysis?.budget_status || 'AT_RISK'}

RESPONDE SOLO:
{
  "senior_report": "Texto ejecutivo",
  "technical_report": "Texto técnico"
}`;
  }
  
  parseResponse(response: string): any {
    try {
      const clean = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const idx1 = clean.indexOf('{');
      const idx2 = clean.lastIndexOf('}');
      if (idx1 !== -1 && idx2 > idx1) {
        const json = JSON.parse(clean.substring(idx1, idx2 + 1));
        if (json.senior_report && json.technical_report) return json;
      }
    } catch (_) {}
    
    // FALLBACK
    return {
      senior_report: `REPORTE EJECUTIVO\n\nProyecto: ${this.riskOutput?.projectName || 'N/A'}\nRisk: ${this.riskOutput?.analysis?.analysis?.overallRiskScore || 'MEDIUM'}\nBudget Status: ${this.economicOutput?.analysis?.analysis?.budget_status || 'UNKNOWN'}\n\nRevisar análisis arriba para detalles completos.`,
      technical_report: `REPORTE TÉCNICO\n\nProyecto: ${this.riskOutput?.projectName || 'N/A'}\n\nAnalisis completado. Revisar secciones anteriores para recomendaciones específicas.`
    };
  }
}

export const reportingAgent = new ReportingAgent();
