import { BaseAgent } from './baseAgent';
import { AgentInput } from '../types/agents';

export class ReportingAgent extends BaseAgent {
  name = '📄 Reporting Agent';
  version = '2.0.0';
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
    const risk = this.riskOutput?.analysis?.analysis || {};
    const econ = this.economicOutput?.analysis?.analysis || {};

    const riskScore = risk.overallRiskScore || 'MEDIUM';
    const delayProb = risk.delayProbability != null ? `${(risk.delayProbability * 100).toFixed(0)}%` : 'N/A';
    const topRisks = (risk.topRisks || []).slice(0, 3).map((r: any) =>
      `- ${r.title || r.description}: ${r.description || ''} (impacto: ${r.impact || 'N/A'})`
    ).join('\n') || 'Sin riesgos críticos identificados';
    const mitigations = (risk.mitigationStrategies || []).slice(0, 3).map((m: any) =>
      `- ${typeof m === 'string' ? m : m.strategy || JSON.stringify(m)}`
    ).join('\n') || 'Sin estrategias de mitigación';

    const budgetStatus = econ.budget_status || 'UNKNOWN';
    const burnRate = econ.daily_burn_rate != null ? `$${Number(econ.daily_burn_rate).toLocaleString()}/día` : 'N/A';
    const worstCase = econ.worst_case_total_cost != null ? `$${Number(econ.worst_case_total_cost).toLocaleString()}` : 'N/A';
    const costOfDelay = econ.cost_of_delay != null ? `$${Number(econ.cost_of_delay).toLocaleString()}` : 'N/A';

    const pctComplete = input.timeline?.percentageComplete ?? 0;
    const daysRemaining = input.timeline?.daysRemaining ?? 'N/D';
    const budgetSpent = input.budget?.spent ?? 0;
    const budgetTotal = input.budget?.total ?? 0;

    // Map risk score → RAG
    const ragOverall = riskScore === 'HIGH' || riskScore === 'CRITICAL' ? '🔴 Rojo'
      : riskScore === 'MEDIUM' ? '🟡 Amarillo'
      : '🟢 Verde';

    const ragSchedule = pctComplete < 60 ? '🔴 Rojo'
      : pctComplete < 85 ? '🟡 Amarillo'
      : '🟢 Verde';

    const ragBudget = budgetStatus === 'OVER_BUDGET' ? '🔴 Rojo'
      : budgetStatus === 'AT_RISK' ? '🟡 Amarillo'
      : '🟢 Verde';

    const ragRisk = riskScore === 'CRITICAL' ? '🔴 Rojo'
      : riskScore === 'HIGH' ? '🟡 Amarillo'
      : '🟢 Verde';

    return `Eres un PMO senior experto en comunicación ejecutiva. Genera un Executive Status Report para el stakeholder de este proyecto.

DATOS DEL PROYECTO:
- Nombre: ${input.projectName}
- Avance: ${pctComplete}% completado | ${daysRemaining} días restantes
- Presupuesto gastado: $${Number(budgetSpent).toLocaleString()} de $${Number(budgetTotal).toLocaleString()} total
- Burn rate: ${burnRate}
- Probabilidad de delay: ${delayProb}
- Riesgo general: ${riskScore}
- Estado de presupuesto: ${budgetStatus}
- Costo del delay (si ocurre): ${costOfDelay}
- Costo peor caso: ${worstCase}

TOP RIESGOS:
${topRisks}

MITIGACIONES ACTIVAS:
${mitigations}

RAG STATUS (pre-calculado para que lo uses):
- Estado general: ${ragOverall}
- Tiempo / Schedule: ${ragSchedule}
- Presupuesto: ${ragBudget}
- Riesgos: ${ragRisk}

INSTRUCCIÓN: Genera el reporte para DOS audiencias. Para el reporte ejecutivo (senior_report), sigue EXACTAMENTE esta estructura:

---
## 📊 Estado Ejecutivo del Proyecto — ${input.projectName}

**Estado General:** ${ragOverall}

### 1. Resumen Ejecutivo
**Hitos clave del período:** [2-3 logros concretos y tangibles que el equipo entregó, basados en el % de avance]
**Próximos pasos críticos:** [Lo más importante que se liberará en las próximas 2 semanas]

### 2. Métricas de Salud

| Indicador | Estado | Nota |
|-----------|--------|------|
| Alcance (Scope) | [RAG emoji] | [1 línea honesta] |
| Tiempo (Schedule) | ${ragSchedule} | [1 línea concreta con días/% de desviación si aplica] |
| Presupuesto | ${ragBudget} | [burn rate + estado real] |
| Riesgos | ${ragRisk} | [el riesgo principal en 1 línea] |

### 3. ¿Dónde están los problemas?
**Bloqueos activos:** [Qué está frenando el proyecto HOY — sé específico y honesto]
**Riesgos en las próximas 2 semanas:** [Qué podría salir mal y por qué]

### 4. ¿Qué necesitas de mí?
**Decisiones pendientes:** [Aprobaciones, recursos o escalaciones que requieren al stakeholder]
**Plan de mitigación:** [Si hay algo en Amarillo o Rojo, explica el plan concreto para regresarlo a Verde]

> 💬 Nota del PM: [Una línea honesta y humana sobre el estado real del proyecto. Sin decorar la realidad.]
---

Para el technical_report, genera un reporte técnico más detallado para el equipo: métricas de performance (CPI/SPI si disponibles), detalle de riesgos técnicos, dependencias críticas y acciones tácticas por sprint.

RESPONDE SOLO con este JSON (sin markdown externo):
{
  "senior_report": "texto del reporte ejecutivo completo con la estructura de arriba",
  "technical_report": "texto del reporte técnico completo"
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

    const risk = this.riskOutput?.analysis?.analysis || {};
    const econ = this.economicOutput?.analysis?.analysis || {};
    return {
      senior_report: `## 📊 Estado Ejecutivo — ${this.riskOutput?.projectName || 'Proyecto'}

**Estado General:** 🟡 Amarillo

### 1. Resumen Ejecutivo
Análisis en progreso. Risk: ${risk.overallRiskScore || 'N/A'} | Budget: ${econ.budget_status || 'N/A'}

### 2. Métricas de Salud
| Indicador | Estado | Nota |
|-----------|--------|------|
| Presupuesto | 🟡 | ${econ.budget_status || 'Revisar'} |
| Riesgos | 🟡 | ${risk.overallRiskScore || 'Revisar'} |

### 4. ¿Qué necesitas de mí?
Revisar análisis completo de riesgos y económico para detalles adicionales.`,
      technical_report: `Reporte técnico no disponible. Revisar análisis de riesgo y económico.`
    };
  }
}

export const reportingAgent = new ReportingAgent();
