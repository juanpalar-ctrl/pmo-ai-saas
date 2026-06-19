// ============================================
// ADAPTER PARA EXCEL
// 
// PROPÓSITO: Lee archivo .xlsx y transforma
// datos Excel → Formato ProjectData
//
// CÓMO FUNCIONA:
// 1. Abre archivo Excel
// 2. Lee primera hoja
// 3. Convierte filas a JSON
// 4. Valida cada fila con Zod
// 5. Retorna solo filas válidas
//
// IMPLEMENTA: IDataAdapter interface
// ============================================

import * as XLSX from 'xlsx';
import { IDataAdapter } from './IDataAdapter';
import { ProjectData, ProjectDataSchema } from '../../types/projectSchema';
import * as fs from 'fs';

export class ExcelAdapter implements IDataAdapter {
  // Nombre visible en logs
  name = '📊 Excel Adapter';
  
  /**
   * CONSTRUCTOR
   * 
   * FUNCIÓN: Inicializa el adapter con la ruta del archivo Excel
   * 
   * @param filePath - Ruta al archivo .xlsx (ej: './projects.xlsx')
   */
  constructor(private filePath: string) {}
  
  /**
   * READ - Leer datos del Excel
   * 
   * FLUJO:
   * 1. Verifica que archivo existe
   * 2. Abre con librería XLSX
   * 3. Lee primera hoja
   * 4. Convierte a array de objetos
   * 5. Valida cada fila
   * 6. Retorna solo las válidas
   * 
   * @returns Array de ProjectData listos para guardar en BD
   * 
   * LANZA ERROR si:
   * - Archivo no existe
   * - No hay hojas en Excel
   * - Error de lectura
   */
  async read(): Promise<ProjectData[]> {
    console.log(`\n📂 ${this.name}: Leyendo ${this.filePath}`);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`❌ Archivo no encontrado: ${this.filePath}`);
    }
    
    try {
      // Abrir Excel
      const workbook = XLSX.readFile(this.filePath);
      
      // Si no hay hojas, error
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('❌ Excel no tiene hojas');
      }
      
      // Leer primera hoja
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convertir Excel a array JSON
      // Cada fila del Excel → objeto JavaScript
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);
      console.log(`📄 Se leyeron ${rawData.length} filas del Excel`);
      
      // Validar y filtrar filas
      const validProjects: ProjectData[] = [];
      let validCount = 0;
      let invalidCount = 0;
      
      // Procesar cada fila
      for (const row of rawData) {
        if (await this.validate(row)) {
          validProjects.push(row as ProjectData);
          validCount++;
        } else {
          invalidCount++;
        }
      }
      
      // Log de resultados
      console.log(`✅ ${validCount} válidos | ❌ ${invalidCount} rechazados`);
      
      return validProjects;
      
    } catch (error: any) {
      console.error(`❌ Error leyendo Excel: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * VALIDATE - Validar una fila
   * 
   * FUNCIÓN: Usa Zod para verificar que la fila
   * cumpla el schema ProjectDataSchema.
   * 
   * FLUJO:
   * 1. Intenta parsear fila con Zod
   * 2. Si cumple → retorna true
   * 3. Si no → log de error + retorna false
   * 
   * @param data - Fila del Excel (como objeto JSON)
   * @returns true si cumple schema, false si no
   * 
   * NOTA: Si falta un campo o tipo es incorrecto,
   * Zod lo detecta automáticamente y lo marca inválido.
   * 
   * NOTA: El usuario verá advertencia pero el proceso
   * continúa (no falla si una fila está mal)
   */
  async validate(data: any): Promise<boolean> {
    try {
      // Zod valida automáticamente contra ProjectDataSchema
      // Si algo está mal, lanza error
      ProjectDataSchema.parse(data);
      
      // Si llegamos aquí, es válido
      return true;
      
    } catch (error: any) {
      // Log breve de qué falló (para debug del usuario)
      const preview = JSON.stringify(data).substring(0, 50);
      console.warn(`⚠️ Fila rechazada (${preview}...) - ${error.message}`);
      
      // Retorna false pero NO falla el proceso
      return false;
    }
  }
}