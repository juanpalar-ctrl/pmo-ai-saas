import { pool } from '../db';
import { dbLogger } from '../core/logger';

export interface Risk {
  id?: number;
  projectid: number;
  description: string;
  probability: number;
  impact: 'low' | 'medium' | 'high';
  response: string;
  status?: 'open' | 'in-progress' | 'resolved';
  createdat?: Date;
  updatedat?: Date;
}

export interface RAIDItem {
  id?: number;
  projectid: number;
  type: 'risk' | 'assumption' | 'issue' | 'dependency';
  description: string;
  owner?: string;
  status?: 'open' | 'in-progress' | 'resolved';
  impact?: 'low' | 'medium' | 'high';
  createdat?: Date;
  updatedat?: Date;
}

export class RiskRepository {
  /**
   * RISK REGISTER CRUD
   */

  async getRisks(projectid: number): Promise<Risk[]> {
    try {
      const result = await pool.query(
        'SELECT id, projectid, description, probability, impact, response, status, createdat, updatedat FROM risks WHERE projectid = $1 ORDER BY createdat DESC',
        [projectid]
      );
      return result.rows;
    } catch (error) {
      dbLogger.error(`Error fetching risks for project ${projectid}:`, error);
      throw error;
    }
  }

  async getRisk(id: number, projectid: number): Promise<Risk | null> {
    try {
      const result = await pool.query(
        'SELECT id, projectid, description, probability, impact, response, status, createdat, updatedat FROM risks WHERE id = $1 AND projectid = $2',
        [id, projectid]
      );
      return result.rows[0] || null;
    } catch (error) {
      dbLogger.error(`Error fetching risk ${id}:`, error);
      throw error;
    }
  }

  async createRisk(risk: Risk): Promise<Risk> {
    try {
      const result = await pool.query(
        'INSERT INTO risks (projectid, description, probability, impact, response, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [risk.projectid, risk.description, risk.probability, risk.impact, risk.response, risk.status || 'open']
      );
      return result.rows[0];
    } catch (error) {
      dbLogger.error('Error creating risk:', error);
      throw error;
    }
  }

  async updateRisk(id: number, projectid: number, risk: Partial<Risk>): Promise<Risk | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (risk.description !== undefined) {
        fields.push(`description = $${paramCount++}`);
        values.push(risk.description);
      }
      if (risk.probability !== undefined) {
        fields.push(`probability = $${paramCount++}`);
        values.push(risk.probability);
      }
      if (risk.impact !== undefined) {
        fields.push(`impact = $${paramCount++}`);
        values.push(risk.impact);
      }
      if (risk.response !== undefined) {
        fields.push(`response = $${paramCount++}`);
        values.push(risk.response);
      }
      if (risk.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(risk.status);
      }

      fields.push(`updatedat = NOW()`);
      values.push(id, projectid);

      const result = await pool.query(
        `UPDATE risks SET ${fields.join(', ')} WHERE id = $${paramCount} AND projectid = $${paramCount + 1} RETURNING *`,
        values
      );
      return result.rows[0] || null;
    } catch (error) {
      dbLogger.error(`Error updating risk ${id}:`, error);
      throw error;
    }
  }

  async deleteRisk(id: number, projectid: number): Promise<boolean> {
    try {
      const result = await pool.query('DELETE FROM risks WHERE id = $1 AND projectid = $2', [id, projectid]);
      return result.rowCount! > 0;
    } catch (error) {
      dbLogger.error(`Error deleting risk ${id}:`, error);
      throw error;
    }
  }

  /**
   * RAID LOG CRUD
   */

  async getRAIDLog(projectid: number): Promise<RAIDItem[]> {
    try {
      const result = await pool.query(
        'SELECT id, projectid, type, description, owner, status, impact, createdat, updatedat FROM raid_log WHERE projectid = $1 ORDER BY createdat DESC',
        [projectid]
      );
      return result.rows;
    } catch (error) {
      dbLogger.error(`Error fetching RAID log for project ${projectid}:`, error);
      throw error;
    }
  }

  async getRAIDItem(id: number, projectid: number): Promise<RAIDItem | null> {
    try {
      const result = await pool.query(
        'SELECT id, projectid, type, description, owner, status, impact, createdat, updatedat FROM raid_log WHERE id = $1 AND projectid = $2',
        [id, projectid]
      );
      return result.rows[0] || null;
    } catch (error) {
      dbLogger.error(`Error fetching RAID item ${id}:`, error);
      throw error;
    }
  }

  async createRAIDItem(item: RAIDItem): Promise<RAIDItem> {
    try {
      const result = await pool.query(
        'INSERT INTO raid_log (projectid, type, description, owner, status, impact) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [item.projectid, item.type, item.description, item.owner || null, item.status || 'open', item.impact || null]
      );
      return result.rows[0];
    } catch (error) {
      dbLogger.error('Error creating RAID item:', error);
      throw error;
    }
  }

  async updateRAIDItem(id: number, projectid: number, item: Partial<RAIDItem>): Promise<RAIDItem | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (item.type !== undefined) {
        fields.push(`type = $${paramCount++}`);
        values.push(item.type);
      }
      if (item.description !== undefined) {
        fields.push(`description = $${paramCount++}`);
        values.push(item.description);
      }
      if (item.owner !== undefined) {
        fields.push(`owner = $${paramCount++}`);
        values.push(item.owner || null);
      }
      if (item.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(item.status);
      }
      if (item.impact !== undefined) {
        fields.push(`impact = $${paramCount++}`);
        values.push(item.impact || null);
      }

      fields.push(`updatedat = NOW()`);
      values.push(id, projectid);

      const result = await pool.query(
        `UPDATE raid_log SET ${fields.join(', ')} WHERE id = $${paramCount} AND projectid = $${paramCount + 1} RETURNING *`,
        values
      );
      return result.rows[0] || null;
    } catch (error) {
      dbLogger.error(`Error updating RAID item ${id}:`, error);
      throw error;
    }
  }

  async deleteRAIDItem(id: number, projectid: number): Promise<boolean> {
    try {
      const result = await pool.query('DELETE FROM raid_log WHERE id = $1 AND projectid = $2', [id, projectid]);
      return result.rowCount! > 0;
    } catch (error) {
      dbLogger.error(`Error deleting RAID item ${id}:`, error);
      throw error;
    }
  }
}

export const riskRepository = new RiskRepository();
