import { BaseAgent } from './baseAgent';
import { AgentInput } from '../types/agents';
import { agentLogger } from '../core/logger';
import { normalizeLang, languageDirective } from '../config/language';

/**
 * WellbeingAgent — semantic analysis of a single 1-on-1 feedback note
 * (Hito 5.2). Not part of the risk/economic/reporting pipeline; invoked
 * on-demand each time a PM logs a note for a team member.
 */
export class WellbeingAgent extends BaseAgent {
  name = '💬 Wellbeing Agent';
  version = '1.0.0';
  // Short JSON response (score + sentiment + 1-2 sentence reasoning) — 300
  // tokens is generous, matches the actual output size in practice.
  protected maxTokens = 300;

  validateInput(input: AgentInput): boolean {
    return !!(input.projectId && typeof input.noteText === 'string' && input.noteText.trim().length > 0);
  }

  buildPrompt(input: AgentInput): string {
    const lang = normalizeLang(input.lang);
    return `${languageDirective(lang)}

Eres un experto en análisis de clima organizacional. Analiza la siguiente nota de feedback de una reunión 1-on-1 entre un Project Manager y un miembro de su equipo.

NOTA: "${input.noteText}"

INSTRUCCIÓN CRÍTICA:
- Retorna SIEMPRE un JSON válido (sin markdown)
- wellbeingScore es un número entre 0.0 (muy negativo/en riesgo) y 1.0 (muy positivo/motivado)
- reasoning debe ser 1-2 frases breves explicando el score

JSON REQUERIDO (EXACTAMENTE ESTE FORMATO):
{
  "wellbeingScore": 0.0,
  "sentiment": "positive|neutral|negative|mixed",
  "reasoning": "Explicación breve"
}`;
  }

  parseResponse(response: string): any {
    try {
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const startIdx = cleanResponse.indexOf('{');
      const endIdx = cleanResponse.lastIndexOf('}');

      if (startIdx === -1 || endIdx === -1) throw new Error('No JSON');

      const parsed = JSON.parse(cleanResponse.substring(startIdx, endIdx + 1));

      let score = Number(parsed.wellbeingScore);
      if (!isFinite(score)) score = 0.5;
      score = Math.max(0, Math.min(1, score));

      const validSentiments = ['positive', 'neutral', 'negative', 'mixed'];
      const sentiment = validSentiments.includes(parsed.sentiment) ? parsed.sentiment : 'neutral';

      return {
        wellbeingScore: score,
        sentiment,
        reasoning: parsed.reasoning || 'Sin detalle adicional',
      };
    } catch (error: any) {
      agentLogger.error({ err: error.message }, 'Error parsing wellbeing response');
      return {
        wellbeingScore: 0.5,
        sentiment: 'neutral',
        reasoning: 'No se pudo analizar el feedback',
      };
    }
  }
}

export const wellbeingAgent = new WellbeingAgent();
