import express, { Request, Response } from 'express';
import { anthropicClient, aiConfig } from '../config/anthropic';
import { pool } from '../db';
import { ChatMessageSchema, ProjectIdParamSchema, DraftMessageSchema, SimulateSchema } from '../config/validation';
import { simulateScenario, SimulationDelta } from '../services/scenarioSimulator';
import { normalizeLang, languageDirective } from '../config/language';
import { routeLogger } from '../core/logger';
import { AuthRequest } from '../middleware/requireAuth';

const router = express.Router();

const SYSTEM_PROMPT = `Eres LARA Assistant, un experto en Project Management con más de 20 años de experiencia. Tu misión es ayudar a PMs —especialmente novatos— a entender las métricas de sus proyectos y tomar mejores decisiones.

## Tu personalidad
- Explicas conceptos complejos de forma simple, con analogías cotidianas
- Eres paciente, alentador y nunca condescendiente
- Usas ejemplos concretos y accionables
- Cuando detectas riesgos en las métricas, los señalas con claridad pero sin alarmar innecesariamente

## Métricas que dominas
- **EVM (Earned Value Management)**: PV, EV, AC, CPI, SPI, CV, SV
- **CPI (Cost Performance Index)**: CPI > 1 = bajo presupuesto, CPI < 1 = sobre presupuesto
- **SPI (Schedule Performance Index)**: SPI > 1 = adelantado, SPI < 1 = retrasado
- **ROI**: Retorno sobre la inversión
- **Análisis de riesgos**: Probabilidad, impacto, mitigación
- **Metodologías**: Scrum, Kanban, Waterfall, SAFe

## Cómo responder
1. Si el usuario tiene métricas del proyecto disponibles, úsalas para contextualizar tu respuesta
2. Explica siempre el "por qué" detrás de cada métrica
3. Da recomendaciones concretas y accionables
4. Si algo está mal en el proyecto, dilo con claridad pero ofrece soluciones
5. Usa formato markdown para mejor legibilidad (negritas, listas, etc.)
6. Respuestas concisas — máximo 300 palabras salvo que el usuario pida más detalle

## Menú de Acción Inmediata
Cuando tu respuesta explica un problema accionable (alerta, riesgo, desviación de presupuesto, tareas atrasadas), DEBES terminar con un bloque de acciones en este formato EXACTO:

<actions>
[{"id":"draft_team","label":"✉️ Redactar mensaje para el equipo","intent":"draft:team"},{"id":"draft_clevel","label":"📊 Preparar reporte ejecutivo","intent":"draft:clevel"},{"id":"simulate","label":"🔮 Simular escenarios","intent":"simulate:¿Qué pasa si nos retrasamos dos semanas más en este problema?"}]
</actions>

Adapta las acciones al problema específico. Si el problema es de presupuesto, añade una acción de revisión presupuestaria. Si es de cronograma, añade una de negociación de fechas. Siempre incluye al menos "Redactar mensaje para el equipo" y "Preparar reporte ejecutivo" cuando haya un problema.

IMPORTANTE: Cuando el usuario pida redactar un mensaje, usa los intents exactos:
- Para mensaje al equipo técnico: intent debe ser "draft:team"
- Para reporte ejecutivo/junta directiva: intent debe ser "draft:clevel"

NO incluyas el bloque <actions> cuando el usuario solo hace preguntas conceptuales, cuando ya está respondiendo a una acción, o cuando la conversación es informativa sin problema accionable.

## Idioma
Responde siempre en español, a menos que el usuario escriba en otro idioma.`;

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = ChatMessageSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    const { message, history = [], projectContext } = body.data;
    const lang = body.data.lang ?? normalizeLang(req.headers['accept-language']);

    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    // Inject project context as first user message if available
    if (projectContext && history.length === 0) {
      const ctx = buildContextMessage(projectContext);
      if (ctx) {
        messages.push({ role: 'user', content: ctx });
        const ew = projectContext.earlyWarnings;
        const alertIntro = ew?.criticalCount > 0
          ? `⚠️ **Atención:** Detecto ${ew.criticalCount} alerta(s) CRÍTICA(S) en tu proyecto. Te las explico en detalle cuando quieras. ¿Por dónde empezamos?`
          : ew?.hasAlerts
          ? `Hay ${ew.warnings?.length || 0} alerta(s) de atención en tu proyecto. Puedo explicarte cada una. ¿Qué necesitas?`
          : '¡Perfecto! Ya tengo el contexto completo de tu proyecto. Puedo ver las métricas, riesgos y análisis económico. ¿En qué te puedo ayudar?';
        messages.push({ role: 'assistant', content: alertIntro });
      }
    }

    // Add conversation history (last 10 turns to stay within token limits)
    const recentHistory = history.slice(-10);
    for (const turn of recentHistory) {
      if (turn.role === 'user' || turn.role === 'assistant') {
        messages.push({ role: turn.role, content: turn.content });
      }
    }

    messages.push({ role: 'user', content: message });

    const response = await anthropicClient.messages.create({
      model: aiConfig.model,
      max_tokens: 1200,
      system: `${SYSTEM_PROMPT}\n\n${languageDirective(lang)}`,
      messages,
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const { reply, actions } = parseActionsFromReply(raw);

    res.json({ success: true, reply, actions });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'chat POST error');
    res.status(500).json({ error: 'Error procesando tu mensaje' });
  }
});

