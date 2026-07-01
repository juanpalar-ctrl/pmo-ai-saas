import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import express from 'express';
import cors from 'cors';
import path from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { logger } from './core/logger';
import analysisRouter from './routes/analysis';
import dataRouter from './routes/data';
import devRouter from './routes/dev';
import authRouter from './routes/auth';
import brandingRouter from './routes/branding';
import debugRouter from './routes/debug';
import { requireAuth } from './middleware/requireAuth';
import { adminAuthMiddleware } from './middleware/adminAuthMiddleware';
import adminRouter from './routes/admin';
import dataMappingRoutes from './routes/dataMapping';
import chatRouter from './routes/chat';
import portfolioRouter from './routes/portfolio';
import { scheduleCleanupJob } from './services/tempFileCleanup';
import { runMigrations, seedAdminUser } from './db-migrate';
import { mkdirSync } from 'fs';

if (!process.env.ANTHROPIC_API_KEY) {
  logger.warn('ANTHROPIC_API_KEY no está definida — las funciones de IA no funcionarán');
} else {
  logger.info('Configuración de Claude API cargada');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Render (and most cloud providers) sit behind a reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled: app uses inline scripts/styles and CDN resources
  crossOriginEmbedderPolicy: false,
}));

// CORS — allow configured origins (localhost for dev, env var for prod)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [`http://localhost:${PORT}`];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Rate limiting — auth endpoints: 20 req/15min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Espera 15 minutos.' },
});

// Chat rate limit: 60 req/min per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Límite de mensajes alcanzado. Espera un momento.' },
});

// Heavy endpoints: analysis, upload, portfolio — 30 req/15min per IP
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes. Espera unos minutos.' },
});

// HTTP request logging (skips static assets to reduce noise)
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url?.startsWith('/favicon') || req.url?.endsWith('.css') || req.url?.endsWith('.js') || req.url?.endsWith('.jpeg') || req.url?.endsWith('.png') || false },
  customLogLevel: (_req, res) => res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/branding', brandingRouter);
app.use('/api/debug', adminAuthMiddleware, debugRouter);
app.use('/api/data/mapping', requireAuth, heavyLimiter, dataMappingRoutes);

app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/chat', requireAuth, chatLimiter, chatRouter);
app.use('/api/portfolio', requireAuth, heavyLimiter, portfolioRouter);
app.use('/api/analysis', requireAuth, heavyLimiter, analysisRouter);
app.use('/api/data', requireAuth, heavyLimiter, dataRouter);
app.use('/api/dev', adminAuthMiddleware, devRouter);
app.use('/api/admin', requireAuth, adminRouter);

app.get('/', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/projects', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/projects.html'));
});

app.get('/portfolio', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/portfolio.html'));
});

app.get('/reset-password', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/reset-password.html'));
});

app.use((_req, res) => {
  res.redirect('/login');
});

mkdirSync('./uploads', { recursive: true });

scheduleCleanupJob(60 * 60 * 1000);
logger.info('Temp file cleanup job scheduled');

// Run migrations + seed, then start server
runMigrations()
  .then(() => seedAdminUser())
  .then(() => {
    app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Servidor iniciado');
    });
  })
  .catch((err) => {
    logger.error({ err: err.message }, 'Startup DB step failed — starting server anyway');
    app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Servidor iniciado (sin migraciones)');
    });
  });
