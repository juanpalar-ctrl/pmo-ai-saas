import express, { Request, Response } from 'express';
import { errorMessage } from '../core/errors';
import { getPortfolioData } from '../services/portfolioService';
import { AuthRequest } from '../middleware/requireAuth';
import { routeLogger } from '../core/logger';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const data = await getPortfolioData(userId);
    res.json({ success: true, ...data });
  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'GET /api/portfolio error');
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

export default router;
