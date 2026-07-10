process.env.JWT_SECRET = 'test-secret-data-routes';

import express from 'express';
import request from 'supertest';
import dataRouter from '../../routes/data';
import { AuthRequest } from '../../middleware/requireAuth';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../repositories/projectRepository', () => ({
  projectRepository: {
    getAllProjects: jest.fn(),
    getProjectForAnalysis: jest.fn(),
  },
}));
jest.mock('../../services/dataIngestService', () => ({
  dataIngestService: { ingestFromAdapterWithDetails: jest.fn() },
}));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { pool } from '../../db';
import { projectRepository } from '../../repositories/projectRepository';

const mockQuery = pool.query as jest.Mock;
const mockGetAllProjects = projectRepository.getAllProjects as jest.Mock;
const mockGetProjectForAnalysis = projectRepository.getProjectForAnalysis as jest.Mock;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as AuthRequest).user = { id: 'user-1', email: 'me@b.com', role: 'analyst' };
  next();
});
app.use('/api/data', dataRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockGetAllProjects.mockReset();
  mockGetProjectForAnalysis.mockReset();
});

// ─── GET /projects ───────────────────────────────────────────────────────────

describe('GET /api/data/projects', () => {
  it('returns paginated projects for the authenticated user', async () => {
    mockGetAllProjects.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    const res = await request(app).get('/api/data/projects?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(mockGetAllProjects).toHaveBeenCalledWith('user-1', 2, 10);
  });

  it('defaults page/limit when not provided', async () => {
    mockGetAllProjects.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/data/projects');
    expect(res.status).toBe(200);
    expect(mockGetAllProjects).toHaveBeenCalledWith('user-1', 1, 50);
  });

  it('returns 500 when the repository throws', async () => {
    mockGetAllProjects.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/api/data/projects');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /projects/:projectId ────────────────────────────────────────────────

describe('GET /api/data/projects/:projectId', () => {
  it('returns 400 for a non-numeric projectId', async () => {
    const res = await request(app).get('/api/data/projects/abc');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the project does not exist', async () => {
    mockGetProjectForAnalysis.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/data/projects/42');
    expect(res.status).toBe(404);
  });

  it('returns 200 with the project data', async () => {
    mockGetProjectForAnalysis.mockResolvedValueOnce({ projectId: 42, projectName: 'X' });
    const res = await request(app).get('/api/data/projects/42');
    expect(res.status).toBe(200);
    expect(res.body.data.projectName).toBe('X');
  });
});

// ─── DELETE /projects/:id ─────────────────────────────────────────────────────

describe('DELETE /api/data/projects/:id', () => {
  it('returns 400 for a non-integer id', async () => {
    const res = await request(app).delete('/api/data/projects/not-a-number');
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns 400 for a zero/negative id', async () => {
    const res = await request(app).delete('/api/data/projects/0');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the project does not belong to the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/data/projects/7');
    expect(res.status).toBe(404);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('deletes analyses then the project row, scoped to the owning user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ projectid: 99 }] }) // ownership lookup
      .mockResolvedValueOnce({ rows: [] }) // delete ai_analyses
      .mockResolvedValueOnce({ rows: [] }); // delete project_data

    const res = await request(app).delete('/api/data/projects/7');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockQuery).toHaveBeenNthCalledWith(1,
      expect.stringContaining('SELECT projectid FROM project_data'), [7, 'user-1']);
    expect(mockQuery).toHaveBeenNthCalledWith(2,
      expect.stringContaining('DELETE FROM ai_analyses'), [99, 'user-1']);
    expect(mockQuery).toHaveBeenNthCalledWith(3,
      expect.stringContaining('DELETE FROM project_data'), [7]);
  });

  it('returns 500 when the delete query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).delete('/api/data/projects/7');
    expect(res.status).toBe(500);
  });
});

// ─── GET /projects/history/latest ────────────────────────────────────────────

describe('GET /api/data/projects/history/latest', () => {
  it('maps rows into the shape the history sidebar expects', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 1,
        projectname: 'Proyecto A',
        budgetdata: { totalBudget: 5000 },
        filename: 'a.xlsx',
        output: { org: 'Acme', metrics: { framework: 'scrum' }, timestamp: '2026-01-01T00:00:00.000Z' },
      }],
    });

    const res = await request(app).get('/api/data/projects/history/latest');

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({
      projectId: 1,
      projectName: 'Proyecto A',
      org: 'Acme',
      framework: 'scrum',
      timestamp: '2026-01-01T00:00:00.000Z',
      totalBudget: 5000,
      filename: 'a.xlsx',
    });
  });

  it('falls back to computed budget when budgetdata is missing', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 2,
        projectname: 'Proyecto B',
        budgetdata: null,
        filename: null,
        output: { metrics: { bac: '1234' } },
      }],
    });

    const res = await request(app).get('/api/data/projects/history/latest');

    expect(res.status).toBe(200);
    expect(res.body.data[0].totalBudget).toBe(1234);
    expect(res.body.data[0].org).toBe('Sin especificar');
    expect(res.body.data[0].framework).toBe('unknown');
  });
});

// ─── GET /analysis/:projectId/latest ─────────────────────────────────────────

describe('GET /api/data/analysis/:projectId/latest', () => {
  it('returns 404 when the project is not owned by the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/data/analysis/1/latest');
    expect(res.status).toBe(404);
  });

  it('returns 404 when there is no analysis yet', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ projectid: 5 }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/data/analysis/1/latest');
    expect(res.status).toBe(404);
  });

  it('returns the stored output plus a server-computed healthScore/healthLabel', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ projectid: 5 }] })
      .mockResolvedValueOnce({
        rows: [{
          output: {
            metrics: { cpi: '1.1', spi: '1.0' },
            earlyWarnings: { criticalCount: 0, highCount: 1 },
            dis: { score: 80 },
          },
        }],
      });

    const res = await request(app).get('/api/data/analysis/1/latest');

    expect(res.status).toBe(200);
    expect(res.body.data.dis.score).toBe(80);
    expect(res.body.data.earlyWarnings.highCount).toBe(1);
    expect(typeof res.body.data.healthScore).toBe('number');
    expect(['HEALTHY', 'AT_RISK', 'CRITICAL']).toContain(res.body.data.healthLabel);
  });
});

// ─── GET /analysis/:projectId/tasks ──────────────────────────────────────────

describe('GET /api/data/analysis/:projectId/tasks', () => {
  it('returns 400 for a non-numeric projectId', async () => {
    const res = await request(app).get('/api/data/analysis/abc/tasks');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the project is not owned by the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/data/analysis/1/tasks');
    expect(res.status).toBe(404);
  });

  it('maps normalization output rows into Gantt task shape', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ projectid: 5 }] })
      .mockResolvedValueOnce({
        rows: [{
          output: {
            projects: [{
              project_name: 'Fase 1',
              estimated_cost: '1000',
              actual_cost: '900',
              progress_percent: '50',
              status: 'on_track',
              start_date: '2026-01-01',
              end_date: '2026-02-01',
            }],
          },
        }],
      });

    const res = await request(app).get('/api/data/analysis/1/tasks');

    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([{
      name: 'Fase 1',
      plan: 1000,
      actual: 900,
      progress: 50,
      status: 'on_track',
      start: '2026-01-01',
      end: '2026-02-01',
    }]);
  });

  it('returns an empty task list when there is no normalization output', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ projectid: 5 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/data/analysis/1/tasks');

    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
  });
});
