/**
 * src/services/dataIngestService.ts
 * Data ingestion service with detailed error handling.
 */

import { IDataAdapter } from './adapters/IDataAdapter';
import { projectRepository } from '../repositories/projectRepository';
import { serviceLogger } from '../core/logger';

export interface IngestResult {
  count: number;
  rejected: number;
}

export interface IngestResultWithDetails extends IngestResult {
  rejectionReasons: string[];
}

export class DataIngestService {
  
  /**
   * ORIGINAL METHOD: Procesar datos desde cualquier adapter
   * (Backwards compatible)
   */
  async ingestFromAdapter(adapter: IDataAdapter, userId: string): Promise<IngestResult> {
    try {
      serviceLogger.info(`\n${'='.repeat(60)}`);
      serviceLogger.info(`🔄 Iniciando ingesta: ${adapter.name}`);
      serviceLogger.info(`${'='.repeat(60)}\n`);

      // 1. Leer datos
      const projects = await adapter.read();
      const validCount = projects.length;

      // 2. Guardar en BD
      serviceLogger.info(`\n💾 Guardando ${validCount} proyectos en BD...`);
      for (const project of projects) {
        await projectRepository.saveProject(project, userId);
      }
      
      serviceLogger.info(`\n✅ Ingesta completada: ${validCount} proyectos`);
      
      return {
        count: validCount,
        rejected: (adapter as any).rejectedCount || 0
      };
      
    } catch (error: any) {
      serviceLogger.error(`\n❌ Error en ingesta: ${error.message}`);
      throw error;
    }
  }

  /**
   * NEW METHOD: Procesar datos con detalles de errores
   * Usa readWithDetails() si está disponible en el adapter
   */
  async ingestFromAdapterWithDetails(adapter: IDataAdapter, userId: string): Promise<IngestResultWithDetails> {
    try {
      serviceLogger.info(`\n${'='.repeat(60)}`);
      serviceLogger.info(`🔄 Iniciando ingesta con detalles: ${adapter.name}`);
      serviceLogger.info(`${'='.repeat(60)}\n`);
      
      // 1. Leer datos con detalles
      const adapterWithDetails = adapter as any;
      if (!adapterWithDetails.readWithDetails) {
        throw new Error('Adapter no soporta readWithDetails()');
      }

      const { validProjects, rejectedRows } = await adapterWithDetails.readWithDetails();
      const validCount = validProjects.length;
      const rejectedCount = rejectedRows.length;
      
      // 2. Formatear razones de rechazo para el frontend
      const rejectionReasons = rejectedRows.flatMap((item: any) =>
        item.errors.map((error: string) => `Fila ${item.rowIndex}: ${error}`)
      );
      
      // 3. Guardar proyectos válidos en BD
      serviceLogger.info(`\n💾 Guardando ${validCount} proyectos válidos en BD...`);
      for (const project of validProjects) {
        await projectRepository.saveProject(project, userId);
      }
      
      serviceLogger.info(`\n✅ Ingesta completada: ${validCount} válidos, ${rejectedCount} rechazados`);
      
      return {
        count: validCount,
        rejected: rejectedCount,
        rejectionReasons,
      };
      
    } catch (error: any) {
      serviceLogger.error(`\n❌ Error en ingesta: ${error.message}`);
      throw error;
    }
  }
}

export const dataIngestService = new DataIngestService();
