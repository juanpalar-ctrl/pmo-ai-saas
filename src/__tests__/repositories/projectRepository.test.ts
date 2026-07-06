jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../core/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { ProjectRepository } from '../../repositories/projectRepository';
import { pool } from '../../db';

const mockQuery = pool.query as jest.Mock;

describe('ProjectRepository.getProjectForAnalysis', () => {
  let repo: ProjectRepository;

  beforeEach(() => {
    repo = new ProjectRepository();
    mockQuery.mockReset();
  });

  it('returns null when no row matches', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await repo.getProjectForAnalysis(1, 'user-1');
    expect(result).toBeNull();
  });

  it('parses JSONB string fields into objects', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        projectId: 1,
        projectName: 'P1',
        status: 'In Progress',
        timelineData: JSON.stringify({ percentageComplete: 50 }),
        velocityData: JSON.stringify([1, 2, 3]),
        workPendingData: JSON.stringify({ tasksRemaining: 5 }),
        budgetData: JSON.stringify({ totalBudget: 1000 }),
        resourcesData: JSON.stringify([{ role: 'Dev' }]),
        risksData: JSON.stringify([{ description: 'x' }]),
      }],
    });

    const result = await repo.getProjectForAnalysis(1, 'user-1');

    expect(result?.timeline).toEqual({ percentageComplete: 50 });
    expect(result?.teamVelocity).toEqual([1, 2, 3]);
    expect(result?.budget).toEqual({ totalBudget: 1000 });
  });

  it('passes through fields that are already objects (not JSON strings)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        projectId: 1,
        projectName: 'P1',
        status: 'In Progress',
        timelineData: { percentageComplete: 70 },
        velocityData: [4, 5],
        workPendingData: { tasksRemaining: 1 },
        budgetData: { totalBudget: 2000 },
        resourcesData: [],
        risksData: [],
      }],
    });

    const result = await repo.getProjectForAnalysis(1, 'user-1');
    expect(result?.timeline).toEqual({ percentageComplete: 70 });
  });

  it('scopes the query to the given projectId and userId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await repo.getProjectForAnalysis(42, 'user-9');
    expect(mockQuery.mock.calls[0][1]).toEqual([42, 'user-9']);
  });

  it('propagates errors from the query', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    await expect(repo.getProjectForAnalysis(1, 'user-1')).rejects.toThrow('db down');
  });
});

describe('ProjectRepository.saveProject', () => {
  let repo: ProjectRepository;

  beforeEach(() => {
    repo = new ProjectRepository();
    mockQuery.mockReset();
  });

  it('serializes nested fields to JSON strings and includes the userId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const data: any = {
      projectId: 1,
      projectName: 'P1',
      status: 'In Progress',
      timeline: { percentageComplete: 10 },
      teamVelocity: [1, 2],
      workPending: { tasksRemaining: 3 },
      budget: { totalBudget: 500 },
      resources: [],
      risks: [],
    };

    await repo.saveProject(data, 'user-1');

    const params = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe(1);
    expect(params[3]).toBe(JSON.stringify({ percentageComplete: 10 }));
    expect(params[9]).toBe('user-1');
  });

  it('propagates errors from the insert query', async () => {
    mockQuery.mockRejectedValueOnce(new Error('constraint violation'));
    await expect(repo.saveProject({} as any, 'user-1')).rejects.toThrow('constraint violation');
  });
});

describe('ProjectRepository.getAllProjects', () => {
  let repo: ProjectRepository;

  beforeEach(() => {
    repo = new ProjectRepository();
    mockQuery.mockReset();
  });

  it('computes the correct offset for page 1', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await repo.getAllProjects('user-1', 1, 50);
    expect(mockQuery.mock.calls[0][1]).toEqual(['user-1', 50, 0]);
  });

  it('computes the correct offset for page 2', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await repo.getAllProjects('user-1', 2, 50);
    expect(mockQuery.mock.calls[0][1]).toEqual(['user-1', 50, 50]);
  });

  it('parses JSONB fields for every row returned', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { projectId: 1, projectName: 'A', status: 'Completed', timelineData: '{}', velocityData: '[]', workPendingData: '{}', budgetData: '{}', resourcesData: '[]', risksData: '[]' },
        { projectId: 2, projectName: 'B', status: 'Completed', timelineData: '{}', velocityData: '[]', workPendingData: '{}', budgetData: '{}', resourcesData: '[]', risksData: '[]' },
      ],
    });

    const result = await repo.getAllProjects('user-1');
    expect(result).toHaveLength(2);
    expect(result[1].projectName).toBe('B');
  });
});

describe('ProjectRepository.deleteProject', () => {
  let repo: ProjectRepository;

  beforeEach(() => {
    repo = new ProjectRepository();
    mockQuery.mockReset();
  });

  it('scopes the delete to projectId and userId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await repo.deleteProject(5, 'user-1');
    expect(mockQuery.mock.calls[0][1]).toEqual([5, 'user-1']);
  });

  it('propagates errors from the delete query', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    await expect(repo.deleteProject(5, 'user-1')).rejects.toThrow('db down');
  });
});
