// ============================================
// AGENTE 1: ANÁLISIS DE RIESGOS
// Detecta y predice riesgos del proyecto
// ============================================

import { BaseAgent } from './baseAgent';
import { AgentInput } from '../types/agents';
import { riskSystemPrompt, riskUserPromptTemplate } from '../prompts/riskPrompts';

export class RiskAnalysisAgent extends BaseAgent {
  
  name = '🎯 Risk Analysis Agent';
  version = '1.0.0';
  
  // Validar que los datos necesarios existen
  validateInput(input: AgentInput): boolean {
    return !!(
      input.projectId &&
      input.projectName &&
      input.timeline &&
      input.teamVelocity &&
      input.workPending
    );
  }
  
  // Construir el prompt exacto que enviamos a Claude
  buildPrompt(input: AgentInput): string {
    return `${riskSystemPrompt}\n\n${riskUserPromptTemplate(input)}`;
  }
  
  // Parsear la respuesta de Claude (extraer JSON)
 // Parsear la respuesta de Claude (extraer JSON)
  parseResponse(response: string): any {
    try {
      // Remover backticks de markdown si existen
      let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Extraer JSON del response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      // Parse y validar
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (error: any) {
      console.error('Error parsing risk agent response:', error.message);
      // Si falla, retornar estructura mínima válida
      return {
        overallRiskScore: 'HIGH',
        delayProbability: 0.75,
        topRisks: [],
        recommendations: [],
      };
    }
    }
}

// Exportar instancia
export const riskAgent = new RiskAnalysisAgent();