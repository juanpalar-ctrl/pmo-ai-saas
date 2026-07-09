// ============================================
// CONFIGURACIÓN DE CLAUDE API
// Centraliza todo relacionado con IA
// ============================================

import Anthropic from '@anthropic-ai/sdk';

// Inicializar cliente de Claude
export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configuración por defecto para todos los agentes
export const aiConfig = {
  // Modelo a usar (configurable con AI_MODEL; default: modelo Opus vigente)
  model: process.env.AI_MODEL || 'claude-opus-4-8',
  
  // Máximo de tokens en la respuesta
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),
  
  // Creatividad (0 = determinístico, 1 = creativo)
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  
  // Timeout en milisegundos
  timeout: 60000,
};

