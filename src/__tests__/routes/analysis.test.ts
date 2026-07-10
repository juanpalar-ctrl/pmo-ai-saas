import express from 'express';
import request from 'supertest';
import analysisRouter from '../../routes/analysis';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../services/multiAgentOrchestrator', () => ({
  orchestrator: { analyzeProject: jest.fn() },
}));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { pool } from '../../db';
import { orchestrator } from '../../services/multiAgentOrchestrator';

const mockQuery = pool.query as jest.Mock;
const mockAnalyzeProject = orchestrator.analyzeProject as jest.Mock;

// Ownership gate query result: a non-empty row means "user owns this projectid".
const OWNS = { rows: [{ '?column?': 1 }] };
const NOT_OWNS = { rows: [] };

const app = express();
app.use(express.json());
// Simulate requireAuth (mounted before analysisRouter in production).
app.use((req, _res, next) => {
  (req as any).user = { id: 'u1', email: 'u@b.com', role: 'user' };
  next();
});
app.use('/api/analysis', analysisRouter);

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  mockQuery.mockReset();
  mockAnalyzeProject.mockReset();
  process.env = { ...ORIGINAL_ENV, USE_MOCK_DATA: 'false' };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('POST /api/analysis/:projectId', () => {
  it('returns 400 for a non-numeric projectId', async () => {
    const res = await request(app).post('/api/analysis/abc').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid framework', async () => {
    const res = await request(app).post('/api/analysis/1').send({ framework: 'not-a-framework' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the user does not own the projectid', async () => {
    mockQuery.mockResolvedValueOnce(NOT_OWNS); // ownership gate

    const res = await request(app).post('/api/analysis/1').send({ framework: 'scrum' });

    expect(res.status).toBe(404);
    expect(mockAnalyzeProject).not.toHaveBeenCalled();
  });

  it('returns mock data without calling the orchestrator when USE_MOCK_DATA=true', async () => {
    process.env.USE_MOCK_DATA = 'true';
    mockQuery.mockResolvedValueOnce(OWNS);       // ownership gate
    mockQuery.mockResolvedValueOnce({ rows: [] }); // mock insert

    const res = await request(app).post('/api/analysis/1').send({ framework: 'scrum' });

    expect(res.status).toBe(200);
    expect(res.body.usedMock).toBe(true);
    expect(mockAnalyzeProject).not.toHaveBeenCalled();
  });

  it('persists mock data as an append INSERT scoped to the owner (regression: no ON CONFLICT crash)', async () => {
    process.env.USE_MOCK_DATA = 'true';
    mockQuery.mockResolvedValueOnce(OWNS);       // ownership gate
    mockQuery.mockResolvedValueOnce({ rows: [] }); // mock insert

    await request(app).post('/api/analysis/1').send({ framework: 'scrum' });

    // ai_analyses has no unique index on projectid (append-only history), so the
    // old ON CONFLICT (projectid) upsert threw at runtime. Must be a plain INSERT
    // that carries the owner's user_id.
    const insertCall = mockQuery.mock.calls.find(
      (call) => String(call[0]).includes('INSERT INTO ai_analyses'),
    );
    expect(insertCall).toBeDefined();
    expect(String(insertCall![0])).not.toMatch(/ON CONFLICT/i);
    expect(String(insertCall![0])).toContain('user_id');
    expect(insertCall![1][0]).toBe(1);    // projectid
    expect(insertCall![1][1]).toBe('u1'); // user_id (owner)
  });

  it('returns cached analysis when a recent one exists and forceRefresh is not set', async () => {
    mockQuery.mockResolvedValueOnce(OWNS); // ownership gate
    mockQuery.mockResolvedValueOnce({ rows: [{ output: { some: 'data' }, generatedat: '2026-01-01' }] });

    const res = await request(app).post('/api/analysis/1').send({ framework: 'scrum' });

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(mockAnalyzeProject).not.toHaveBeenCalled();
  });

  it('runs a fresh analysis when there is no cache', async () => {
    mockQuery.mockResolvedValueOnce(OWNS);       // ownership gate
    mockQuery.mockResolvedValueOnce({ rows: [] }); // cache lookup
    mockAnalyzeProject.mockResolvedValueOnce({ risk: {}, economic: {} });

    const res = await request(app).post('/api/analysis/1').send({ framework: 'scrum' });

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.usedMock).toBe(false);
    expect(mockAnalyzeProject).toHaveBeenCalledWith(1, 'scrum', 'u1', undefined, 'es');
  });

  it('forces a fresh analysis even when a cache entry exists, when forceRefresh=true', async () => {
    mockQuery.mockResolvedValueOnce(OWNS); // ownership gate
    mockQuery.mockResolvedValueOnce({ rows: [{ output: { stale: true }, generatedat: '2026-01-01' }] });
    mockAnalyzeProject.mockResolvedValueOnce({ fresh: true });

    const res = await request(app).post('/api/analysis/1').send({ framework: 'scrum', forceRefresh: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ fresh: true });
    expect(mockAnalyzeProject).toHaveBeenCalled();
  });

  it('returns 500 when the orchestrator throws', async () => {
    mockQuery.mockResolvedValueOnce(OWNS);       // ownership gate
    mockQuery.mockResolvedValueOnce({ rows: [] }); // cache lookup
    mockAnalyzeProject.mockRejectedValueOnce(new Error('AI service down'));

    const res = await request(app).post('/api/analysis/1').send({ framework: 'scrum' });

    expect(res.status).toBe(500);
  });
});

describe('GET /api/analysis/:projectId/latest', () => {
  it('returns 400 for a non-numeric projectId', async () => {
    const res = await request(app).get('/api/analysis/abc/latest');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the user does not own the projectid', async () => {
    mockQuery.mockResolvedValueOnce(NOT_OWNS); // ownership gate
    const res = await request(app).get('/api/analysis/1/latest');
    expect(res.status).toBe(404);
  });

  it('returns success:false when there is no analysis yet', async () => {
    mockQuery.mockResolvedValueOnce(OWNS);       // ownership gate
    mockQuery.mockResolvedValueOnce({ rows: [] }); // analysis lookup
    const res = await request(app).get('/api/analysis/1/latest');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
  });

  it('returns the latest stored analysis', async () => {
    mockQuery.mockResolvedValueOnce(OWNS); // ownership gate
    mockQuery.mockResolvedValueOnce({ rows: [{ output: { foo: 'bar' }, generatedat: '2026-01-01' }] });
    const res = await request(app).get('/api/analysis/1/latest');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ foo: 'bar' });
  });
});

describe('GET /api/analysis/:projectId/view', () => {
  it('returns 400 for a non-numeric projectId', async () => {
    const res = await request(app).get('/api/analysis/abc/view');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the user does not own the projectid', async () => {
    mockQuery.mockResolvedValueOnce(NOT_OWNS); // ownership gate
    const res = await request(app).get('/api/analysis/1/view');
    expect(res.status).toBe(404);
  });

  it('renders a fallback page when there is no analysis', async () => {
    mockQuery.mockResolvedValueOnce(OWNS);       // ownership gate
    mockQuery.mockResolvedValueOnce({ rows: [] }); // analysis lookup
    const res = await request(app).get('/api/analysis/1/view');
    expect(res.status).toBe(200);
    expect(res.text).toContain('No hay análisis');
  });

  it('escapes HTML in the org query param to prevent XSS', async () => {
    mockQuery.mockResolvedValueOnce(OWNS); // ownership gate
    mockQuery.mockResolvedValueOnce({
      rows: [{ output: { risk: {}, economic: {}, reports: {} }, generatedat: '2026-01-01' }],
    });

    const res = await request(app).get('/api/analysis/1/view').query({ org: '<script>alert(1)</script>' });

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;');
  });
});
