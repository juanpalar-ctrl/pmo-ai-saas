// ============================================
// ARCHIVO PRINCIPAL DEL SERVIDOR
// Este archivo inicia el servidor Express
// ============================================

import express, { Express, Request, Response } from 'express';
import path from 'path';
import { config } from './config/environment';
import skillsRouter from './routes/skills';
import programsRouter from './routes/programs';
import analysisRouter from './routes/analysis';
const app: Express = express();

// ============================================
// MIDDLEWARE (Procesadores de peticiones)
// ============================================

// Permite recibir datos en formato JSON
app.use(express.json());

// Sirve archivos estáticos (HTML, CSS, imágenes)
// desde la carpeta public
app.use(express.static(path.join(__dirname, '../src/public')));

// ============================================
// RUTAS API (Endpoints para trabajar con datos)
// ============================================

// /api/skills → Maneja los frameworks (Scrum, Kanban, SAFe)
app.use('/api/skills', skillsRouter);

// /api/programs → Maneja proyectos, epics, tareas
app.use('/api/programs', programsRouter);
app.use('/api/analysis', analysisRouter);
// ============================================
// RUTAS PRINCIPALES
// ============================================

// Ruta raíz: sirve el Dashboard
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../src/public/dashboard.html'));
});

// Ruta de salud: verifica si el servidor está vivo
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'PMO SaaS Backend está funcionando',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

// Puerto: 3001 en desarrollo, 10000 en Render
const PORT = parseInt(process.env.PORT || '3001', 10);

// Host: 0.0.0.0 permite que Render acceda desde cualquier interfaz
const HOST = '0.0.0.0';

// Inicia el servidor y muestra mensajes
app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${config.nodeEnv}`);
});