import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import cookieParser from 'cookie-parser';
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
import { mkdirSync } from 'fs';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY no está definida');
  process.exit(1);
}

console.log('✅ Configuración de Claude API cargada');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRouter);
app.use('/api/branding', brandingRouter);
app.use('/api/debug', adminAuthMiddleware, debugRouter);
app.use('/api/data/mapping', requireAuth, dataMappingRoutes);

app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/portfolio', requireAuth, portfolioRouter);
app.use('/api/analysis', requireAuth, analysisRouter);
app.use('/api/data', requireAuth, dataRouter);
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
console.log('[Index] Temp file cleanup job scheduled');

app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
