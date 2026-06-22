import { orchestrator } from './multiAgentOrchestrator';
import { logger } from '../core/logger';
import { AnalysisInputDTO, AnalysisOutput } from '../core/types';
import { pool } from '../db';

export class AnalysisService {
  
  async executeAnalysis(input: AnalysisInputDTO): Promise<AnalysisOutput> {
    try {
      logger.info(`📊 Iniciando análisis`, { projectId: input.projectId });
      
      if (!input.forceRefresh) {
        const cached = await this.getFromCache(input.projectId);
        if (cached) {
          logger.info(`✅ Caché hit`, { projectId: input.projectId });
          return cached;
        }
      }
      
      const framework = input.framework || 'Agile';
      const result = await orchestrator.analyzeProject(input.projectId, framework);
      
      logger.info(`✅ Análisis completado`, { projectId: input.projectId });
      return result;
      
    } catch (error: any) {
      logger.error(`❌ Error en análisis`, { projectId: input.projectId, error: error.message });
      throw error;
    }
  }
  
  private async getFromCache(projectId: number): Promise<AnalysisOutput | null> {
    try {
      const result = await pool.query(
        `SELECT output, generatedat FROM ai_analyses 
         WHERE projectid = $1 
         ORDER BY generatedat DESC 
         LIMIT 1`,
        [projectId]
      );
      
      if (result.rows.length === 0) return null;
      
      const { output, generatedat } = result.rows[0];
      const ageHours = (Date.now() - new Date(generatedat).getTime()) / (1000 * 60 * 60);
      const cacheHours = parseInt(process.env.CACHE_ANALYSIS_HOURS || '24');
      
      if (ageHours > cacheHours) return null;
      
      return JSON.parse(output);
    } catch (error) {
      logger.warn(`⚠️ Error reading cache`);
      return null;
    }
  }
}

export const analysisService = new AnalysisService();