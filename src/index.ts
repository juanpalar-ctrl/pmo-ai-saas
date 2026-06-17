import express from 'express';
import path from 'path';
import { config } from './config/environment';
import skillsRouter from './routes/skills';
import programsRouter from './routes/programs';
import { loadDemoData } from './services/demoDataLoader';
const app = express();

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
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${config.nodeEnv}`);
});
