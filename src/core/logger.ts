import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// Redact sensitive fields from all log output
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'body.password',
  'body.token',
  'token',
  'password',
  'apiKey',
  'ANTHROPIC_API_KEY',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
});

// Named child loggers for each subsystem — keep context without repetition
export const agentLogger   = logger.child({ module: 'agent' });
export const routeLogger   = logger.child({ module: 'route' });
export const dbLogger      = logger.child({ module: 'db' });
export const authLogger    = logger.child({ module: 'auth' });
export const serviceLogger = logger.child({ module: 'service' });
