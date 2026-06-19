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
  // Modelo a usar
  model: process.env.AI_MODEL || 'claude-opus-4-6',
  
  // Máximo de tokens en la respuesta
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),
  
  // Creatividad (0 = determinístico, 1 = creativo)
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  
  // Timeout en milisegundos
  timeout: 60000,
};

// Validar que la API key existe
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ERROR: ANTHROPIC_API_KEY no definida en .env');
  process.exit(1);
}

console.log('✅ Configuración de Claude API cargada');