jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { pool } from '../../db';
import { syncRisksFromAgent } from '../../services/riskSyncService';

const mockQuery = pool.query as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
});

describe('syncRisksFromAgent', () => {
  it('does nothing when topRisks is empty or undefined', async () => {
    await syncRisksFromAgent(1, undefined);
    await syncRisksFromAgent(1, []);

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('seeds risks and raid_log when the project has no ai_agent rows yet', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // existence check: none yet
      .mockResolvedValueOnce({ rows: [] }) // insert risk
      .mockResolvedValueOnce({ rows: [] }); // insert raid item

    await syncRisksFromAgent(1, [
      { title: 'Scope creep', description: 'Cambios frecuentes de alcance', probability: 0.65, impact: 'HIGH' },
    ]);

    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO risks'),
      [1, 'Scope creep: Cambios frecuentes de alcance', 65, 'high']
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO raid_log'),
      [1, 'Scope creep: Cambios frecuentes de alcance', 'high']
    );
  });

  it('skips entirely once the project already has an ai_agent-sourced risk (no re-sync on re-analysis)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // existence check: already seeded

    await syncRisksFromAgent(1, [
      { title: 'New risk from a re-run', description: 'Different wording than before', probability: 0.5, impact: 'MEDIUM' },
    ]);

    expect(mockQuery).toHaveBeenCalledTimes(1); // only the existence check, no inserts
  });

  it('does not throw if a query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    await expect(
      syncRisksFromAgent(1, [{ title: 'X', description: 'Y', probability: 0.4, impact: 'MEDIUM' }])
    ).resolves.toBeUndefined();
  });
});
