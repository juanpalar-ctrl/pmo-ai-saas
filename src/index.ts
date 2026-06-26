import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import analysisRouter from './routes/analysis';
import dataRouter from './routes/data';
import devRouter from './routes/dev';
import authRouter from './routes/auth';
import brandingRouter from './routes/branding';
import debugRouter from './routes/debug';
import { requireAuth } from './middleware/requireAuth';
import adminRouter from './routes/admin';
import dataMappingRoutes from './routes/dataMapping';
import { scheduleCleanupJob } from './services/tempFileCleanup';
import { mkdirSync } from 'fs';
import { pool } from './db';

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

app.use('/api/auth', authRouter);
app.use('/api/branding', brandingRouter);
app.use('/api/debug', debugRouter);
app.use('/api/data/mapping', dataMappingRoutes);

app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

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

app.get('/reset-password', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/reset-password.html'));
});
app.get('/debug/check-data/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const pdResult = await pool.query('SELECT id, projectid FROM project_data WHERE id = $1', [projectId]);
    if (pdResult.rows.length === 0) {
      return res.json({ error: 'Project not found' });
    }
    
    const realProjectId = pdResult.rows[0].projectid;
    const aaResult = await pool.query('SELECT projectid, agenttype, output FROM ai_analyses WHERE projectid = $1', [realProjectId]);
    
    res.json({
      project_data: pdResult.rows[0],
      ai_analyses: aaResult.rows
    });
  } catch (err: any) {
    res.json({ error: err.message });
  }
});
app.use((_req, res) => {
  res.redirect('/login');
});

mkdirSync('./uploads', { recursive: true });

scheduleCleanupJob(60 * 60 * 1000);
console.log('[Index] Temp file cleanup job scheduled');

// Debug: Show project_data and ai_analyses schema
Promise.all([
  pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'project_data' ORDER BY ordinal_position`),
  pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ai_analyses' ORDER BY ordinal_position`)
])
  .then(([result1, result2]) => {
    console.log('\n=== project_data SCHEMA ===');
    result1.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));
    console.log('===========================');
    console.log('\n=== ai_analyses SCHEMA ===');
    result2.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));
    console.log('===========================\n');
  })
  .catch(err => console.error('Schema query failed:', err));

app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
