// ============================================
// REPOSITORIO DE PROYECTOS
// 
// PROPÓSITO: Capa de abstracción entre
// el resto del código y la base de datos.
//
// VENTAJA: Si cambias de BD (PostgreSQL → MongoDB),
// solo cambias AQUÍ. El resto del código no se toca.
//
// PATRÓN: Repository Pattern (mejores prácticas)
// ============================================

import { pool } from '../db';
import { ProjectData } from '../types/projectSchema';
import { dbLogger } from '../core/logger';

export class ProjectRepository {
  
  /**
   * OBTENER PROYECTO PARA ANÁLISIS IA
   * 
   * FUNCIÓN: Trae datos de un proyecto desde BD
   * para que los agentes IA lo analicen.
   * 
   * @param projectId - ID del proyecto a traer
   * @returns Datos completos del proyecto o NULL si no existe
   * 
   * NOTA: Convierte campos JSONB de BD a objetos JavaScript
   * automáticamente (timelineData → timeline, etc)
   * 
   * PASO CRÍTICO: Convierte strings JSON → objetos reales
   */
  async getProjectForAnalysis(projectId: number, userId: string): Promise<ProjectData | null> {
    try {
      dbLogger.info(`\n🔍 Buscando proyecto ${projectId} en BD...`);

      const result = await pool.query(
        `SELECT
         projectId as "projectId",
          projectName as "projectName",
          status,
          timelineData as "timelineData",
          velocityData as "velocityData",
          workPendingData as "workPendingData",
          budgetData as "budgetData",
          resourcesData as "resourcesData",
          risksData as "risksData"
         FROM project_data
         WHERE projectId = $1 AND user_id = $2`,
        [projectId, userId]
      );
      
      dbLogger.info(`   ✅ Query ejecutada. Filas encontradas: ${result.rows.length}`);
      
      // Si no hay resultados, retorna NULL
      if (!result.rows[0]) {
        dbLogger.info(`   ❌ No hay datos para proyecto ${projectId}`);
        return null;
      }
      
      const row = result.rows[0];
      dbLogger.info(`   📋 projectId: ${row.projectId}, projectName: ${row.projectName}`);
      
      // PASO CRÍTICO: Parsear campos JSONB (vienen como strings desde BD)
      // BD guarda JSON como text, necesitan ser parseados a objetos
      const parsed = {
        projectId: row.projectId,
        projectName: row.projectName,
        status: row.status,
        
        // Timeline: convertir de string a objeto
        timeline: typeof row.timelineData === 'string' 
          ? JSON.parse(row.timelineData) 
          : row.timelineData,
        
        // Team Velocity: convertir de string a array
        teamVelocity: typeof row.velocityData === 'string'
          ? JSON.parse(row.velocityData)
          : row.velocityData,
        
        // Work Pending: convertir de string a objeto
        workPending: typeof row.workPendingData === 'string'
          ? JSON.parse(row.workPendingData)
          : row.workPendingData,
        
        // Budget: convertir de string a objeto
        budget: typeof row.budgetData === 'string'
          ? JSON.parse(row.budgetData)
          : row.budgetData,
        
        // Resources: convertir de string a array
        resources: typeof row.resourcesData === 'string'
          ? JSON.parse(row.resourcesData)
          : row.resourcesData,
        
        // Risks: convertir de string a array
        risks: typeof row.risksData === 'string'
          ? JSON.parse(row.risksData)
          : row.risksData,
      };
      
      dbLogger.info(`   ✅ Proyecto parseado exitosamente: ${parsed.projectName}`);
      
      return parsed as ProjectData;
      
    } catch (error: any) {
      dbLogger.error(`❌ Error obteniendo proyecto ${projectId}:`, error.message);
      dbLogger.error(`   Stack:`, error.stack);
      throw error;
    }
  }
  
