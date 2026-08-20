import express, { Request, Response } from 'express';
import { errorMessage } from '../core/errors';
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

const PORTFOLIO_PROMPT = `Eres LARA Assistant, Chief Portfolio Advisor con 20 años de experiencia en gestión de carteras empresariales. Tu misión es ayudar a C-Level y PMO a tomar decisiones estratégicas sobre asignación de recursos, priorización de riesgos e impacto financiero.

## Tu personalidad
- Ejecutivo: hablas el lenguaje de ROI, revenue at stake, valor de negocio
- Analítico: ves patrones y concentración de riesgos
- Accionable: recomiendas qué HACER ahora, no solo qué está mal
- Directo: no endulzas malas noticias, pero siempre ofreces alternativas

## Aspectos que dominas
- **Portfolio Health**: análisis consolidado de múltiples proyectos
- **Risk Concentration**: detectar si todos los huevos están en una canasta
- **Resource Contention**: personas sobrecargadas, cuellos de botella
- **Critical Path**: qué proyecto bloquea a otros
- **Budget Variance**: dónde se está desviando presupuesto
- **ROI & Business Impact**: qué proyectos generan más valor
- **Strategic Decisions**: cancelar, escalar, o replantear un proyecto

## Cómo responder
1. Abre con el número: "De tus 5 proyectos, 2 están en riesgo crítico"
2. Contexto ejecutivo: "Esto representa $X revenue at stake"
3. Recomendación: "Prioridad 1: Redeploy recursos de ProjectX a ProjectY"
4. Impacto: "Esto mejora tu CPI global de 0.78 a 0.82"
5. Máximo 300 palabras, sé directo

## Idioma
Responde siempre en español, a menos que el usuario escriba en otro idioma.`;

