process.env.JWT_SECRET = 'test-secret-portfolio-routes';

import express from 'express';
import request from 'supertest';
import portfolioRouter from '../../routes/portfolio';
import { AuthRequest } from '../../middleware/requireAuth';

jest.mock('../../services/portfolioService', () => ({
  getPortfolioData: jest.fn(),
}));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { getPortfolioData } from '../../services/portfolioService';

const mockGetPortfolioData = getPortfolioData as jest.Mock;

const app = express();
app.use((req, _res, next) => {
  (req as AuthRequest).user = { id: 'user-1', email: 'me@b.com', role: 'analyst' };
  next();
});
app.use('/api/portfolio', portfolioRouter);

beforeEach(() => {
  mockGetPortfolioData.mockReset();
});

describe('GET /api/portfolio', () => {
  it('returns success with summary and projects for the authenticated user', async () => {
    mockGetPortfolioData.mockResolvedValueOnce({
      summary: { totalProjects: 2, portfolioHealth: 'AT_RISK' },
      projects: [{ id: 1, name: 'Proyecto A' }, { id: 2, name: 'Proyecto B' }],
    });

    const res = await request(app).get('/api/portfolio');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary.totalProjects).toBe(2);
    expect(res.body.projects).toHaveLength(2);
    expect(mockGetPortfolioData).toHaveBeenCalledWith('user-1');
  });

  it('returns an empty projects array when the user has none', async () => {
    mockGetPortfolioData.mockResolvedValueOnce({
      summary: { totalProjects: 0, portfolioHealth: 'HEALTHY' },
      projects: [],
    });

    const res = await request(app).get('/api/portfolio');

    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([]);
  });

  it('returns 500 when the service throws', async () => {
    mockGetPortfolioData.mockRejectedValueOnce(new Error('DB unavailable'));

    const res = await request(app).get('/api/portfolio');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
