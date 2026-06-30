import { serviceLogger } from '../../core/logger';
/**
 * src/services/adapters/ExcelAdapter.ts
 * Enhanced Excel Adapter with detailed error collection from Zod validation.
 */

import * as XLSX from 'xlsx';
import { IDataAdapter } from './IDataAdapter';
import { ProjectData, ProjectDataSchema } from '../../types/projectSchema';
import * as fs from 'fs';
import { ZodError } from 'zod';

export interface RejectedRow {
  rowIndex: number;
  errors: string[];
}

export interface ReadResult {
  validProjects: ProjectData[];
  rejectedRows: RejectedRow[];
}

export class ExcelAdapter implements IDataAdapter {
  name = '📊 Excel Adapter';
  
  constructor(private filePath: string) {}
  
  /**
   * READ - Leer datos del Excel con captura de errores detallados
   * 
   * FLUJO:
   * 1. Verifica que archivo existe
   * 2. Abre con librería XLSX
   * 3. Lee primera hoja
   * 4. Convierte a array de objetos
   * 5. Parsea strings JSON a objetos
   * 6. Valida cada fila y captura errores de Zod
   * 7. Retorna validRows y rejectedRows con detalles
   */
  async read(): Promise<ProjectData[]> {
    serviceLogger.info(`\n📂 ${this.name}: Leyendo ${this.filePath}`);
    
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`❌ Archivo no encontrado: ${this.filePath}`);
    }
    
    try {
      const workbook = XLSX.readFile(this.filePath);
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('❌ Excel no tiene hojas');
      }
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      let rawData: any[] = XLSX.utils.sheet_to_json(worksheet);
      
      serviceLogger.info(`📄 Se leyeron ${rawData.length} filas del Excel`);
      
      rawData = rawData.map(row => this.parseJsonFields(row));
      
      const validProjects: ProjectData[] = [];
      let validCount = 0;
      let invalidCount = 0;
      
      for (const row of rawData) {
        if (await this.validate(row)) {
          validProjects.push(row as ProjectData);
          validCount++;
        } else {
          invalidCount++;
        }
      }
      
      serviceLogger.info(`✅ ${validCount} válidos | ❌ ${invalidCount} rechazados`);
      
      return validProjects;
      
    } catch (error: any) {
      serviceLogger.error(`❌ Error leyendo Excel: ${error.message}`);
      throw error;
    }
  }

  /**
   * READ WITH DETAILS - Leer datos y retornar detalles de errores
   * 
   * NUEVO MÉTODO: Retorna objeto con validProjects y rejectedRows
   * Para usar en endpoints que necesitan mostrar errores al frontend.
   */
  async readWithDetails(): Promise<ReadResult> {
    serviceLogger.info(`\n📂 ${this.name}: Leyendo con detalles ${this.filePath}`);
    
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`❌ Archivo no encontrado: ${this.filePath}`);
    }
    
    try {
      const workbook = XLSX.readFile(this.filePath);
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('❌ Excel no tiene hojas');
      }
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      let rawData: any[] = XLSX.utils.sheet_to_json(worksheet);
      
      serviceLogger.info(`📄 Se leyeron ${rawData.length} filas del Excel`);
      
      rawData = rawData.map(row => this.parseJsonFields(row));
      
      const validProjects: ProjectData[] = [];
      const rejectedRows: RejectedRow[] = [];
      let validCount = 0;
      let invalidCount = 0;
      
      for (let index = 0; index < rawData.length; index++) {
        const row = rawData[index];
        const validationResult = await this.validateWithErrors(row);
        
        if (validationResult.valid) {
          validProjects.push(row as ProjectData);
          validCount++;
        } else {
          rejectedRows.push({
            rowIndex: index + 2,
            errors: validationResult.errors,
          });
          invalidCount++;
        }
      }
      
      serviceLogger.info(`✅ ${validCount} válidos | ❌ ${invalidCount} rechazados`);
      
      return {
        validProjects,
        rejectedRows,
      };
      
    } catch (error: any) {
      serviceLogger.error(`❌ Error leyendo Excel: ${error.message}`);
      throw error;
    }
  }
  
  private parseJsonFields(row: any): any {
    const jsonFields = [
      'timeline',
      'teamVelocity',
      'workPending',
      'budget',
      'resources',
      'risks',
    ];
    
    const parsed = { ...row };
    
    for (const field of jsonFields) {
      if (parsed[field] && typeof parsed[field] === 'string') {
        try {
          parsed[field] = JSON.parse(parsed[field]);
        } catch (error) {
          serviceLogger.warn(`⚠️ No se pudo parsear campo ${field}: ${parsed[field]}`);
        }
      }
    }
    
    return parsed;
  }
  
  /**
   * VALIDATE - Original method (backwards compatible)
   */
  async validate(data: any): Promise<boolean> {
    try {
      ProjectDataSchema.parse(data);
      return true;
    } catch (error: any) {
      const preview = JSON.stringify(data).substring(0, 50);
      serviceLogger.warn(`⚠️ Fila rechazada (${preview}...) - ${error.message}`);
      return false;
    }
  }

  /**
   * VALIDATE WITH ERRORS - NEW: Captura errores detallados de Zod
   * 
   * RETORNA: { valid: boolean, errors: string[] }
   * 
   * Si la validación falla, captura cada error de Zod
   * y lo formatea como string legible para el usuario.
   */
  private async validateWithErrors(data: any): Promise<{ valid: boolean; errors: string[] }> {
    try {
      ProjectDataSchema.parse(data);
      return { valid: true, errors: [] };
    } catch (error: any) {
      if (error instanceof ZodError) {
        // Extraer mensajes de error de Zod
        const errorMessages = error.issues.map((issue: any) => {
          const field = issue.path.join('.');
          const message = issue.message;
          return `${field}: ${message}`;
        });
        
        serviceLogger.warn(`⚠️ Errores de validación: ${errorMessages.join(', ')}`);
        
        return {
          valid: false,
          errors: errorMessages,
        };
      }
      
      // Si no es ZodError, retorna mensaje genérico
      return {
        valid: false,
        errors: [error.message || 'Error desconocido de validación'],
      };
    }
  }
}
