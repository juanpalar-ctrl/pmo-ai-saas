import express, { Express, Request, Response } from 'express';
import path from 'path';
import { config } from './config/environment';
import skillsRouter from './routes/skills';
import programsRouter from './routes/programs';

const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../src/public')));

// Rutas API
app.use('/api/skills', skillsRouter);
app.use('/api/programs', programsRouter);

// Ruta: Servir dashboard
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../src/public/dashboard.html'));
});

// API Health
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'PMO SaaS Backend está funcionando',
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor - IMPORTANTE: bind a 0.0.0.0 para Render
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${config.nodeEnv}`);
});
