import 'dotenv/config';
import express from 'express';
import path from 'path';
import analysisRouter from './routes/analysis';
import dataRouter from './routes/data';
import devRouter from './routes/dev';

// VERIFICAR CLAVE ANTES DE ARRANCAR
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY no está definida');
  process.exit(1);
}

console.log('✅ ANTHROPIC_API_KEY cargada correctamente');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/analysis', analysisRouter);
app.use('/api/data', dataRouter);
app.use('/api/dev', devRouter);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
