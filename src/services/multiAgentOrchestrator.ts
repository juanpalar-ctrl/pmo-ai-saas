import { riskAgent } from '../agents/riskAgent';
import { economicAgent } from '../agents/economicAgent';
import { pool } from '../db';

export class MultiAgentOrchestrator {
  
  async analyzeProject(projectId: number, framework: string = 'scrum') {
    console.log(`\n🎯 Iniciando análisis para proyecto ${projectId} (${framework})`);
    
    try {
      // Obtener proyecto de la BD
      const projectRes = await pool.query(
        `SELECT * FROM project_data WHERE projectid = $1 LIMIT 1`,
        [projectId]
      );
      
      if (projectRes.rows.length === 0) {
        throw new Error(`Proyecto ${projectId} no encontrado`);
      }
      
      const project = projectRes.rows[0];
      
      // Set framework
      riskAgent.setFramework(framework);
      economicAgent.setFramework(framework);
      
      // 1. Risk Agent
      console.log('1️⃣ Risk Agent...');
      const riskAnalysis = await riskAgent.analyze({
        projectId,
        projectName: project.projectname,
        status: project.status,
        timeline: { percentageComplete: 45, daysRemaining: 30 },
        budget: { total: 500000, spent: 200000 }
      });
      
      // 2. Economic Agent
      console.log('2️⃣ Economic Agent...');
      const economicAnalysis = await economicAgent.analyze({
        projectId,
        projectName: project.projectname,
        status: project.status,
        timeline: { percentageComplete: 45, daysRemaining: 30 },
        budget: { total: 500000, spent: 200000 }
      });
      
      // 3. Reportes básicos
      const reports = {
        senior_report: `Análisis Ejecutivo - ${project.projectname}`,
        technical_report: `Análisis Técnico - ${project.projectname}`
      };
      
      // 4. Guardar en BD
      const output = {
        risk: riskAnalysis,
        economic: economicAnalysis,
        reports,
        framework,
        generatedAt: new Date().toISOString()
      };
      
      await pool.query(
        `INSERT INTO ai_analyses (projectid, agenttype, output) VALUES ($1, $2, $3)`,
        [projectId, 'multi_agent', JSON.stringify(output)]
      );
      
      console.log('✅ Análisis guardado en BD');
      return output;
      
    } catch (error: any) {
      console.error('❌ Error en orchestrador:', error.message);
      throw error;
    }
  }
}

export const orchestrator = new MultiAgentOrchestrator();