// POST /api/chat/draft — generate audience-specific message drafts (Escudo feature)
const DRAFT_PROMPTS = {
  team: `Eres un experto en comunicación de equipos de proyectos.
Redacta un mensaje profesional para el equipo técnico (para pegar en Slack o Teams).

Reglas:
- Tono: empático, directo, orientado a desbloquear — nunca acusatorio
- Estructura: 1) qué está pasando (1 oración), 2) por qué importa (1 oración), 3) qué necesitas del equipo (bullet points concretos), 4) próximos pasos (fecha/hora de standup si aplica)
- Sin tecnicismos de EVM (no mencionar CPI, SPI, PV) — habla de tareas, fechas y bloqueos
- Máximo 150 palabras
- No uses emojis excesivos — máximo 1-2 para énfasis
- Termina con una llamada a la acción clara`,

  clevel: `Eres un experto en comunicación ejecutiva de proyectos.
Redacta un reporte ejecutivo para la junta directiva o C-Level (para un correo formal).

Reglas:
- Tono: formal, directo, orientado al impacto financiero y de negocio
- Estructura: 1) Resumen ejecutivo (1 párrafo, el problema y su impacto en $), 2) Estado actual (métricas clave: budget, timeline), 3) Riesgos (Revenue at Stake si aplica), 4) Plan de acción (3 bullets con responsable y fecha), 5) Decisión requerida (si la hay)
- Traduce todo a lenguaje de negocio: nada de jerga técnica (no Scrum, CPI, etc.)
- Usa cifras monetarias cuando estén disponibles
- Máximo 200 palabras
- Termina con: "¿Requieren alguna acción de su parte?" si se necesita aprobación`,
};

