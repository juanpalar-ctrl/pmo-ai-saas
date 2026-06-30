import express, { Request, Response } from 'express';
import { getPortfolioData } from '../services/portfolioService';
import { routeLogger } from '../core/logger';

const router = express.Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await getPortfolioData();
    res.json({ success: true, ...data });
  } catch (error: any) {
    routeLogger.error({ err: error.message }, 'GET /api/portfolio error');
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
