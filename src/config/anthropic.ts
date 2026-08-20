// ============================================
// CONFIGURACIÓN DE CLAUDE API
// Centraliza todo relacionado con IA
// ============================================

import Anthropic from '@anthropic-ai/sdk';

// Configuración por defecto para todos los agentes.
// Declarada ANTES del cliente porque el constructor referencia aiConfig.timeout.
export const aiConfig = {
  // Modelo a usar (configurable con AI_MODEL; default: modelo Opus vigente)
  model: process.env.AI_MODEL || 'claude-opus-5',

  // Máximo de tokens en la respuesta
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),

  // NOTA: NO enviar `temperature` a la API. El modelo Opus vigente
  // (claude-opus-5) lo rechaza con 400 "temperature is deprecated for this
  // model", lo que rompía todos los agentes (risk/economic/reporting) y dejaba
  // el análisis sin registro 'combined'. Las llamadas omiten el parámetro.

  // NOTA: Opus 5 activa "thinking" adaptativo por defecto (a diferencia de
  // 4.8, donde estaba apagado salvo que se pidiera). Lo desactivamos
  // explícitamente en cada llamada porque varios endpoints usan max_tokens
  // chicos (120-600) que no dejan margen para bloques de thinking sin
  // truncar la respuesta real.
  thinking: { type: 'disabled' as const },

  // Timeout en milisegundos
  timeout: 60000,
};

// Inicializar cliente de Claude.
// timeout: sin esto aplicaría el default del SDK (~10 min) y una llamada colgada
// dejaría la petición de save-mapping corriendo indefinidamente. maxRetries: 1
// evita que los reintentos automáticos apilen esperas de 60s.
export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: aiConfig.timeout,
  maxRetries: 1,
});

