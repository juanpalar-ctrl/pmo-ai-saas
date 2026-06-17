import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/pmo_saas',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key',
    expiresIn: '7d',
  },
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
  },
  jira: {
    apiUrl: process.env.JIRA_API_URL || '',
  },
  ai: {
    model: process.env.AI_MODEL || 'gpt-4',
  },
};
