import express from 'express';
import { detectColumnMapping } from '../agents/normalizationAgent';
import { pool } from '../db';
import * as XLSX from 'xlsx';
import fs from 'fs';

const router = express.Router();

router.post('/detect-columns', async (req: any, res: any) => {
  try {
    const filePath = req.body.filePath;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Archivo no encontrado' });
    }

    // Leer Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Obtener datos
    const data = XLSX.utils.sheet_to_json(worksheet);
    const headers = Object.keys(data[0] || {});
    const sampleRows = data.slice(0, 3);

    console.log(`📊 Detectando columnas: ${headers.length} columnas encontradas`);

    // Llamar al agente normalizador
    const mapping = await detectColumnMapping({
      headers,
      sampleRows: sampleRows as Record<string, any>[],
    });

    res.json({
      success: true,
      headers,
      sampleRows,
      mapping,
      message: '✅ Mapeo de columnas detectado',
    });
  } catch (error: any) {
    console.error('❌ Error detectando columnas:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
