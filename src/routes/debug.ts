import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/latest-analysis/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await pool.query(
      `SELECT * FROM ai_analyses WHERE projectid = $1 ORDER BY generatedat DESC LIMIT 1`,
      [projectId]
    );

    if (result.rows.length === 0) {
      return res.json({ error: 'No analysis found' });
    }

    const analysis = result.rows[0];
    const output = analysis.output;

    res.json({
      projectId: analysis.projectid,
      hasReports: !!output.reports,
      reportsKeys: output.reports ? Object.keys(output.reports) : null,
      senior_report: output.reports?.senior_report?.substring(0, 200) || 'MISSING',
      technical_report: output.reports?.technical_report?.substring(0, 200) || 'MISSING',
      fullOutput: output
    });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

export default router;