router.post('/draft', async (req: Request, res: Response) => {
  try {
    const body = DraftMessageSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    const { audience, alertContext, projectName } = body.data;
    const lang = body.data.lang ?? normalizeLang(req.headers['accept-language']);

    const systemPrompt = `${DRAFT_PROMPTS[audience]}\n\n${languageDirective(lang)}`;
    const userMessage = `Proyecto: ${projectName}\n\nSituación a comunicar:\n${alertContext}`;

    const response = await anthropicClient.messages.create({
      model: aiConfig.model,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const draft = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    res.json({ success: true, draft, audience });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'draft POST error');
    res.status(500).json({ error: 'Error generando el borrador' });
  }
});

// POST /api/chat/simulate — what-if scenario simulation with deterministic EVM math
const PARSE_DELTA_PROMPT = `You are an EVM scenario parser. The user describes a project scenario in natural language.
Extract a structured SimulationDelta and respond ONLY with valid JSON — no markdown, no explanation.

Scenario types:
- "schedule_delay": project slips or is delayed (needs "weeks")
- "schedule_acceleration": team speeds up or catches up (needs "weeks")
- "budget_increase": more budget approved (needs "percent")
- "scope_reduction": scope is cut or reduced (needs "percent")
- "team_boost": adding people or resources (needs "percent" improvement, typically 10–25)

Response format (pick ONE type):
{"type":"schedule_delay","weeks":2,"label":"Retraso de 2 semanas en el proyecto"}

If the question is ambiguous, default to schedule_delay with weeks=2.`;

const NARRATE_SIMULATION_PROMPT = `Eres LARA, experta en Project Management. Te presento los resultados matemáticos de una simulación de escenario para un proyecto.
Tu tarea es narrar el impacto en lenguaje claro para un PM. Sé directo, usa los números reales del resultado.
- Explica qué cambia y por qué importa (máximo 150 palabras)
- Menciona el Revenue at Stake si aumenta
- Da 1 recomendación concreta al final
- Usa formato markdown con negritas para los números clave
- Responde en español`;

router.post('/simulate', async (req: Request, res: Response) => {
  try {
    const body = SimulateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    const { question, metrics, projectName } = body.data;
    const lang = body.data.lang ?? normalizeLang(req.headers['accept-language']);

    // Step 1: Claude parses the natural-language question into a structured delta
    const parseResponse = await anthropicClient.messages.create({
      model: aiConfig.model,
      max_tokens: 120,
      system: `${PARSE_DELTA_PROMPT}\n\n${languageDirective(lang)}`,
      messages: [{ role: 'user', content: question }],
    });

    let delta: SimulationDelta;
    try {
      const raw = parseResponse.content[0].type === 'text' ? parseResponse.content[0].text.trim() : '{}';
      delta = JSON.parse(raw) as SimulationDelta;
    } catch {
      delta = { type: 'schedule_delay', weeks: 2, label: 'Retraso de 2 semanas' };
    }

    // Step 2: deterministic EVM recalculation — no LLM involved
    const result = simulateScenario(metrics || {}, delta);

    // Step 3: Claude narrates the result in plain language
    const narratePrompt = `Proyecto: ${projectName}
Escenario: ${delta.label}

ANTES:
- CPI: ${result.before.cpi} | SPI: ${result.before.spi}
- EAC: $${result.before.eac.toLocaleString()} | VAC: $${result.before.vac.toLocaleString()}
- Revenue at Stake: $${result.before.revenueAtStake.toLocaleString()}

DESPUÉS del escenario:
- CPI: ${result.after.cpi} | SPI: ${result.after.spi}
- EAC: $${result.after.eac.toLocaleString()} | VAC: $${result.after.vac.toLocaleString()}
- Revenue at Stake: $${result.after.revenueAtStake.toLocaleString()}

Cambio en EAC: ${result.deltaSummary.eacChange >= 0 ? '+' : ''}$${Math.round(result.deltaSummary.eacChange).toLocaleString()}
Cambio en Revenue at Stake: ${result.deltaSummary.revenueAtStakeChange >= 0 ? '+' : ''}$${Math.round(result.deltaSummary.revenueAtStakeChange).toLocaleString()}`;

    const narrateResponse = await anthropicClient.messages.create({
      model: aiConfig.model,
      max_tokens: 400,
      system: `${NARRATE_SIMULATION_PROMPT}\n\n${languageDirective(lang)}`,
      messages: [{ role: 'user', content: narratePrompt }],
    });

    const narrative = narrateResponse.content[0].type === 'text' ? narrateResponse.content[0].text.trim() : '';

    res.json({ success: true, result, narrative, scenario: delta.label });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'simulate POST error');
    res.status(500).json({ error: 'Error ejecutando la simulación' });
  }
});