const TEAM_HEALTH_PROMPT = `Eres LARA Assistant, especialista en Salud y Bienestar de Equipos con 15 años de experiencia en gestión de talento. Tu misión es ayudar a PMs y líderes a construir equipos saludables, evitar burnout y mejorar la moral.

## Tu personalidad
- Empatía: entiendes que la gente es el corazón del proyecto
- Practicidad: das soluciones concretas y rápidas
- Proactividad: señalas riesgos antes de que se conviertan en crisis
- Nunca juzgas, solo ayudas

## Aspectos que dominas
- **Burnout Detection**: síntomas, factores de riesgo, prevención
- **Team Dynamics**: conflictos, comunicación, cohesión
- **Workload Management**: distribución de carga, utilización óptima
- **Morale & Engagement**: motivación, reconocimiento, carrera profesional
- **Turnover & Retention**: por qué se van los buenos, cómo retener talento
- **Well-being Metrics**: estrés, satisfacción, balance vida-trabajo

## Cómo responder
1. Si tienes datos del equipo disponibles, úsalos para contextualizar
2. Sé honesto: si detectas un problema, dilo claramente pero ofrece soluciones
3. Prioriza acciones: "primero X, luego Y"
4. Dale herramientas al PM: frases, planes, checkpoints
5. Máximo 300 palabras, sé conciso

## Menú de Acción Inmediata
Cuando detectes un problema de equipo accionable (burnout, conflicto, retención, moral baja):

<actions>
[{"id":"draft_team","label":"✉️ Redactar mensaje para el equipo","intent":"draft:team"},{"id":"draft_clevel","label":"📊 Reportar a Ejecutivos","intent":"draft:clevel"}]
</actions>

## Idioma
Responde siempre en español, a menos que el usuario escriba en otro idioma.`;

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = ChatMessageSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    const { message, history = [], projectContext } = body.data;
    const lang = body.data.lang ?? normalizeLang(req.headers['accept-language']);

    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    // Detect context type: portfolio, team, or project
    const isPortfolioContext = projectContext && projectContext.type === 'portfolio';
    const isTeamContext = projectContext && (projectContext.teamHealth || projectContext.teamMembers);
    const systemPrompt = isPortfolioContext
      ? PORTFOLIO_PROMPT
      : isTeamContext
      ? TEAM_HEALTH_PROMPT
      : SYSTEM_PROMPT;

    // Inject project context as first user message if available (ALL messages, not just first 2)
    if (projectContext && history.length === 0) {
      const ctx = isPortfolioContext
        ? buildPortfolioContextMessage(projectContext)
        : isTeamContext
        ? buildTeamContextMessage(projectContext)
        : buildContextMessage(projectContext);
      if (ctx) {
        messages.push({ role: 'user', content: ctx });
      }
    } else if (projectContext && history.length > 0) {
      // Keep injecting context every conversation to ensure LLM always has access to real data
      const ctx = isPortfolioContext
        ? buildPortfolioContextMessage(projectContext)
        : isTeamContext
        ? buildTeamContextMessage(projectContext)
        : buildContextMessage(projectContext);
      if (ctx) {
        // Insert context as system-level data (via user message) before current turn
        const contextType = isPortfolioContext ? 'PORTFOLIO' : isTeamContext ? 'TEAM' : 'PROJECT';
        messages.push({ role: 'user', content: `[CURRENT ${contextType} DATA]\n${ctx}` });
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
      thinking: aiConfig.thinking,
      system: `${systemPrompt}\n\n${languageDirective(lang)}`,
      messages,
    });

    const chatTextBlock = response.content.find((b) => b.type === 'text');
    const raw = chatTextBlock && chatTextBlock.type === 'text' ? chatTextBlock.text : '';
    const { reply, actions } = parseActionsFromReply(raw);

    res.json({ success: true, reply, actions });
  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'chat POST error');
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
      thinking: aiConfig.thinking,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const draftTextBlock = response.content.find((b) => b.type === 'text');
    const draft = draftTextBlock && draftTextBlock.type === 'text' ? draftTextBlock.text.trim() : '';
    res.json({ success: true, draft, audience });
  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'draft POST error');
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
      thinking: aiConfig.thinking,
      system: `${PARSE_DELTA_PROMPT}\n\n${languageDirective(lang)}`,
      messages: [{ role: 'user', content: question }],
    });

    let delta: SimulationDelta;
    try {
      const parseTextBlock = parseResponse.content.find((b) => b.type === 'text');
      const raw = parseTextBlock && parseTextBlock.type === 'text' ? parseTextBlock.text.trim() : '{}';
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
      thinking: aiConfig.thinking,
      system: `${NARRATE_SIMULATION_PROMPT}\n\n${languageDirective(lang)}`,
      messages: [{ role: 'user', content: narratePrompt }],
    });

    const narrateTextBlock = narrateResponse.content.find((b) => b.type === 'text');
    const narrative = narrateTextBlock && narrateTextBlock.type === 'text' ? narrateTextBlock.text.trim() : '';

    res.json({ success: true, result, narrative, scenario: delta.label });
  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'simulate POST error');
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
       LEFT JOIN ai_analyses aa ON aa.projectid = pd.projectid AND aa.user_id = pd.user_id
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
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

