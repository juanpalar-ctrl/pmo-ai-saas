import express, { Request, Response } from 'express';
import { errorMessage } from '../core/errors';
import { getPortfolioData } from '../services/portfolioService';
import { detectPortfolioResourceConflicts } from '../services/resourceConflictDetector';
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

// GET /api/portfolio/resource-conflicts — Detect overbooking & cross-project dependencies
router.get('/resource-conflicts', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const report = await detectPortfolioResourceConflicts(userId);
    res.json({ success: true, data: report });
  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'GET /api/portfolio/resource-conflicts error');
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

export default router;
