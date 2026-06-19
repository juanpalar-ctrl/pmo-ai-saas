import { BaseAgent } from './baseAgent';
import { AgentInput } from '../types/agents';

export class RiskAgent extends BaseAgent {
  name = '🎯 Risk Analysis Agent';
  version = '1.0.0';
  private framework: string = 'scrum';

  setFramework(fw: string) { this.framework = fw; }
  validateInput(input: AgentInput): boolean { return !!(input.projectId && input.projectName); }

  private getFrameworkSpecificPrompt(): string {
    const prompts: any = {
      scrum: `SCRUM Framework Analysis:
- Identifica riesgos en SPRINTS, VELOCIDAD, CAMBIOS DE ALCANCE
- Riesgos típicos: requisitos ambiguos, team availability, technical debt, stakeholder communication
- Siempre retorna al menos 3 riesgos ESPECÍFICOS de Scrum`,
      
      kanban: `KANBAN Framework Analysis:
- Identifica riesgos en FLUJO, CICLO DE TIEMPO, WIP LIMITS
- Riesgos típicos: bottlenecks, WIP violations, cycle time drift, flow efficiency drops
- Siempre retorna al menos 3 riesgos ESPECÍFICOS de Kanban`,
      
      waterfall: `WATERFALL Framework Analysis:
- Identifica riesgos en FASES, GATES, CAMBIOS DE SCOPE
- Riesgos típicos: gate failures, scope creep, late requirement changes, phase delays
- Siempre retorna al least 3 riesgos ESPECÍFICOS de Waterfall`,
      
      safe: `SAFe Framework Analysis:
- Identifica riesgos en PI PLANNING, DEPENDENCIES, TEAM ALIGNMENT
- Riesgos típicos: dependency management, PI objective misalignment, team capacity issues
- Siempre retorna al least 3 riesgos ESPECÍFICOS de SAFe`
    };
    return prompts[this.framework] || prompts.scrum;
  }

