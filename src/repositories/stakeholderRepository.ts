import { pool } from '../db';
import { dbLogger } from '../core/logger';

export interface Stakeholder {
  id?: number;
  projectid: number;
  nombre: string;
  email: string;
  rol: string;
  raci: 'R' | 'A' | 'C' | 'I';
  createdat?: Date;
  updatedat?: Date;
}

export class StakeholderRepository {
  async getStakeholders(projectid: number): Promise<Stakeholder[]> {
    try {
      const result = await pool.query(
        'SELECT id, projectid, nombre, email, rol, raci, createdat, updatedat FROM stakeholders WHERE projectid = $1 ORDER BY createdat DESC',
        [projectid]
      );
      return result.rows;
    } catch (error: any) {
      dbLogger.error(`Error fetching stakeholders for project ${projectid}:`, error?.message);
      throw error;
    }
  }

  async getStakeholder(id: number, projectid: number): Promise<Stakeholder | null> {
    try {
      const result = await pool.query(
        'SELECT id, projectid, nombre, email, rol, raci, createdat, updatedat FROM stakeholders WHERE id = $1 AND projectid = $2',
        [id, projectid]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      dbLogger.error(`Error fetching stakeholder ${id}:`, error?.message);
      throw error;
    }
  }

  async createStakeholder(stakeholder: Stakeholder): Promise<Stakeholder> {
    try {
      const result = await pool.query(
        'INSERT INTO stakeholders (projectid, nombre, email, rol, raci) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [stakeholder.projectid, stakeholder.nombre, stakeholder.email, stakeholder.rol, stakeholder.raci]
      );
      return result.rows[0];
    } catch (error: any) {
      dbLogger.error('Error creating stakeholder:', error?.message);
      throw error;
    }
  }

  async updateStakeholder(id: number, projectid: number, stakeholder: Partial<Stakeholder>): Promise<Stakeholder | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (stakeholder.nombre !== undefined) {
        fields.push(`nombre = $${paramCount++}`);
        values.push(stakeholder.nombre);
      }
      if (stakeholder.email !== undefined) {
        fields.push(`email = $${paramCount++}`);
        values.push(stakeholder.email);
      }
      if (stakeholder.rol !== undefined) {
        fields.push(`rol = $${paramCount++}`);
        values.push(stakeholder.rol);
      }
      if (stakeholder.raci !== undefined) {
        fields.push(`raci = $${paramCount++}`);
        values.push(stakeholder.raci);
      }

      fields.push(`updatedat = NOW()`);
      values.push(id, projectid);

      const result = await pool.query(
        `UPDATE stakeholders SET ${fields.join(', ')} WHERE id = $${paramCount} AND projectid = $${paramCount + 1} RETURNING *`,
        values
      );
      return result.rows[0] || null;
    } catch (error: any) {
      dbLogger.error(`Error updating stakeholder ${id}:`, error?.message);
      throw error;
    }
  }

  async deleteStakeholder(id: number, projectid: number): Promise<boolean> {
    try {
      const result = await pool.query('DELETE FROM stakeholders WHERE id = $1 AND projectid = $2', [id, projectid]);
      return result.rowCount! > 0;
    } catch (error: any) {
      dbLogger.error(`Error deleting stakeholder ${id}:`, error?.message);
      throw error;
    }
  }
}

export const stakeholderRepository = new StakeholderRepository();
