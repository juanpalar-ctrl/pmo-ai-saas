// ============================================
// ORQUESTADOR MULTI-AGENTE
// 
// PROPÓSITO: Coordina la ejecución de los 3 agentes IA
// en secuencia y guarda resultados en BD.
//
// FLUJO:
// 1. Obtiene datos del proyecto (desde BD)
// 2. Agente 1 (Riesgos) analiza
// 3. Agente 2 (Económico) analiza (recibe output de 1)
// 4. Agente 3 (Reportes) genera (recibe output de 1+2)
// 5. Guarda análisis completo en BD
// 6. Retorna JSON con todos los análisis
// ============================================

import { pool } from '../db';
import { riskAgent } from '../agents/riskAgent';
import { economicAgent } from '../agents/economicAgent';
import { reportingAgent } from '../agents/reportingAgent';
import { AgentInput } from '../types/agents';
import { projectRepository } from '../repositories/projectRepository';

export class MultiAgentOrchestrator {
  
  /**
   * ANALIZAR PROYECTO
   * 
   * FUNCIÓN PRINCIPAL: Ejecuta análisis completo multi-agente
   * 
   * @param projectId - ID del proyecto a analizar
   * @returns JSON con riskAnalysis, economicAnalysis, reports
   * 
   * FLUJO:
   * 1. Obtiene datos del proyecto
   * 2. Ejecuta Agente 1 (Riesgos)
   * 3. Ejecuta Agente 2 (Económico) con output de 1
   * 4. Ejecuta Agente 3 (Reportes) con outputs de 1+2
   * 5. Guarda en BD
   * 6. Retorna resultados
   */
  async analyzeProject(projectId: number) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 INICIANDO ANÁLISIS MULTI-AGENTE - Proyecto ID: ${projectId}`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      // 1. OBTENER DATOS DEL PROYECTO
      console.log('📥 Obteniendo datos del proyecto...');
      const projectData = await this.getProjectData(projectId);
      
      // 2. EJECUTAR AGENTE 1: RIESGOS
      console.log('\n' + '─'.repeat(60));
      const riskAnalysis = await riskAgent.analyze(projectData);
      console.log('✅ Agente 1 completado');
      
      // 3. EJECUTAR AGENTE 2: ECONÓMICO
      // NOTA: Le pasamos output del Agente 1
      console.log('\n' + '─'.repeat(60));
      economicAgent.setRiskAnalysis(riskAnalysis);
      const economicAnalysis = await economicAgent.analyze(projectData);
      console.log('✅ Agente 2 completado');
      
      // 4. EJECUTAR AGENTE 3: REPORTES
      // NOTA: Le pasamos outputs de Agentes 1 y 2
      console.log('\n' + '─'.repeat(60));
      reportingAgent.setAnalysisOutputs(riskAnalysis, economicAnalysis);
      const reports = await reportingAgent.analyze(projectData);
      console.log('✅ Agente 3 completado');
      
      // 5. GUARDAR ANÁLISIS EN BD
      console.log('\n' + '─'.repeat(60));
      console.log('💾 Guardando análisis en BD...');
      await this.saveAnalysisToDatabase({
        projectId,
        riskAnalysis,
        economicAnalysis,
        reports,
      });
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ ANÁLISIS COMPLETO`);
      console.log(`${'='.repeat(60)}\n`);
      
      // 6. RETORNAR RESULTADO FINAL
      return {
        success: true,
        projectId,
        timestamp: new Date().toISOString(),
        riskAnalysis,
        economicAnalysis,
        reports,
      };
      
    } catch (error: any) {
      console.error('\n❌ ERROR en análisis multi-agente:', error.message);
      throw error;
    }
  }
  
  /**
   * OBTENER DATOS DEL PROYECTO
   * 
   * FUNCIÓN: Trae datos del proyecto desde BD usando Repository.
   * Antes traía datos dummy. Ahora trae datos REALES desde PostgreSQL.
   * 
   * FLUJO:
   * 1. Llama al Repository (capa de abstracción BD)
   * 2. Si no existe → lanza error
   * 3. Si existe → log + retorna datos
   * 
   * @param projectId - ID del proyecto a analizar
   * @returns Datos completos del proyecto para agentes IA
   * 
   * NOTA: Usa Repository para abstraer acceso a BD.
   * Si cambias de BD, solo cambias en Repository.
   */
  private async getProjectData(projectId: number): Promise<AgentInput> {
    // Obtener del Repository (abstracción de BD)
    const projectData = await projectRepository.getProjectForAnalysis(projectId);
    
    // Si no existe, error
    if (!projectData) {
      throw new Error(`❌ Proyecto ${projectId} no encontrado en BD`);
    }
    
    // Log de confirmación
    console.log(`\n📂 Usando datos REALES: ${projectData.projectName}`);
    
    // Retornar datos para agentes
    return projectData as AgentInput;
  }
  
  /**
   * GUARDAR ANÁLISIS EN BASE DE DATOS
   * 
   * FUNCIÓN: Guarda los resultados del análisis multi-agente
   * en la tabla ai_analyses para auditoría y reportes.
   * 
   * @param data - Contiene:
   *   - projectId: ID del proyecto
   *   - riskAnalysis: Output del Agente 1
   *   - economicAnalysis: Output del Agente 2
   *   - reports: Output del Agente 3
   * 
   * NOTA: Si la tabla no existe aún, muestra advertencia (no falla)
   * La tabla se creará en próximo paso.
   */
  private async saveAnalysisToDatabase(data: any) {
    try {
      await pool.query(
        `INSERT INTO ai_analyses (projectId, agentType, output, generatedAt)
         VALUES ($1, $2, $3, $4)`,
        [
          data.projectId,
          'COMPLETE_ANALYSIS',
          JSON.stringify({
            risk: data.riskAnalysis,
            economic: data.economicAnalysis,
            reports: data.reports,
          }),
          new Date(),
        ]
      );
      console.log('✅ Análisis guardado en BD');
    } catch (error) {
      console.error('⚠️ Advertencia: No se guardó en BD (tabla no existe aún)');
    }
  }
}

// Exportar instancia del orquestador
// Se importa así: import { orchestrator } from '../services/multiAgentOrchestrator'
export const orchestrator = new MultiAgentOrchestrator();

