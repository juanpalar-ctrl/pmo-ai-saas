jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../core/logger', () => ({
  serviceLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../agents/wellbeingAgent', () => ({
  wellbeingAgent: { analyze: jest.fn() },
}));

import { pool } from '../../db';
import { wellbeingAgent } from '../../agents/wellbeingAgent';
import { teamService } from '../../services/teamService';
import { TransformedRow } from '../../services/frameworkMetrics';

const mockQuery = pool.query as jest.Mock;
const mockAnalyze = wellbeingAgent.analyze as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
  mockAnalyze.mockReset();
});

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe('autoPopulateTeam', () => {
  it('inserts one row per distinct non-empty assignee', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const taskRows: TransformedRow[] = [
      { project_name: 'A', assignee: 'Ana Torres' },
      { project_name: 'B', assignee: 'Beto' },
      { project_name: 'C', assignee: 'Ana Torres' }, // duplicate, same casing
      { project_name: 'D', assignee: '' },
      { project_name: 'E', assignee: null },
    ];

    await teamService.autoPopulateTeam(1, 'user-1', taskRows);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (project_id, lower(name))'),
      [1, 'user-1', 'Ana Torres']
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO team_members'),
      [1, 'user-1', 'Beto']
    );
  });

  it('does not throw when a single insert fails (logs and continues)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    await expect(
      teamService.autoPopulateTeam(1, 'user-1', [{ project_name: 'A', assignee: 'Ana' }])
    ).resolves.toBeUndefined();
  });

  it('skips assignee values that are JSON blobs from a mismapped column', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const badAssignee = JSON.stringify([{ role: 'QA Engineer', count: 3, costPerMonth: 3500 }]);
    const taskRows: TransformedRow[] = [
      { project_name: 'A', assignee: badAssignee },
      { project_name: 'B', assignee: 'Ana Torres' },
    ];

    await teamService.autoPopulateTeam(1, 'user-1', taskRows);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO team_members'),
      [1, 'user-1', 'Ana Torres']
    );
  });
});

describe('getTeamBoard', () => {
  it('computes disconnection level, critical count and GSS from task rows', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Ana', role: 'Dev', last_feedback_at: daysAgo(5), latest_wellbeing_score: '0.8' },
        { id: 2, name: 'Beto', role: null, last_feedback_at: null, latest_wellbeing_score: null },
      ],
    });

    const taskRows: TransformedRow[] = [
      { project_name: 'X', assignee: 'Ana', status: 'in progress' },
    ];

    const { members, groupSatisfactionScore } = await teamService.getTeamBoard(1, taskRows);

    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ id: 1, name: 'Ana', role: 'Dev', disconnectionLevel: 'green', latestWellbeingScore: 0.8 });
    expect(members[0].currentTasks).toEqual(['X']);
    expect(members[1]).toMatchObject({ id: 2, name: 'Beto', role: null, latestWellbeingScore: null });
    // Only Ana has a score -> GSS = 0.8 * 100
    expect(groupSatisfactionScore).toBe(80);
  });

  it('returns null GSS when no member has a wellbeing score yet', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Ana', role: null, last_feedback_at: null, latest_wellbeing_score: null }],
    });
    const { groupSatisfactionScore } = await teamService.getTeamBoard(1, []);
    expect(groupSatisfactionScore).toBeNull();
  });
});

describe('addFeedbackNote', () => {
  it('analyzes the note, logs it, and refreshes the member row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Ana' }] }) // ownership lookup
      .mockResolvedValueOnce({ rows: [] }) // insert note
      .mockResolvedValueOnce({ rows: [] }); // update member
    mockAnalyze.mockResolvedValueOnce({
      analysis: { wellbeingScore: 0.7, sentiment: 'positive', reasoning: 'Motivada' },
    });

    const result = await teamService.addFeedbackNote(1, 10, 'user-1', 'Todo bien', 'es');

    expect(result).toEqual({ wellbeingScore: 0.7, sentiment: 'positive', reasoning: 'Motivada' });
    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 10, projectName: 'Ana', noteText: 'Todo bien', lang: 'es' })
    );
    expect(mockQuery).toHaveBeenNthCalledWith(2,
      expect.stringContaining('INSERT INTO team_feedback_notes'),
      [1, 'Todo bien', 0.7, 'Motivada']
    );
    expect(mockQuery).toHaveBeenNthCalledWith(3,
      expect.stringContaining('UPDATE team_members'),
      [0.7, 1]
    );
  });

  it('throws when the member does not belong to the project/user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(teamService.addFeedbackNote(1, 10, 'user-1', 'x')).rejects.toThrow('Miembro de equipo no encontrado');
    expect(mockAnalyze).not.toHaveBeenCalled();
  });
});

describe('updateMemberRole', () => {
  it('updates the role when the member belongs to the project/user', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    await expect(teamService.updateMemberRole(1, 10, 'user-1', 'QA Lead')).resolves.toBeUndefined();
  });

  it('throws when no row matched (wrong owner/project)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    await expect(teamService.updateMemberRole(1, 10, 'user-1', 'QA Lead')).rejects.toThrow('Miembro de equipo no encontrado');
  });
});

describe('getDisconnectionAlertsForRiskAgent', () => {
  it('filters out green members and reduces the shape', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Ana', role: null, last_feedback_at: daysAgo(5), latest_wellbeing_score: null },
        { id: 2, name: 'Beto', role: null, last_feedback_at: daysAgo(50), latest_wellbeing_score: null },
      ],
    });
    const criticalRows: TransformedRow[] = Array.from({ length: 4 }, (_, i) => ({
      project_name: `T${i}`,
      assignee: 'Beto',
      status: 'in progress',
      progress_percent: 0,
      risks: 'riesgo',
      end_date: daysAgo(3).toISOString(),
    }));

    const alerts = await teamService.getDisconnectionAlertsForRiskAgent(1, criticalRows);

    expect(alerts).toEqual([
      { name: 'Beto', level: 'red', daysSinceContact: 50, criticalDelayedCount: 4 },
    ]);
  });
});
