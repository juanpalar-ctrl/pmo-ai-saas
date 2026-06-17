// ============================================
// CONFIGURACIÓN DE VARIABLES DE ENTORNO
// Este archivo lee las variables del archivo .env
// y las organiza para usarlas en toda la app
// ============================================

import dotenv from 'dotenv';

// Lee el archivo .env
dotenv.config();

// Exporta todas las configuraciones
export const config = {
  // Puerto del servidor
  port: process.env.PORT || 3001,
  
  // Ambiente: 'development' o 'production'
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Base de datos (PostgreSQL)
  database: {
    // URL de conexión a PostgreSQL
    // Formato: postgresql://usuario:contraseña@host:puerto/basedatos
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/pmo_saas',
  },
  
  // Autenticación con JWT (tokens)
  jwt: {
    // Clave secreta para firmar tokens (cambiar en producción)
    secret: process.env.JWT_SECRET || 'dev-secret-key',
    // Los tokens expiran después de 7 días
    expiresIn: '7d',
  },
  
  // Integración con Slack (para el futuro)
  slack: {
    // Token del bot de Slack
    botToken: process.env.SLACK_BOT_TOKEN || '',
  },
  
  // Integración con Jira (para el futuro)
  jira: {
    // URL base de Jira
    apiUrl: process.env.JIRA_API_URL || '',
  },
  
  // Integración con IA (para el futuro)
  ai: {
    // Modelo de IA a usar (OpenAI, Claude, etc)
    model: process.env.AI_MODEL || 'gpt-4',
  },
};