  /**
   * GUARDAR O ACTUALIZAR PROYECTO
   * 
   * FUNCIÓN: Guarda un proyecto en BD.
   * Si ya existe (mismo projectId), lo actualiza.
   * 
   * @param data - Datos del proyecto validados con Zod
   * 
   * USO: Se llama después de cargar datos desde Excel/API
   */
  async saveProject(data: ProjectData, userId: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO project_data
         (projectId, projectName, status, timelineData, velocityData, workPendingData, budgetData, resourcesData, risksData, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (projectId, user_id) DO UPDATE SET
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
          userId,
        ]
      );
    } catch (error: any) {
      dbLogger.error('❌ Error guardando proyecto:', error.message);
      throw error;
    }
  }
  
  /**
   * OBTENER TODOS LOS PROYECTOS (PAGINADO)
   * 
   * FUNCIÓN: Trae lista de proyectos con paginación.
   * Sirve para listar en UI o para auditoría.
   * 
   * @param page - Número de página (default 1)
   * @param limit - Registros por página (default 50)
   * @returns Array de proyectos en esa página
   * 
   * EJEMPLO: 
   * - page=1, limit=50 → primeros 50
   * - page=2, limit=50 → registros 51-100
   */
  async getAllProjects(userId: string, page: number = 1, limit: number = 50): Promise<ProjectData[]> {
    try {
      // Calcular offset: página 1 = 0, página 2 = 50, etc
      const offset = (page - 1) * limit;

      const result = await pool.query(
        `SELECT
          id as "id",
         projectId as "projectId",
          projectName as "projectName",
          updatedat as "updatedAt",
          status,
          timelineData as "timelineData",
          velocityData as "velocityData",
          workPendingData as "workPendingData",
          budgetData as "budgetData",
          resourcesData as "resourcesData",
          risksData as "risksData"
         FROM project_data
         WHERE user_id = $1
         ORDER BY updatedat DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      
      // Parsear cada fila (igual que getProjectForAnalysis)
      const parsed = result.rows.map(row => ({
        id: row.id,
        projectId: row.projectId,
        projectName: row.projectName,
        updatedAt: row.updatedAt,
        status: row.status,
        timeline: typeof row.timelineData === 'string' 
          ? JSON.parse(row.timelineData) 
          : row.timelineData,
        teamVelocity: typeof row.velocityData === 'string'
          ? JSON.parse(row.velocityData)
          : row.velocityData,
        workPending: typeof row.workPendingData === 'string'
          ? JSON.parse(row.workPendingData)
          : row.workPendingData,
        budget: typeof row.budgetData === 'string'
          ? JSON.parse(row.budgetData)
          : row.budgetData,
        resources: typeof row.resourcesData === 'string'
          ? JSON.parse(row.resourcesData)
          : row.resourcesData,
        risks: typeof row.risksData === 'string'
          ? JSON.parse(row.risksData)
          : row.risksData,
      }));
      
      return parsed as ProjectData[];
    } catch (error: any) {
      dbLogger.error('❌ Error obteniendo proyectos:', error.message);
      throw error;
    }
  }
  
  /**
   * ELIMINAR PROYECTO
   * 
   * FUNCIÓN: Borra un proyecto de la BD.
   * Usar con cuidado (acción irreversible).
   * 
   * @param projectId - ID del proyecto a eliminar
   */
  async deleteProject(projectId: number, userId: string): Promise<void> {
    try {
      await pool.query(
        'DELETE FROM project_data WHERE projectId = $1 AND user_id = $2',
        [projectId, userId]
      );
      dbLogger.info(`✅ Proyecto ${projectId} eliminado`);
    } catch (error: any) {
      dbLogger.error(`❌ Error eliminando proyecto ${projectId}:`, error.message);
      throw error;
    }
  }
}

// Instancia singleton del repositorio
// Se importa: import { projectRepository } from '../repositories/projectRepository'
export const projectRepository = new ProjectRepository();