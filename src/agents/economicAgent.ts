// ============================================
// AGENTE 2: ANÁLISIS DE PERFORMANCE ECONÓMICO
// Analiza presupuesto, costos y impacto financiero
// ============================================

import { BaseAgent } from './baseAgent';
import { AgentInput } from '../types/agents';

export class EconomicAnalysisAgent extends BaseAgent {
  
  name = '💰 Economic Performance Agent';
  version = '1.0.0';
  
  // Para este agente, también necesita output del Risk Agent
  private riskAnalysisOutput: any;
  
  // Setter para recibir output del Risk Agent
  setRiskAnalysis(riskOutput: any) {
    this.riskAnalysisOutput = riskOutput;
  }
  
  validateInput(input: AgentInput): boolean {
    return !!(
      input.projectId &&
      input.budget &&
      input.timeline &&
      input.resources
    );
  }
  
  buildPrompt(input: AgentInput): string {
    const systemPrompt = `
      Eres un experto en gestión financiera de proyectos.
      Analiza presupuesto, costos y predice impacto económico de delays.
      Responde SOLO en JSON válido.
    `;
    
    const userPrompt = `
      PRESUPUESTO TOTAL: $${input.budget?.totalBudget || 0}
      GASTADO: $${input.budget?.spent || 0}
      PORCENTAJE: ${input.budget?.percentageSpent || 0}%
      
      PROYECCIÓN DE DELAY (del Risk Agent): ${this.riskAnalysisOutput?.analysis?.delayProbability * 100 || 0}%
      DÍAS DE DELAY ESTIMADO: ${this.riskAnalysisOutput?.analysis?.delayProbability * 30 || 0}
      
      RECURSOS:
      ${input.resources?.map((r: any) => `${r.role}: ${r.count} personas @ $${r.costPerMonth}/mes`).join('\n') || 'Ninguno'}
      
      ANALIZA:
      1. Quema de presupuesto actual
      2. Costo si hay delay
      3. Eficiencia de recursos
      4. Recomendaciones financieras
      
      Responde en JSON:
      {
        "budget_status": "OVERSPENT|AT_RISK|ON_TRACK",
        "variance": 0,
        "worst_case_total_cost": 0,
        "cost_of_delay": 0,
        "recommendations": []
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
      console.error('Error parsing economic agent response:', error.message);
      return {
        budget_status: 'AT_RISK',
        variance: 0,
        worst_case_total_cost: 0,
        recommendations: [],
      };
    }
  }
}

// Exportar instancia
export const economicAgent = new EconomicAnalysisAgent();