import express, { Request, Response } from 'express';
import { anthropicClient, aiConfig } from '../config/anthropic';
import { pool } from '../db';
import { ChatMessageSchema, ProjectIdParamSchema } from '../config/validation';
import { routeLogger } from '../core/logger';

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

## Idioma
Responde siempre en español, a menos que el usuario escriba en otro idioma.`;

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = ChatMessageSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    const { message, history = [], projectContext } = body.data;

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
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    res.json({ success: true, reply });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'chat POST error');
    res.status(500).json({ error: 'Error procesando tu mensaje' });
  }
});

// GET /api/chat/context/:projectId — fetch project metrics to seed the chat
router.get('/context/:projectId', async (req: Request, res: Response) => {
  try {
    const params = ProjectIdParamSchema.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: 'projectId inválido' });
    const { projectId } = params.data;
    const result = await pool.query(
      `SELECT pd.projectname, aa.output
       FROM project_data pd
       LEFT JOIN ai_analyses aa ON aa.projectid = pd.projectid
       WHERE pd.id = $1
       ORDER BY aa.generatedat DESC
       LIMIT 1`,
      [projectId]
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
