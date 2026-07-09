import { BaseAgent } from './baseAgent';
import { AgentInput, AgentOutput } from '../types/agents';
import { anthropicClient, aiConfig } from '../config/anthropic';
import { agentLogger } from '../core/logger';
import { normalizeLang, languageDirective, ragLabel, RagColor } from '../config/language';

interface ReportContext {
  lang: 'es' | 'en';
  projectName: string;
  pctComplete: number;
  daysRemaining: number | string;
  budgetSpent: number;
  budgetTotal: number;
  burnRate: string;
  delayProb: string;
  riskScore: string;
  budgetStatus: string;
  costOfDelay: string;
  worstCase: string;
  topRisks: string;
  mitigations: string;
  ragOverall: string;
  ragSchedule: string;
  ragBudget: string;
  ragRisk: string;
}

export class ReportingAgent extends BaseAgent {
  name = '📄 Reporting Agent';
  version = '3.0.0';
  // Each report gets its own full budget now (see analyze() override below) —
  // no longer shared between senior_report and technical_report, so this only
  // needs to cover ONE report's worst case.
  protected maxTokens = 4096;
  private riskOutput: any;
  private economicOutput: any;

  setAnalysisOutputs(riskOutput: any, economicOutput: any) {
    this.riskOutput = riskOutput;
    this.economicOutput = economicOutput;
  }

  validateInput(input: AgentInput): boolean {
    return !!(input.projectId && input.projectName);
  }

  private buildContext(input: AgentInput): ReportContext {
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

    const lang = normalizeLang(input.lang);

    // Map risk score → RAG color. Colors are kept in sync with ragRisk()/
    // ragBudget() in public/projects.html so the AI-generated report and the
    // dashboard never disagree on the same underlying value; the visible label
    // is localized via ragLabel() (Fase 1 i18n).
    const overallColor: RagColor = riskScore === 'HIGH' || riskScore === 'CRITICAL' ? 'red'
      : riskScore === 'MEDIUM' ? 'yellow'
      : 'green';
    const scheduleColor: RagColor = pctComplete < 60 ? 'red'
      : pctComplete < 85 ? 'yellow'
      : 'green';
    const budgetColor: RagColor = budgetStatus === 'ON_TRACK' ? 'green'
      : budgetStatus === 'AT_RISK' ? 'yellow'
      : 'red';

    return {
      lang, projectName: input.projectName, pctComplete, daysRemaining, budgetSpent, budgetTotal,
      burnRate, delayProb, riskScore, budgetStatus, costOfDelay, worstCase, topRisks, mitigations,
      ragOverall: ragLabel(overallColor, lang),
      ragSchedule: ragLabel(scheduleColor, lang),
      ragBudget: ragLabel(budgetColor, lang),
      ragRisk: ragLabel(overallColor, lang),
    };
  }

  private buildSeniorPrompt(input: AgentInput): string {
    const c = this.buildContext(input);
    return `${languageDirective(c.lang)}

Eres un PMO senior experto en comunicación ejecutiva. Genera un Executive Status Report para el stakeholder de este proyecto.

DATOS DEL PROYECTO:
- Nombre: ${c.projectName}
- Avance: ${c.pctComplete}% completado | ${c.daysRemaining} días restantes
- Presupuesto gastado: $${Number(c.budgetSpent).toLocaleString()} de $${Number(c.budgetTotal).toLocaleString()} total
- Burn rate: ${c.burnRate}
- Probabilidad de delay: ${c.delayProb}
- Riesgo general: ${c.riskScore}
- Estado de presupuesto: ${c.budgetStatus}
- Costo del delay (si ocurre): ${c.costOfDelay}
- Costo peor caso: ${c.worstCase}

TOP RIESGOS:
${c.topRisks}

MITIGACIONES ACTIVAS:
${c.mitigations}

RAG STATUS (pre-calculado para que lo uses):
- Estado general: ${c.ragOverall}
- Tiempo / Schedule: ${c.ragSchedule}
- Presupuesto: ${c.ragBudget}
- Riesgos: ${c.ragRisk}

INSTRUCCIÓN: Genera el reporte ejecutivo (senior_report), siguiendo EXACTAMENTE esta estructura:

---
## 📊 Estado Ejecutivo del Proyecto — ${c.projectName}

**Estado General:** ${c.ragOverall}

### 1. Resumen Ejecutivo
**Hitos clave del período:** [2-3 logros concretos y tangibles que el equipo entregó, basados en el % de avance]
**Próximos pasos críticos:** [Lo más importante que se liberará en las próximas 2 semanas]

### 2. Métricas de Salud

| Indicador | Estado | Nota |
|-----------|--------|------|
| Alcance (Scope) | [RAG emoji] | [1 línea honesta] |
| Tiempo (Schedule) | ${c.ragSchedule} | [1 línea concreta con días/% de desviación si aplica] |
| Presupuesto | ${c.ragBudget} | [burn rate + estado real] |
| Riesgos | ${c.ragRisk} | [el riesgo principal en 1 línea] |

### 3. ¿Dónde están los problemas?
**Bloqueos activos:** [Qué está frenando el proyecto HOY — sé específico y honesto]
**Riesgos en las próximas 2 semanas:** [Qué podría salir mal y por qué]

### 4. ¿Qué necesitas de mí?
**Decisiones pendientes:** [Aprobaciones, recursos o escalaciones que requieren al stakeholder]
**Plan de mitigación:** [Si hay algo en Amarillo o Rojo, explica el plan concreto para regresarlo a Verde]

> 💬 Nota del PM: [Una línea honesta y humana sobre el estado real del proyecto. Sin decorar la realidad.]
---

RESPONDE ÚNICAMENTE con el reporte ejecutivo completo en el formato de arriba (texto plano, sin bloques de código, sin explicaciones adicionales, sin repetir este prompt).`;
  }

