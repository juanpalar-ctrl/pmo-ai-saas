import express from 'express';
import request from 'supertest';
import devRouter from '../../routes/dev';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('fs', () => ({ existsSync: jest.fn() }));

import { pool } from '../../db';
import fs from 'fs';

const mockQuery = pool.query as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;

const app = express();
app.use('/api/dev', devRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockExistsSync.mockReset();
});

describe('GET /api/dev/init-database', () => {
  it('creates all three tables and returns success', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/dev/init-database');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.tables).toEqual(['users', 'project_data', 'ai_analyses']);
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('returns 500 when a CREATE TABLE statement fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('permission denied'));

    const res = await request(app).get('/api/dev/init-database');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('permission denied');
  });
});

describe('GET /api/dev/check-database', () => {
  it('returns the list of table names', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ table_name: 'users' }, { table_name: 'project_data' }] });

    const res = await request(app).get('/api/dev/check-database');

    expect(res.status).toBe(200);
    expect(res.body.tables).toEqual(['users', 'project_data']);
  });

  it('returns 500 when the query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/api/dev/check-database');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/dev/generate-dummy-excel', () => {
  it('returns 404 when the dummy file does not exist', async () => {
    mockExistsSync.mockReturnValueOnce(false);
    const res = await request(app).get('/api/dev/generate-dummy-excel');
    expect(res.status).toBe(404);
  });
});
