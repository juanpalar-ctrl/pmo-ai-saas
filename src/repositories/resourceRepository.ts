import { pool } from '../db';
import { dbLogger } from '../core/logger';

export interface ResourceAssignment {
  id?: number;
  project_id: number;
  user_id: string;
  person_id: number;
  task_name?: string;
  start_date: string; // Date as ISO string or YYYY-MM-DD
  end_date: string;
  hours_per_week: number;
  allocation_percent?: number; // Computed: hours_per_week / 40 * 100
  created_at?: string;
  updated_at?: string;
}

export const resourceRepository = {
  /**
   * Get all assignments for a project
   */
  async getAssignmentsForProject(projectId: number, userId: string): Promise<ResourceAssignment[]> {
    try {
      const result = await pool.query(
        `SELECT id, project_id, user_id, person_id, task_name, start_date, end_date,
                hours_per_week, allocation_percent, created_at, updated_at
         FROM resource_assignments
         WHERE project_id = $1 AND user_id = $2
         ORDER BY start_date ASC`,
        [projectId, userId]
      );
      return result.rows;
    } catch (error) {
      dbLogger.error({ err: error, projectId, userId }, 'getAssignmentsForProject failed');
      throw error;
    }
  },

  /**
   * Get all assignments for a user across all projects
   */
  async getAssignmentsForUser(userId: string): Promise<ResourceAssignment[]> {
    try {
      const result = await pool.query(
        `SELECT id, project_id, user_id, person_id, task_name, start_date, end_date,
                hours_per_week, allocation_percent, created_at, updated_at
         FROM resource_assignments
         WHERE user_id = $1
         ORDER BY project_id, start_date ASC`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      dbLogger.error({ err: error, userId }, 'getAssignmentsForUser failed');
      throw error;
    }
  },

  /**
   * Get assignments for a specific person
   */
  async getAssignmentsForPerson(personId: number): Promise<ResourceAssignment[]> {
    try {
      const result = await pool.query(
        `SELECT id, project_id, user_id, person_id, task_name, start_date, end_date,
                hours_per_week, allocation_percent, created_at, updated_at
         FROM resource_assignments
         WHERE person_id = $1
         ORDER BY start_date ASC`,
        [personId]
      );
      return result.rows;
    } catch (error) {
      dbLogger.error({ err: error, personId }, 'getAssignmentsForPerson failed');
      throw error;
    }
  },

  /**
   * Get overlapping assignments for a person in date range
   */
  async getOverlappingAssignments(personId: number, startDate: string, endDate: string): Promise<ResourceAssignment[]> {
    try {
      const result = await pool.query(
        `SELECT id, project_id, user_id, person_id, task_name, start_date, end_date,
                hours_per_week, allocation_percent, created_at, updated_at
         FROM resource_assignments
         WHERE person_id = $1
           AND start_date <= $3
           AND end_date >= $2
         ORDER BY start_date ASC`,
        [personId, startDate, endDate]
      );
      return result.rows;
    } catch (error) {
      dbLogger.error({ err: error, personId, startDate, endDate }, 'getOverlappingAssignments failed');
      throw error;
    }
  },

  /**
   * Create or update a resource assignment (upsert by project_id + person_id + start_date)
   */
  async upsertAssignment(assignment: ResourceAssignment): Promise<ResourceAssignment> {
    try {
      const result = await pool.query(
        `INSERT INTO resource_assignments
         (project_id, user_id, person_id, task_name, start_date, end_date, hours_per_week, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (project_id, person_id, start_date) DO UPDATE
         SET task_name = EXCLUDED.task_name,
             end_date = EXCLUDED.end_date,
             hours_per_week = EXCLUDED.hours_per_week,
             updated_at = NOW()
         RETURNING id, project_id, user_id, person_id, task_name, start_date, end_date,
                   hours_per_week, allocation_percent, created_at, updated_at`,
        [
          assignment.project_id,
          assignment.user_id,
          assignment.person_id,
          assignment.task_name || null,
          assignment.start_date,
          assignment.end_date,
          assignment.hours_per_week
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Upsert failed: no rows returned');
      }

      return result.rows[0];
    } catch (error) {
      dbLogger.error({ err: error, assignment }, 'upsertAssignment failed');
      throw error;
    }
  },

  /**
   * Create multiple assignments in a batch
   */
  async createAssignmentsBatch(assignments: ResourceAssignment[]): Promise<ResourceAssignment[]> {
    if (assignments.length === 0) return [];

    try {
      const values = assignments.map((a, idx) => {
        const offset = idx * 7;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, NOW(), NOW())`;
      }).join(',');

      const flatParams = assignments.flatMap(a => [
        a.project_id,
        a.user_id,
        a.person_id,
        a.task_name || null,
        a.start_date,
        a.end_date,
        a.hours_per_week
      ]);

      const result = await pool.query(
        `INSERT INTO resource_assignments
         (project_id, user_id, person_id, task_name, start_date, end_date, hours_per_week, created_at, updated_at)
         VALUES ${values}
         ON CONFLICT (project_id, person_id, start_date) DO UPDATE
         SET task_name = EXCLUDED.task_name,
             end_date = EXCLUDED.end_date,
             hours_per_week = EXCLUDED.hours_per_week,
             updated_at = NOW()
         RETURNING id, project_id, user_id, person_id, task_name, start_date, end_date,
                   hours_per_week, allocation_percent, created_at, updated_at`,
        flatParams
      );

      return result.rows;
    } catch (error) {
      dbLogger.error({ err: error, count: assignments.length }, 'createAssignmentsBatch failed');
      throw error;
    }
  },

  /**
   * Update a single assignment
   */
  async updateAssignment(id: number, assignment: Partial<ResourceAssignment>): Promise<ResourceAssignment> {
    try {
      const updates: string[] = [];
      const params: any[] = [id];
      let paramIdx = 2;

      if (assignment.task_name !== undefined) {
        updates.push(`task_name = $${paramIdx++}`);
        params.push(assignment.task_name);
      }
      if (assignment.start_date !== undefined) {
        updates.push(`start_date = $${paramIdx++}`);
        params.push(assignment.start_date);
      }
      if (assignment.end_date !== undefined) {
        updates.push(`end_date = $${paramIdx++}`);
        params.push(assignment.end_date);
      }
      if (assignment.hours_per_week !== undefined) {
        updates.push(`hours_per_week = $${paramIdx++}`);
        params.push(assignment.hours_per_week);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = NOW()`);

      const result = await pool.query(
        `UPDATE resource_assignments
         SET ${updates.join(', ')}
         WHERE id = $1
         RETURNING id, project_id, user_id, person_id, task_name, start_date, end_date,
                   hours_per_week, allocation_percent, created_at, updated_at`,
        params
      );

      if (result.rows.length === 0) {
        throw new Error('Assignment not found');
      }

      return result.rows[0];
    } catch (error) {
      dbLogger.error({ err: error, id }, 'updateAssignment failed');
      throw error;
    }
  },

  /**
   * Delete a single assignment
   */
  async deleteAssignment(id: number): Promise<boolean> {
    try {
      const result = await pool.query(
        'DELETE FROM resource_assignments WHERE id = $1',
        [id]
      );
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      dbLogger.error({ err: error, id }, 'deleteAssignment failed');
      throw error;
    }
  },

  /**
   * Delete all assignments for a project
   */
  async deleteAssignmentsForProject(projectId: number, userId: string): Promise<number> {
    try {
      const result = await pool.query(
        'DELETE FROM resource_assignments WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );
      return result.rowCount || 0;
    } catch (error) {
      dbLogger.error({ err: error, projectId, userId }, 'deleteAssignmentsForProject failed');
      throw error;
    }
  }
};
