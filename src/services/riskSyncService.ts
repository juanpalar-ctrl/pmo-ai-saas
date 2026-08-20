import { pool } from '../db';
import { routeLogger } from '../core/logger';

interface AgentRisk {
  title?: string;
  description?: string;
  probability?: number; // 0.0-1.0
  impact?: string; // LOW/MEDIUM/HIGH
}

const normalize = (text: string): string => text.trim().toLowerCase();

const toDescription = (risk: AgentRisk): string => {
  if (risk.title && risk.description) return `${risk.title}: ${risk.description}`;
  return risk.title || risk.description || '';
};

/**
 * Inserts Risk Agent output into the operational risks/raid_log tables so the
 * Risk Register and RAID Log UI ("identificados automáticamente por LARA")
 * actually reflect what the agent found — previously only ai_analyses (the
 * append-only analysis history) got written, so both tables stayed empty.
 *
 * Seeds once per project: only runs when no 'ai_agent' row exists yet for
 * this project. Re-analysis is non-deterministic LLM output — the same risk
 * comes back with slightly different wording each time (confirmed live:
 * "sin SOW oficial" vs "sin SOW disponible" across two runs of the same
 * project) — so matching by description text on every re-analysis would
 * accumulate near-duplicate rows indefinitely instead of deduping. Seeding
 * once keeps the register bounded and never touches rows the user has
 * since edited, added, or deleted.
 */
export async function syncRisksFromAgent(projectId: number, topRisks: AgentRisk[] | undefined): Promise<void> {
  if (!topRisks || topRisks.length === 0) return;

  try {
    const existing = await pool.query(
      `SELECT 1 FROM risks WHERE projectid = $1 AND source = 'ai_agent' LIMIT 1`,
      [projectId]
    );
    if (existing.rows.length > 0) return;

    for (const agentRisk of topRisks) {
      const description = toDescription(agentRisk);
      if (!description) continue;

      const probability = Math.round(Math.max(0, Math.min(1, agentRisk.probability ?? 0)) * 100);
      const impact = (agentRisk.impact || 'MEDIUM').toLowerCase();

      await pool.query(
        `INSERT INTO risks (projectid, description, probability, impact, response, status, source)
         VALUES ($1, $2, $3, $4, NULL, 'open', 'ai_agent')`,
        [projectId, description, probability, impact]
      );
      await pool.query(
        `INSERT INTO raid_log (projectid, type, description, owner, status, impact, source)
         VALUES ($1, 'risk', $2, NULL, 'open', $3, 'ai_agent')`,
        [projectId, description, impact]
      );
    }
  } catch (err: any) {
    routeLogger.error({ err: err?.message, projectId }, 'Failed to sync Risk Agent output into risks/raid_log');
  }
}
