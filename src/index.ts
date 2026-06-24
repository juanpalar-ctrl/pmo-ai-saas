import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import analysisRouter from './routes/analysis';
import dataRouter from './routes/data';
import devRouter from './routes/dev';
import authRouter from './routes/auth';
import debugRouter from './routes/debug';
import { requireAuth } from './middleware/requireAuth';
import adminRouter from './routes/admin';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY no está definida');
  process.exit(1);
}

console.log('✅ Configuración de Claude API cargada');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// RUTAS PÚBLICAS
app.use('/api/auth', authRouter);
app.use('/api/debug', debugRouter);  // ← DEBUG SIN AUTENTICACIÓN

app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// RUTAS PROTEGIDAS
app.use('/api/analysis', requireAuth as any, analysisRouter);
app.use('/api/data', requireAuth as any, dataRouter);
app.use('/api/dev', devRouter);
app.use('/api/admin', requireAuth as any, adminRouter);

app.get('/', requireAuth as any, (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/projects', requireAuth as any, (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/projects.html'));
});

app.use((_req, res) => {
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
