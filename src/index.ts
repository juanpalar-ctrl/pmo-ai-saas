import express, { Express, Request, Response } from 'express';
import path from 'path';
import { config } from './config/environment';
import { initializeDatabase } from './init-db-pg';
const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../src/public')));

// Importar rutas
import skillsRouter from './routes/skills';
import programsRouter from './routes/programs';
import { loadDemoData } from './services/demoDataLoader';

app.use('/api/skills', skillsRouter);
app.use('/api/programs', programsRouter);

// Ruta para cargar datos DEMO
app.get('/api/load-demo-data/:clientId', async (req: any, res: any) => {
  try {
    const clientId = req.params.clientId;
    const message = await loadDemoData(parseInt(clientId));
    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
// Inicializar BD
initializeDatabase().catch(console.error);
app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${config.nodeEnv}`);
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../src/public')));
app.use('/api/skills', skillsRouter);
app.get('/api/load-demo-data/:clientId', async (req: any, res: any) => {
  try {
    const clientId = req.params.clientId;
    const message = await loadDemoData(parseInt(clientId));
    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
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

// Iniciar servidor
app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${config.nodeEnv}`);
});