// GET /api/chat/context/:projectId — fetch project metrics to seed the chat
router.get('/context/:projectId', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: 'projectId inválido' });
    const { projectId } = params.data;
    const userId = (req as AuthRequest).user!.id;
    const result = await pool.query(
      `SELECT pd.projectname, aa.output
       FROM project_data pd
       LEFT JOIN ai_analyses aa ON aa.projectid = pd.projectid
       WHERE pd.id = $1 AND pd.user_id = $2
       ORDER BY aa.generatedat DESC
       LIMIT 1`,
      [projectId, userId]
    );

    if (!result.rows[0]) {
      return res.json({ success: true, context: null });
    }

    const { projectname, output } = result.rows[0];
    res.json({
      success: true,
      context: {
        projectName: projectname,
        metrics: output?.metrics || null,
        risk: output?.risk?.analysis?.analysis || null,
        economic: output?.economic?.analysis?.analysis || null,
        earlyWarnings: output?.earlyWarnings || null,
        frameworkMetrics: output?.frameworkMetrics || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

interface ChatAction {
  id: string;
  label: string;
  intent: string;
}

function parseActionsFromReply(raw: string): { reply: string; actions: ChatAction[] } {
  const match = raw.match(/<actions>([\s\S]*?)<\/actions>/);
  if (!match) return { reply: raw.trim(), actions: [] };

  const reply = raw.replace(/<actions>[\s\S]*?<\/actions>/, '').trim();
  try {
    const actions: ChatAction[] = JSON.parse(match[1].trim());
    return { reply, actions };
  } catch {
    return { reply, actions: [] };
  }
}

function buildContextMessage(ctx: any): string {
  if (!ctx) return '';
  const parts: string[] = [`## Contexto del Proyecto: ${ctx.projectName || 'Sin nombre'}`];

  if (ctx.metrics) {
    const m = ctx.metrics;
    parts.push(`\n### Métricas EVM
- Framework: ${m.framework || 'N/A'}
- Progreso: ${m.percentComplete || 'N/A'}%
- PV (Valor Planeado): $${Number(m.pv || 0).toLocaleString()}
- EV (Valor Ganado): $${Number(m.ev || 0).toLocaleString()}
- AC (Costo Real): $${Number(m.ac || 0).toLocaleString()}
- CPI: ${m.cpi || 'N/A'}
- SPI: ${m.spi || 'N/A'}
- ROI: ${m.roi || 'N/A'}%`);
  }

  if (ctx.risk) {
    const r = ctx.risk;
    parts.push(`\n### Análisis de Riesgos
- Score General: ${r.overallRiskScore || 'N/A'}
- Probabilidad de Delay: ${((r.delayProbability || 0) * 100).toFixed(0)}%
- Top Riesgos: ${(r.topRisks || []).map((t: any) => t.description || t.title).join(', ') || 'Ninguno'}`);
  }

  if (ctx.economic) {
    const e = ctx.economic;
    parts.push(`\n### Análisis Económico
- Estado Presupuesto: ${e.budget_status || 'N/A'}
- Peor Caso Total: $${Number(e.worst_case_total_cost || 0).toLocaleString()}
- Costo del Delay: $${Number(e.cost_of_delay || 0).toLocaleString()}
- Burn Rate Diario: $${Number(e.daily_burn_rate || 0).toLocaleString()}`);
  }

  if (ctx.earlyWarnings?.hasAlerts) {
    const ew = ctx.earlyWarnings;
    const criticals = ew.warnings.filter((w: any) => w.severity === 'CRITICAL');
    const highs = ew.warnings.filter((w: any) => w.severity === 'HIGH');
    parts.push(`\n### ⚠️ Alertas Tempranas Activas (${ew.warnings.length} total)
${ew.summary}
${criticals.length > 0 ? `**CRÍTICAS:**\n${criticals.map((w: any) => `- ${w.title}: ${w.description} → Acción: ${w.action}`).join('\n')}` : ''}
${highs.length > 0 ? `**ALTAS:**\n${highs.map((w: any) => `- ${w.title}: ${w.description}`).join('\n')}` : ''}`);
  }

  if (ctx.frameworkMetrics?.insights?.length > 0) {
    parts.push(`\n### Insights del Framework ${ctx.frameworkMetrics.framework?.toUpperCase()}
${ctx.frameworkMetrics.insights.map((i: string) => `- ${i}`).join('\n')}`);
  }

  parts.push('\nPor favor, úsalo como contexto para responder mis preguntas sobre este proyecto. Si hay alertas críticas, mencionarlas proactivamente al inicio de tu respuesta.');
  return parts.join('\n');
}

export default router;
