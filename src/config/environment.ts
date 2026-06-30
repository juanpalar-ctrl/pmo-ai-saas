import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// Cargar .env desde la raíz del proyecto
dotenvConfig({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost/pmo_saas'
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.AI_MODEL || 'claude-opus-4-6',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7')
  },
  jwt: {
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'dev-secret-key')
  }
};

// Validar que la clave de Anthropic esté definida
if (!config.anthropic.apiKey) {
  console.error('❌ ERROR: ANTHROPIC_API_KEY no definida en .env');
  process.exit(1);
}

console.log('✅ Configuración de Claude API cargada');
