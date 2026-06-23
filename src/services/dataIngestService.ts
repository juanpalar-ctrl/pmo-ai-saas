import { IDataAdapter } from './adapters/IDataAdapter';
import { projectRepository } from '../repositories/projectRepository';

export interface IngestResult {
  count: number;
  rejected: number;
}

export class DataIngestService {
  
  // Procesar datos desde cualquier adapter
  async ingestFromAdapter(adapter: IDataAdapter): Promise<IngestResult> {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Iniciando ingesta: ${adapter.name}`);
      console.log(`${'='.repeat(60)}\n`);
      
      // 1. Leer datos
      const projects = await adapter.read();
      const validCount = projects.length;
      
      // 2. Guardar en BD
      console.log(`\n💾 Guardando ${validCount} proyectos en BD...`);
      for (const project of projects) {
        await projectRepository.saveProject(project);
      }
      
      console.log(`\n✅ Ingesta completada: ${validCount} proyectos`);
      
      // Retornar conteos (rejected se calcula del adapter si lo tiene)
      return {
        count: validCount,
        rejected: (adapter as any).rejectedCount || 0
      };
      
    } catch (error: any) {
      console.error(`\n❌ Error en ingesta: ${error.message}`);
      throw error;
    }
  }
}

export const dataIngestService = new DataIngestService();