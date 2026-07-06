import express from 'express';
import request from 'supertest';
import brandingRouter from '../../routes/branding';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { pool } from '../../db';

const mockQuery = pool.query as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/branding', brandingRouter);

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/branding', () => {
  it('returns the stored branding config for the organization', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ primary_color: '#111111', secondary_color: '#222222', accent_color: '#333333', logo_url: '/l.png' }],
    });

    const res = await request(app).get('/api/branding').set('x-organization-id', 'org_1');

    expect(res.status).toBe(200);
    expect(res.body.data.primaryColor).toBe('#111111');
  });

  it('returns default branding when no row exists for the organization', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/branding');

    expect(res.status).toBe(200);
    expect(res.body.data.primaryColor).toBe('#17B8A0');
  });

  it('returns defaults without crashing when the branding table query throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('relation "branding" does not exist'));

    const res = await request(app).get('/api/branding');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.primaryColor).toBe('#17B8A0');
  });
});

describe('POST /api/branding/:organizationId', () => {
  it('returns 400 when no field is provided', async () => {
    const res = await request(app).post('/api/branding/org_1').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid hex color', async () => {
    const res = await request(app).post('/api/branding/org_1').send({ primaryColor: 'not-a-hex' });
    expect(res.status).toBe(400);
  });

  it('updates branding when the organization already has a row', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ primary_color: '#ABCDEF', secondary_color: '#0B7B8C', accent_color: '#9ED900', logo_url: '/l.png' }],
    });

    const res = await request(app).post('/api/branding/org_1').send({ primaryColor: '#ABCDEF' });

    expect(res.status).toBe(200);
    expect(res.body.data.primaryColor).toBe('#ABCDEF');
    expect(res.body.message).toMatch(/updated/);
  });

  it('inserts a new branding row when the organization has none yet', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE affects nothing
      .mockResolvedValueOnce({
        rows: [{ primary_color: '#ABCDEF', secondary_color: '#0B7B8C', accent_color: '#9ED900', logo_url: '/uploads/logos/lara-logo.png' }],
      });

    const res = await request(app).post('/api/branding/org_new').send({ primaryColor: '#ABCDEF' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/created/);
  });

  it('returns 500 when the update query throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/branding/org_1').send({ primaryColor: '#ABCDEF' });
    expect(res.status).toBe(500);
  });
});