// GET /api/chat/context/portfolio — fetch portfolio-wide metrics to seed chat
router.get('/context/portfolio', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;

    // Fetch all projects for this user with their latest analysis
    const result = await pool.query(
      `SELECT pd.id, pd.projectname, aa.output
       FROM project_data pd
       LEFT JOIN ai_analyses aa ON aa.projectid = pd.projectid AND aa.user_id = pd.user_id
       WHERE pd.user_id = $1
       ORDER BY aa.generatedat DESC`,
      [userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.json({ success: true, context: null });
    }

    // Build portfolio-wide metrics
    const projects = result.rows.map(row => ({
      id: row.id,
      name: row.projectname,
      metrics: row.output?.metrics || {},
      risk: row.output?.risk || {},
      economic: row.output?.economic || {},
      health: row.output?.health || {},
      earlyWarnings: row.output?.earlyWarnings || null,
    }));

    // Aggregate portfolio data
    const projectCount = projects.length;
    const criticalCount = projects.filter(p => p.risk?.analysis?.overallRiskScore === 'CRITICAL').length;
    const atRiskCount = projects.filter(p =>
      parseFloat(p.metrics?.spi) < 0.9 || parseFloat(p.metrics?.cpi) < 0.9
    ).length;

    // Portfolio CPI (weighted average)
    let totalAC = 0, totalPV = 0;
    projects.forEach(p => {
      totalAC += parseFloat(p.metrics?.ac) || 0;
      totalPV += parseFloat(p.metrics?.pv) || 0;
    });
    const portfolioCPI = totalPV > 0 ? (totalAC / totalPV).toFixed(2) : 'N/A';

    // Critical resources (people in burnout across projects)
    const allTeamMembers = new Map();
    projects.forEach(p => {
      const members = p.health?.members || [];
      members.forEach((m: any) => {
        if (!allTeamMembers.has(m.id)) {
          allTeamMembers.set(m.id, { ...m, projects: [p.name] });
        } else {
          allTeamMembers.get(m.id).projects.push(p.name);
        }
      });
    });

    const overallocatedResources = Array.from(allTeamMembers.values())
      .filter((m: any) => m.projects.length > 1 && (m.burnoutRisk === 'high' || m.wellbeingScore < 0.5))
      .slice(0, 5);

    res.json({
      success: true,
      context: {
        type: 'portfolio',
        projectCount,
        criticalCount,
        atRiskCount,
        portfolioCPI,
        totalBudget: totalPV,
        totalSpent: totalAC,
        projects: projects.map(p => ({
          name: p.name,
          cpi: parseFloat(p.metrics?.cpi) || 0,
          spi: parseFloat(p.metrics?.spi) || 0,
          riskScore: p.risk?.analysis?.overallRiskScore || 'LOW',
          status: parseFloat(p.metrics?.spi) < 0.9 ? 'delayed' :
                  parseFloat(p.metrics?.cpi) < 0.9 ? 'over_budget' : 'on_track',
        })),
        overallocatedResources,
        topRisks: projects
          .flatMap(p => (p.risk?.analysis?.topRisks || []).map((r: any) => ({ ...r, project: p.name })))
          .slice(0, 5),
      },
    });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

// GET /api/chat/context/team/:projectId — fetch team health data to seed chat
router.get('/context/team/:projectId', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: 'projectId inválido' });
    const { projectId } = params.data;
    const userId = (req as AuthRequest).user!.id;

    const result = await pool.query(
      `SELECT pd.projectname, aa.output
       FROM project_data pd
       LEFT JOIN ai_analyses aa ON aa.projectid = pd.projectid AND aa.user_id = pd.user_id
       WHERE pd.id = $1 AND pd.user_id = $2
       ORDER BY aa.generatedat DESC
       LIMIT 1`,
      [projectId, userId]
    );

    if (!result.rows[0]) {
      return res.json({ success: true, context: null });
    }

    const { projectname, output } = result.rows[0];
    const teamHealth = output?.teamHealth || {};
    const teamMetrics = output?.teamMetrics || {};

    res.json({
      success: true,
      context: {
        projectName: projectname,
        teamHealth: {
          overallScore: teamHealth.overallScore || 0,
          morale: teamHealth.morale || 'unknown',
          burnoutRisk: teamHealth.burnoutRisk || 'low',
          memberCount: teamHealth.memberCount || 0,
        },
        teamMembers: teamHealth.members || [],
        teamMetrics: {
          velocity: teamMetrics.velocity || 0,
          absenteeism: teamMetrics.absenteeism || 0,
          turnoverRate: teamMetrics.turnoverRate || 0,
          averageUtilization: teamMetrics.averageUtilization || 0,
        },
        earlyWarnings: output?.earlyWarnings || null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

interface ChatAction {
  id: string;
  label: string;
  intent: string;
}

function buildPortfolioContextMessage(ctx: any | null | undefined): string {
  if (!ctx) return '';
  const parts: string[] = [`## Resumen de Portafolio`];

  if (ctx.projectCount) {
    parts.push(`\n### Estado Global
- Total de proyectos: ${ctx.projectCount}
- En riesgo crítico: ${ctx.criticalCount || 0}
- Retrasados o sobrepresupuestados: ${ctx.atRiskCount || 0}`);
  }

  if (ctx.totalBudget && ctx.totalSpent) {
    const variance = ((ctx.totalSpent / ctx.totalBudget - 1) * 100).toFixed(1);
    parts.push(`\n### Presupuesto Consolidado
- Presupuestado: $${(ctx.totalBudget / 1000).toFixed(0)}K
- Gastado: $${(ctx.totalSpent / 1000).toFixed(0)}K
- Desviación: ${variance}% ${parseFloat(variance) > 0 ? '(SOBRE)' : '(BAJO)'}
- CPI Portfolio: ${ctx.portfolioCPI}`);
  }

  if (ctx.projects && ctx.projects.length > 0) {
    parts.push(`\n### Proyectos por Estado`);
    const onTrack = ctx.projects.filter((p: any) => p.status === 'on_track').length;
    const delayed = ctx.projects.filter((p: any) => p.status === 'delayed').length;
    const overBudget = ctx.projects.filter((p: any) => p.status === 'over_budget').length;

    parts.push(`- ✅ Al día: ${onTrack}`);
    parts.push(`- ⚠️ Retrasados: ${delayed}`);
    parts.push(`- 🔴 Sobre presupuesto: ${overBudget}`);

    const criticalProjects = ctx.projects.filter((p: any) => p.riskScore === 'CRITICAL');
    if (criticalProjects.length > 0) {
      parts.push(`\n### Proyectos en Riesgo Crítico`);
      criticalProjects.slice(0, 3).forEach((p: any) => {
        parts.push(`- **${p.name}**: CPI ${p.cpi.toFixed(2)}, SPI ${p.spi.toFixed(2)}`);
      });
    }
  }

  if (ctx.overallocatedResources && ctx.overallocatedResources.length > 0) {
    parts.push(`\n### Recursos Críticos (Personas Sobrecargadas)`);
    ctx.overallocatedResources.forEach((r: any) => {
      parts.push(`- **${r.name}**: En ${r.projects.length} proyectos (${r.projects.join(', ')})`);
    });
  }

  if (ctx.topRisks && ctx.topRisks.length > 0) {
    parts.push(`\n### Top Riesgos Consolidados`);
    ctx.topRisks.slice(0, 3).forEach((risk: any) => {
      parts.push(`- ${risk.title || risk.description} (${risk.project})`);
    });
  }

  parts.push('\nPor favor, úsalo como contexto para responder mis preguntas sobre decisiones estratégicas del portafolio.');
  return parts.join('\n');
}

function buildTeamContextMessage(ctx: any | null | undefined): string {
  if (!ctx) return '';
  const parts: string[] = [`## Contexto del Equipo: ${ctx.projectName || 'Sin nombre'}`];

  if (ctx.teamHealth) {
    const h = ctx.teamHealth;
    parts.push(`\n### Salud General del Equipo
- Score General: ${h.overallScore || 'N/A'}%
- Morale: ${h.morale || 'desconocida'}
- Riesgo de Burnout: ${h.burnoutRisk || 'bajo'}
- Miembros: ${h.memberCount || 0}`);
  }

  if (ctx.teamMembers && ctx.teamMembers.length > 0) {
    const members = ctx.teamMembers.slice(0, 5); // Limit to 5 members to stay within token budget
    parts.push(`\n### Miembros Clave (${ctx.teamMembers.length} total)`);
    members.forEach((m: any) => {
      const burnout = m.burnoutRisk ? `(${m.burnoutRisk} burnout)` : '';
      const carga = m.workload ? `${m.workload.activeCount} tareas activas` : '';
      parts.push(`- ${m.name || 'Desconocido'} ${m.role ? `(${m.role})` : ''} ${burnout} ${carga}`);
    });
    if (ctx.teamMembers.length > 5) {
      parts.push(`- ... y ${ctx.teamMembers.length - 5} miembros más`);
    }
  }

  if (ctx.teamMetrics) {
    const m = ctx.teamMetrics;
    parts.push(`\n### Métricas del Equipo
- Velocity Promedio: ${m.velocity || 'N/A'} puntos/sprint
- Utilización: ${((m.averageUtilization || 0) * 100).toFixed(1)}%
- Absentismo: ${((m.absenteeism || 0) * 100).toFixed(1)}%
- Turnover Anual: ${((m.turnoverRate || 0) * 100).toFixed(1)}%`);
  }

  if (ctx.earlyWarnings?.hasAlerts) {
    const ew = ctx.earlyWarnings;
    const criticals = ew.warnings.filter((w: any) => w.severity === 'CRITICAL');
    parts.push(`\n### ⚠️ Alertas Tempranas (${ew.warnings.length} total)`);
    if (criticals.length > 0) {
      parts.push('**CRÍTICAS:**');
      criticals.slice(0, 3).forEach((w: any) => {
        parts.push(`- ${w.title}: ${w.description}`);
      });
    }
  }

  parts.push('\nPor favor, úsalo como contexto para responder mis preguntas sobre la salud y bienestar de mi equipo.');
  return parts.join('\n');
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

// Shape of the (frontend-supplied, loosely-typed) project context threaded into
// the chat prompt. Every field is optional and every access below is defensive.
interface RiskItem { title?: string; description?: string; probability?: number; impact?: string; }
interface WarningItem { severity?: string; title?: string; description?: string; action?: string; }
interface ProjectChatContext {
  projectName?: string;
  metrics?: { framework?: string; percentComplete?: number | string; pv?: number; ev?: number; ac?: number; cpi?: number | string; spi?: number | string; roi?: number | string };
  risk?: { overallRiskScore?: number | string; delayProbability?: number; topRisks?: RiskItem[] };
  economic?: { budget_status?: string; worst_case_total_cost?: number; cost_of_delay?: number; daily_burn_rate?: number };
  earlyWarnings?: { hasAlerts?: boolean; warnings: WarningItem[]; summary?: string };
  frameworkMetrics?: { framework?: string; insights?: string[] };
}

function buildContextMessage(ctx: ProjectChatContext | null | undefined): string {
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
- Top Riesgos: ${(r.topRisks || []).map((t: RiskItem) => t.description || t.title).join(', ') || 'Ninguno'}`);
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
    const criticals = ew.warnings.filter((w: WarningItem) => w.severity === 'CRITICAL');
    const highs = ew.warnings.filter((w: WarningItem) => w.severity === 'HIGH');
    parts.push(`\n### ⚠️ Alertas Tempranas Activas (${ew.warnings.length} total)
${ew.summary}
${criticals.length > 0 ? `**CRÍTICAS:**\n${criticals.map((w: WarningItem) => `- ${w.title}: ${w.description} → Acción: ${w.action}`).join('\n')}` : ''}
${highs.length > 0 ? `**ALTAS:**\n${highs.map((w: WarningItem) => `- ${w.title}: ${w.description}`).join('\n')}` : ''}`);
  }

  if ((ctx.frameworkMetrics?.insights?.length ?? 0) > 0) {
    parts.push(`\n### Insights del Framework ${ctx.frameworkMetrics?.framework?.toUpperCase()}
${(ctx.frameworkMetrics?.insights ?? []).map((i: string) => `- ${i}`).join('\n')}`);
  }

  parts.push('\nPor favor, úsalo como contexto para responder mis preguntas sobre este proyecto. Si hay alertas críticas, mencionarlas proactivamente al inicio de tu respuesta.');
  return parts.join('\n');
}

export default router;