  buildPrompt(input: AgentInput): string {
    return `Eres experto en ANÁLISIS DE RIESGOS para proyectos ${this.framework.toUpperCase()}.

${this.getFrameworkSpecificPrompt()}

PROYECTO: "${input.projectName}"
AVANCE: ${input.timeline?.percentageComplete || 0}%
FRAMEWORK: ${this.framework.toUpperCase()}

INSTRUCCIÓN CRÍTICA:
- Retorna SIEMPRE un JSON válido (sin markdown)
- GARANTIZA al menos 3 riesgos (pueden ser genéricos si no hay datos específicos)
- Cada riesgo DEBE tener: title, description, probability (0-1), impact (LOW/MEDIUM/HIGH)
- Si no tienes datos, crea riesgos REALISTAS para ${this.framework}

JSON REQUERIDO (EXACTAMENTE ESTE FORMATO):
{
  "analysis": {
    "overallRiskScore": "LOW|MEDIUM|HIGH|CRITICAL",
    "delayProbability": 0.0-1.0,
    "topRisks": [
      {
        "title": "Título breve",
        "description": "Descripción detallada específica de ${this.framework}",
        "probability": 0.0-1.0,
        "impact": "LOW|MEDIUM|HIGH"
      }
    ],
    "recommendations": [
      {
        "action": "Acción concreta para ${this.framework}",
        "priority": "HIGH|MEDIUM|LOW"
      }
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
      
      // GARANTIZAR estructura mínima
      if (!parsed.analysis) parsed.analysis = {};
      if (!parsed.analysis.topRisks) parsed.analysis.topRisks = [];
      if (!parsed.analysis.recommendations) parsed.analysis.recommendations = [];
      
      // GARANTIZAR al menos 3 riesgos
      const frameworkRisks: any = {
        scrum: [
          {
            title: 'Cambios en requisitos del sprint',
            description: 'Scope creep durante el sprint reduce velocidad y afecta predictibilidad',
            probability: 0.4,
            impact: 'MEDIUM'
          },
          {
            title: 'Disponibilidad del equipo',
            description: 'Miembros del equipo ausentes o con compromisos conflictivos',
            probability: 0.3,
            impact: 'MEDIUM'
          },
          {
            title: 'Deuda técnica acumulada',
            description: 'Falta de refactoring ralentiza sprints futuros',
            probability: 0.35,
            impact: 'HIGH'
          }
        ],
        kanban: [
          {
            title: 'Bottleneck en pruebas',
            description: 'Etapa de testing sobrecargada ralentiza flujo completo',
            probability: 0.45,
            impact: 'HIGH'
          },
          {
            title: 'Aumento en cycle time',
            description: 'Items permanecen más tiempo en el flujo de lo esperado',
            probability: 0.4,
            impact: 'MEDIUM'
          },
          {
            title: 'Violación de WIP limits',
            description: 'Equipo inicia más trabajo antes de completar actual',
            probability: 0.35,
            impact: 'MEDIUM'
          }
        ],
        waterfall: [
          {
            title: 'Cambios de alcance en fases tardías',
            description: 'Descubrimiento de requisitos faltantes después de diseño',
            probability: 0.5,
            impact: 'HIGH'
          },
          {
            title: 'Falla en gates de revisión',
            description: 'Fase no cumple criterios de aprobación requiere rework',
            probability: 0.35,
            impact: 'HIGH'
          },
          {
            title: 'Dependencias externas sin considerar',
            description: 'APIs o sistemas externos tienen delays no planeados',
            probability: 0.3,
            impact: 'MEDIUM'
          }
        ],
        safe: [
          {
            title: 'Dependencias inter-team no resueltas',
            description: 'Equipos bloqueados esperando trabajo de otros equipos',
            probability: 0.4,
            impact: 'HIGH'
          },
          {
            title: 'PI Objectives desalineados',
            description: 'Equipos comprometieron objetivos sin validar capacidad',
            probability: 0.35,
            impact: 'MEDIUM'
          },
          {
            title: 'Capacidad insuficiente para compromisos',
            description: 'Team velocity no soporta cantidad de story points asignados',
            probability: 0.3,
            impact: 'MEDIUM'
          }
        ]
      };

      if (parsed.analysis.topRisks.length === 0) {
        parsed.analysis.topRisks = frameworkRisks[this.framework] || frameworkRisks.scrum;
      }

      if (!parsed.analysis.overallRiskScore) {
        const avgProbability = parsed.analysis.topRisks.reduce((sum: number, r: any) => sum + (r.probability || 0), 0) / (parsed.analysis.topRisks.length || 1);
        if (avgProbability > 0.6) parsed.analysis.overallRiskScore = 'HIGH';
        else if (avgProbability > 0.4) parsed.analysis.overallRiskScore = 'MEDIUM';
        else parsed.analysis.overallRiskScore = 'LOW';
      }

      if (!parsed.analysis.delayProbability) {
        parsed.analysis.delayProbability = parsed.analysis.topRisks.reduce((max: number, r: any) => Math.max(max, r.probability || 0), 0);
      }

      return parsed;
    } catch (error: any) {
      console.error('Error parsing risk:', error.message);
      const fallback: any = {
        scrum: {
          overallRiskScore: 'MEDIUM',
          delayProbability: 0.4,
          topRisks: [
            { title: 'Cambios de alcance', description: 'Risk de scope creep en sprints', probability: 0.4, impact: 'MEDIUM' },
            { title: 'Disponibilidad', description: 'Team members con conflictos', probability: 0.3, impact: 'MEDIUM' },
            { title: 'Deuda técnica', description: 'Código heredado ralentiza desarrollo', probability: 0.35, impact: 'HIGH' }
          ]
        },
        kanban: {
          overallRiskScore: 'MEDIUM',
          delayProbability: 0.4,
          topRisks: [
            { title: 'Bottleneck en testing', description: 'QA sobrecargada', probability: 0.45, impact: 'HIGH' },
            { title: 'Cycle time drift', description: 'Tiempo en flujo aumentando', probability: 0.4, impact: 'MEDIUM' },
            { title: 'WIP violations', description: 'Límites de trabajo en progreso excedidos', probability: 0.35, impact: 'MEDIUM' }
          ]
        },
        waterfall: {
          overallRiskScore: 'MEDIUM',
          delayProbability: 0.4,
          topRisks: [
            { title: 'Scope creep late', description: 'Requisitos nuevos en fases tardías', probability: 0.5, impact: 'HIGH' },
            { title: 'Gate failures', description: 'Fase no cumple criterios de aprobación', probability: 0.35, impact: 'HIGH' },
            { title: 'Dependencias externas', description: 'Sistemas externos con delays', probability: 0.3, impact: 'MEDIUM' }
          ]
        },
        safe: {
          overallRiskScore: 'MEDIUM',
          delayProbability: 0.4,
          topRisks: [
            { title: 'Inter-team dependencies', description: 'Teams bloqueados entre sí', probability: 0.4, impact: 'HIGH' },
            { title: 'PI misalignment', description: 'Objetivos desalineados', probability: 0.35, impact: 'MEDIUM' },
            { title: 'Capacity mismatch', description: 'Velocity insuficiente', probability: 0.3, impact: 'MEDIUM' }
          ]
        }
      };
      return { analysis: fallback[this.framework] || fallback.scrum };
    }
  }
}

export const riskAgent = new RiskAgent();
