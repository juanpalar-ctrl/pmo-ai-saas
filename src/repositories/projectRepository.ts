import { pool } from '../db';
import { ProjectData } from '../types/projectSchema';

export class ProjectRepository {
  
  // Obtener proyecto para agentes IA
  async getProjectForAnalysis(projectId: number): Promise<ProjectData | null> {
    try {
      const result = await pool.query(
        `SELECT 
          projectId, projectName, status,
          timelineData as timeline,
          velocityData as "teamVelocity",
          workPendingData as "workPending",
          budgetData as budget,
          resourcesData as resources,
          risksData as risks
         FROM project_data 
         WHERE projectId = $1`,
        [projectId]
      );
      
      return result.rows[0] || null;
      
    } catch (error: any) {
      console.error(`Error fetching project ${projectId}:`, error.message);
      throw error;
    }
  }
  
  // Guardar/actualizar proyecto
  async saveProject(data: ProjectData): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO project_data 
         (projectId, projectName, status, timelineData, velocityData, workPendingData, budgetData, resourcesData, risksData)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (projectId) DO UPDATE SET 
         projectName = EXCLUDED.projectName,
         status = EXCLUDED.status,
         timelineData = EXCLUDED.timelineData,
         velocityData = EXCLUDED.velocityData,
         workPendingData = EXCLUDED.workPendingData,
         budgetData = EXCLUDED.budgetData,
         resourcesData = EXCLUDED.resourcesData,
         risksData = EXCLUDED.risksData,
         updatedAt = CURRENT_TIMESTAMP`,
        [
          data.projectId,
          data.projectName,
          data.status,
          JSON.stringify(data.timeline),
          JSON.stringify(data.teamVelocity),
          JSON.stringify(data.workPending),
          JSON.stringify(data.budget),
          JSON.stringify(data.resources),
          JSON.stringify(data.risks),
        ]
      );
    } catch (error: any) {
      console.error('Error saving project:', error.message);
      throw error;
    }
  }
  
  // Obtener todos los proyectos (paginated)
  async getAllProjects(page: number = 1, limit: number = 50): Promise<ProjectData[]> {
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      `SELECT 
        projectId, projectName, status,
        timelineData as timeline,
        velocityData as "teamVelocity",
        workPendingData as "workPending",
        budgetData as budget,
        resourcesData as resources,
        risksData as risks
       FROM project_data 
       ORDER BY updatedAt DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  }
}

export const projectRepository = new ProjectRepository();