import { BaseAgent } from './baseAgent';
import { AgentInput } from '../types/agents';
import { agentLogger } from '../core/logger';

export class EconomicAgent extends BaseAgent {
  name = '💰 Economic Performance Agent';
  version = '1.0.0';
  private framework: string = 'scrum';

  setFramework(fw: string) { this.framework = fw; }
  validateInput(input: AgentInput): boolean { return !!(input.projectId && input.projectName); }

  private getFrameworkMetrics(): string {
    const metrics: any = {
      scrum: `SCRUM Economics:
- Cost per Sprint, Cost per Story Point
- Sprint Velocity trends
- Rework cost (defects discovered late)`,
      
      kanban: `KANBAN Economics:
- Cost per Item, Cost per Cycle Time unit
- Throughput trends
- WIP holding cost`,
      
      waterfall: `WATERFALL Economics:
- Cost per Phase, Phase Gate cost
- Rework % (late changes)
- Schedule variance impact`,
      
      safe: `SAFe Economics:
- Cost per PI, Cost per Objective
- Team Sync cost
- Dependency cost`
    };
    return metrics[this.framework] || metrics.scrum;
  }

  buildPrompt(input: AgentInput): string {
    return `Eres experto en ANÁLISIS ECONÓMICO para proyectos ${this.framework.toUpperCase()}.

${this.getFrameworkMetrics()}

PROYECTO: "${input.projectName}"
BUDGET TOTAL: $${input.budget?.total || 500000}
GASTO ACTUAL: $${input.budget?.spent || 0}
AVANCE: ${input.timeline?.percentageComplete || 0}%

INSTRUCCIÓN CRÍTICA:
- Retorna SIEMPRE un JSON válido (sin markdown)
- Calcula economía realista basada en datos
- Si faltan datos, usa valores CONSERVADORES y realistas

JSON REQUERIDO:
{
  "analysis": {
    "budget_status": "ON_TRACK|AT_RISK|CRITICAL",
    "budget_health": 0.0-1.0,
    "daily_burn_rate": number,
    "monthly_resource_cost": number,
    "worst_case_total_cost": number,
    "cost_of_delay": number,
    "recommendations": [
      {"action": "Acción concreta", "priority": "HIGH|MEDIUM|LOW"}
    ]
  }
}`;
  }

  parseResponse(response: string): any {
    try {
      let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const startIdx = cleanResponse.indexOf('{');
      const endIdx = cleanResponse.lastIndexOf('}');
      
      if (startIdx === -1 || endIdx === -1) throw new Error('No JSON');
      
      const parsed = JSON.parse(cleanResponse.substring(startIdx, endIdx + 1));
      
      // GARANTIZAR estructura
      if (!parsed.analysis) parsed.analysis = {};
      if (!parsed.analysis.recommendations) parsed.analysis.recommendations = [];
      
      // LLENAR VALORES POR DEFECTO SI FALTAN
      if (!parsed.analysis.budget_status) parsed.analysis.budget_status = 'AT_RISK';
      if (!parsed.analysis.budget_health) parsed.analysis.budget_health = 0.75;
      if (!parsed.analysis.daily_burn_rate) parsed.analysis.daily_burn_rate = 2000;
      if (!parsed.analysis.monthly_resource_cost) parsed.analysis.monthly_resource_cost = 47000;
      if (!parsed.analysis.worst_case_total_cost) parsed.analysis.worst_case_total_cost = 569250;
      if (!parsed.analysis.cost_of_delay) parsed.analysis.cost_of_delay = 79750;

      return parsed;
    } catch (error: any) {
      agentLogger.error({ err: error.message }, 'Error parsing economic');
      // original:, error.message);
      return {
        analysis: {
          budget_status: 'AT_RISK',
          budget_health: 0.75,
          daily_burn_rate: 2000,
          monthly_resource_cost: 47000,
          worst_case_total_cost: 569250,
          cost_of_delay: 79750,
          recommendations: [
            { action: 'Monitorear burn rate diariamente', priority: 'HIGH' },
            { action: 'Revalidar scope vs presupuesto', priority: 'MEDIUM' }
          ]
        }
      };
    }
  }
}

export const economicAgent = new EconomicAgent();
