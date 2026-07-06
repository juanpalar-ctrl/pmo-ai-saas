process.env.JWT_SECRET = 'test-secret-admin-routes';

import express from 'express';
import request from 'supertest';
import adminRouter from '../../routes/admin';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../middleware/adminAuthMiddleware', () => ({
  adminAuthMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', email: 'admin@b.com', role: 'admin' };
    next();
  },
}));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { pool } from '../../db';

const mockQuery = pool.query as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/admin/pending-users', () => {
  it('returns the list of pending users', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'p@b.com', created_at: '2026-01-01', status: 'pending_approval' }],
    });

    const res = await request(app).get('/api/admin/pending-users');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.users[0].email).toBe('p@b.com');
  });

  it('returns a friendly message and empty list when there are no pending users', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/admin/pending-users');

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });

  it('returns 500 when the query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/api/admin/pending-users');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/update-status', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await request(app).post('/api/admin/update-status').send({ newStatus: 'approved' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when newStatus is not approved/rejected', async () => {
    const res = await request(app).post('/api/admin/update-status').send({ userId: 1, newStatus: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/admin/update-status').send({ userId: 999, newStatus: 'approved' });
    expect(res.status).toBe(404);
  });

  it('approves a user and returns the updated row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'u@b.com', status: 'approved' }] });
    const res = await request(app).post('/api/admin/update-status').send({ userId: 1, newStatus: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('approved');
  });

  it('rejects a user and returns the updated row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'u@b.com', status: 'rejected' }] });
    const res = await request(app).post('/api/admin/update-status').send({ userId: 1, newStatus: 'rejected' });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('rejected');
  });

  it('returns 500 when the update query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/admin/update-status').send({ userId: 1, newStatus: 'approved' });
    expect(res.status).toBe(500);
  });
});
