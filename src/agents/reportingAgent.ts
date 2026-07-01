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

    // Map risk score → RAG. Kept in sync with ragRisk()/ragBudget() in
    // public/projects.html so the AI-generated report and the dashboard never
    // disagree on the same underlying riskScore/budgetStatus value.
    const ragOverall = riskScore === 'HIGH' || riskScore === 'CRITICAL' ? '🔴 Rojo'
      : riskScore === 'MEDIUM' ? '🟡 Amarillo'
      : '🟢 Verde';

    const ragSchedule = pctComplete < 60 ? '🔴 Rojo'
      : pctComplete < 85 ? '🟡 Amarillo'
      : '🟢 Verde';

    const ragBudget = budgetStatus === 'ON_TRACK' ? '🟢 Verde'
      : budgetStatus === 'AT_RISK' ? '🟡 Amarillo'
      : '🔴 Rojo';

    const ragRisk = ragOverall;

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

Para el technical_report, genera un reporte técnico para el líder de desarrollo / líder técnico. Habla de colega a colega: sin diplomacia corporativa, directo al motor del proyecto. Sigue EXACTAMENTE esta estructura:

---
## 🛠️ Salud Técnica y Flujo de Entrega — ${input.projectName}

### 1. Estado del Flujo de Características
**Deployment Frequency:** [Estimado basado en el avance: ¿se está desplegando frecuentemente o hay cuellos de botella?]
**Lead Time for Changes:** [Estimado: ¿qué tan rápido fluye una tarea de "In Dev" a producción dado el avance actual?]
**Estado del ciclo actual:**
- 🔨 En desarrollo: [estimado basado en % completado y ritmo]
- 🔍 En Code Review / QA: [¿hay señales de acumulación dado el riesgo y probabilidad de delay?]
- ✅ Listas para producción: [inferido del avance]

### 2. Tablero de Salud Técnica

| Dimensión | Estado | Métrica / Alerta |
|-----------|--------|-----------------|
| Estabilidad de Arquitectura | [RAG] | [¿El riesgo técnico indica problemas de arquitectura?] |
| Calidad de Código | [RAG] | [Inferido de riesgos técnicos y probabilidad de delay] |
| Deuda Técnica | [RAG] | [¿Hay señales de deuda técnica en los riesgos identificados?] |
| Infraestructura / CI-CD | [RAG] | [Estado del pipeline y entornos dado el burn rate y bloqueos] |

### 3. ¿Qué está bloqueando al equipo hoy?
**Bloqueos técnicos concretos:** [Sé específico: dependencias, APIs de terceros, modelos de datos sin migrar, configuraciones rotas — basado en los riesgos detectados]
**Cuellos de botella del proceso:** [¿Dónde se están acumulando las tareas? Code Review saturado, QA devolviendo cards, etc.]

### 4. ¿La arquitectura aguanta lo que viene?
**Capacidad para el próximo ciclo:** [¿El diseño actual soporta las features siguientes o hay que tunear rendimiento/escalar antes?]
**Puntos únicos de fallo:** [Componentes críticos sin redundancia o microservicios/agentes con riesgo de caída]
**Plan de contingencia técnica:** [Qué hace el equipo si ese componente falla — concreto y accionable]

### 5. Acciones tácticas inmediatas
1. [Acción concreta #1 — quién, qué, cuándo]
2. [Acción concreta #2]
3. [Acción concreta #3]

> 🔧 Nota técnica: [Una línea honesta sobre el estado real del stack/equipo. Sin abstracciones.]
---

RESPONDE usando EXACTAMENTE este formato de texto plano (NO uses JSON, NO uses bloques de código):

===SENIOR_REPORT===
[aquí el reporte ejecutivo completo con la estructura de arriba]
===TECHNICAL_REPORT===
[aquí el reporte técnico completo con la estructura de arriba]
===END===`;
  }

  parseResponse(response: string): any {
    try {
      const clean = response.replace(/```[a-z]*\n?/gi, '').trim();
      // Tolerant markers: optional spaces/underscores/dashes, any number of "=", case-insensitive
      const SENIOR = /=*\s*SENIOR[_\s-]?REPORT\s*=*/i;
      const TECHNICAL = /=*\s*TECHNICAL[_\s-]?REPORT\s*=*/i;
      const END = /=*\s*END\s*=*/i;

      const seniorStart = clean.search(SENIOR);
      const technicalStart = clean.search(TECHNICAL);

      let senior: string | undefined;
      let technical: string | undefined;

      if (seniorStart !== -1 && technicalStart !== -1 && technicalStart > seniorStart) {
        senior = clean.slice(seniorStart, technicalStart).replace(SENIOR, '').trim();
        const rest = clean.slice(technicalStart).replace(TECHNICAL, '').trim();
        const endStart = rest.search(END);
        technical = (endStart !== -1 ? rest.slice(0, endStart) : rest).trim();
      }

      if (senior && technical) {
        return { senior_report: senior, technical_report: technical };
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
