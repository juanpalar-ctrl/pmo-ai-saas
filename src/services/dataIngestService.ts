import { IDataAdapter } from './adapters/IDataAdapter';
import { projectRepository } from '../repositories/projectRepository';

export class DataIngestService {
  
  // Procesar datos desde cualquier adapter
  async ingestFromAdapter(adapter: IDataAdapter): Promise<void> {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Iniciando ingesta: ${adapter.name}`);
      console.log(`${'='.repeat(60)}\n`);
      
      // 1. Leer datos
      const projects = await adapter.read();
      
      // 2. Guardar en BD
      console.log(`\n💾 Guardando ${projects.length} proyectos en BD...`);
      for (const project of projects) {
        await projectRepository.saveProject(project);
      }
      
      console.log(`\n✅ Ingesta completada: ${projects.length} proyectos`);
      
    } catch (error: any) {
      console.error(`\n❌ Error en ingesta: ${error.message}`);
      throw error;
    }
  }
}

export const dataIngestService = new DataIngestService();