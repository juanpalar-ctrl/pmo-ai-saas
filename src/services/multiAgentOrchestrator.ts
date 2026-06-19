// ============================================
// ORQUESTADOR MULTI-AGENTE
// Coordina los 3 agentes en secuencia
// ============================================

import { pool } from '../db';
import { riskAgent } from '../agents/riskAgent';
import { economicAgent } from '../agents/economicAgent';
import { reportingAgent } from '../agents/reportingAgent';
import { AgentInput } from '../types/agents';

export class MultiAgentOrchestrator {
  
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
      console.log('\n' + '─'.repeat(60));
      economicAgent.setRiskAnalysis(riskAnalysis);
      const economicAnalysis = await economicAgent.analyze(projectData);
      console.log('✅ Agente 2 completado');
      
      // 4. EJECUTAR AGENTE 3: REPORTES
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
  
  // Helper: obtener datos del proyecto
  private async getProjectData(projectId: number): Promise<AgentInput> {
    // Datos mock para testing
    return {
      projectId,
      projectName: 'Transformación Digital',
      status: 'In Progress',
      timeline: {
        startDate: '2026-01-15',
        endDate: '2026-06-30',
        daysElapsed: 156,
        daysRemaining: 12,
        percentageComplete: 92.8,
      },
      teamVelocity: [45, 48, 42, 50, 40],
      workPending: {
        epicsRemaining: 2,
        tasksRemaining: 23,
        totalStoryPoints: 120,
      },
      budget: {
        totalBudget: 500000,
        spent: 432000,
        remaining: 68000,
      },
      resources: [
        { role: 'Architect', count: 1, costPerMonth: 15000 },
        { role: 'Senior Developer', count: 3, costPerMonth: 8000 },
        { role: 'QA', count: 2, costPerMonth: 4000 },
      ],
      risks: [
        { description: 'Legacy integration', severity: 'critical', probability: 0.8 },
        { description: 'Team capacity', severity: 'high', probability: 0.6 },
      ],
    };
  }
  
  // Helper: guardar análisis en BD
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

// Exportar instancia
export const orchestrator = new MultiAgentOrchestrator();