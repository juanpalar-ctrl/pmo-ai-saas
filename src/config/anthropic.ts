// ============================================
// CONFIGURACIÓN DE CLAUDE API
// Centraliza todo relacionado con IA
// ============================================

import Anthropic from '@anthropic-ai/sdk';

// Configuración por defecto para todos los agentes.
// Declarada ANTES del cliente porque el constructor referencia aiConfig.timeout.
export const aiConfig = {
  // Modelo a usar (configurable con AI_MODEL; default: modelo Opus vigente)
  model: process.env.AI_MODEL || 'claude-opus-4-8',

  // Máximo de tokens en la respuesta
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),

  // NOTA: NO enviar `temperature` a la API. El modelo Opus vigente
  // (claude-opus-4-8) lo rechaza con 400 "temperature is deprecated for this
  // model", lo que rompía todos los agentes (risk/economic/reporting) y dejaba
  // el análisis sin registro 'combined'. Las llamadas omiten el parámetro.

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

