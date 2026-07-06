import express from 'express';
import request from 'supertest';
import debugRouter from '../../routes/debug';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../db';

const mockQuery = pool.query as jest.Mock;

const app = express();
app.use('/api/debug', debugRouter);

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/debug/latest-analysis/:projectId', () => {
  it('returns an error payload when there is no analysis', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/debug/latest-analysis/1');
    expect(res.status).toBe(200);
    expect(res.body.error).toBe('No analysis found');
  });

  it('flags missing reports without crashing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ projectid: 1, output: {} }] });
    const res = await request(app).get('/api/debug/latest-analysis/1');
    expect(res.status).toBe(200);
    expect(res.body.hasReports).toBe(false);
    expect(res.body.senior_report).toBe('MISSING');
  });

  it('truncates report previews to 200 chars', async () => {
    const longText = 'x'.repeat(500);
    mockQuery.mockResolvedValueOnce({
      rows: [{ projectid: 1, output: { reports: { senior_report: longText, technical_report: 'short' } } }],
    });

    const res = await request(app).get('/api/debug/latest-analysis/1');

    expect(res.body.senior_report).toHaveLength(200);
    expect(res.body.technical_report).toBe('short');
  });

  it('returns 500 when the query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/api/debug/latest-analysis/1');
    expect(res.status).toBe(500);
  });
});