  private buildTechnicalPrompt(input: AgentInput): string {
    const c = this.buildContext(input);
    return `${languageDirective(c.lang)}

Eres un PMO senior experto en comunicación técnica. Genera un Technical Health & Delivery Flow Report para el líder técnico / líder de desarrollo de este proyecto.

DATOS DEL PROYECTO:
- Nombre: ${c.projectName}
- Avance: ${c.pctComplete}% completado | ${c.daysRemaining} días restantes
- Probabilidad de delay: ${c.delayProb}
- Riesgo general: ${c.riskScore}
- Estado de presupuesto: ${c.budgetStatus}
- Burn rate: ${c.burnRate}

TOP RIESGOS:
${c.topRisks}

MITIGACIONES ACTIVAS:
${c.mitigations}

INSTRUCCIÓN: Genera el reporte técnico (technical_report) para el líder de desarrollo / líder técnico. Habla de colega a colega: sin diplomacia corporativa, directo al motor del proyecto. Sigue EXACTAMENTE esta estructura:

---
## 🛠️ Salud Técnica y Flujo de Entrega — ${c.projectName}

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

RESPONDE ÚNICAMENTE con el reporte técnico completo en el formato de arriba (texto plano, sin bloques de código, sin explicaciones adicionales, sin repetir este prompt).`;
  }

  private fallbackSeniorReport(): string {
    const risk = this.riskOutput?.analysis?.analysis || {};
    const econ = this.economicOutput?.analysis?.analysis || {};
    return `## 📊 Estado Ejecutivo — Proyecto

**Estado General:** 🟡 Amarillo

### 1. Resumen Ejecutivo
Análisis en progreso. Risk: ${risk.overallRiskScore || 'N/A'} | Budget: ${econ.budget_status || 'N/A'}

### 2. Métricas de Salud
| Indicador | Estado | Nota |
|-----------|--------|------|
| Presupuesto | 🟡 | ${econ.budget_status || 'Revisar'} |
| Riesgos | 🟡 | ${risk.overallRiskScore || 'Revisar'} |

### 4. ¿Qué necesitas de mí?
Revisar análisis completo de riesgos y económico para detalles adicionales.`;
  }

  private fallbackTechnicalReport(): string {
    return 'Reporte técnico no disponible. Revisar análisis de riesgo y económico.';
  }

  private extractText(response: any, kind: 'senior' | 'technical'): string {
    const block = response?.content?.[0];
    const text = block && block.type === 'text' ? block.text.trim() : '';
    if (text) return text;
    agentLogger.warn({ agent: this.name, kind }, 'Respuesta vacía o sin texto de la API — usando fallback');
    return kind === 'senior' ? this.fallbackSeniorReport() : this.fallbackTechnicalReport();
  }

  // Not used — analyze() is overridden below to make two independent API
  // calls (senior + technical), each with its own full token budget, instead
  // of one shared call. Kept only to satisfy BaseAgent's abstract contract.
  buildPrompt(input: AgentInput): string {
    return this.buildSeniorPrompt(input);
  }

  parseResponse(response: string): any {
    return { senior_report: response, technical_report: '' };
  }

  async analyze(input: AgentInput): Promise<AgentOutput> {
    try {
      if (!this.validateInput(input)) {
        throw new Error(`Input inválido para ${this.name}`);
      }

      agentLogger.info({ agent: this.name, projectId: input.projectId }, 'Iniciando análisis (2 llamadas: ejecutivo + técnico)');
      const startTime = Date.now();

      const [seniorResponse, technicalResponse] = await Promise.all([
        anthropicClient.messages.create({
          model: aiConfig.model,
          max_tokens: this.maxTokens,
          temperature: aiConfig.temperature,
          messages: [{ role: 'user', content: this.buildSeniorPrompt(input) }],
        }),
        anthropicClient.messages.create({
          model: aiConfig.model,
          max_tokens: this.maxTokens,
          temperature: aiConfig.temperature,
          messages: [{ role: 'user', content: this.buildTechnicalPrompt(input) }],
        }),
      ]);

      const senior_report = this.extractText(seniorResponse, 'senior');
      const technical_report = this.extractText(technicalResponse, 'technical');

      const executionTimeMs = Date.now() - startTime;
      const tokensUsed =
        seniorResponse.usage.output_tokens + seniorResponse.usage.input_tokens +
        technicalResponse.usage.output_tokens + technicalResponse.usage.input_tokens;

      const output: AgentOutput = {
        agentName: this.name,
        timestamp: new Date().toISOString(),
        projectId: input.projectId,
        analysis: { senior_report, technical_report },
        tokensUsed,
        executionTimeMs,
      };

      agentLogger.info({ agent: this.name, ms: executionTimeMs, tokens: tokensUsed }, 'Análisis completado');
      return output;
    } catch (error: any) {
      agentLogger.error({ agent: this.name, err: error.message }, 'Error en análisis');
      throw error;
    }
  }
}

export const reportingAgent = new ReportingAgent();
