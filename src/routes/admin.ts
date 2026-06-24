/**
 * src/routes/admin.ts
 * Admin endpoints for user approval management.
 * All routes are protected by adminAuthMiddleware.
 */

import { Router, Request, Response } from "express";
import { pool } from "../db";
import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware";
import { ADMIN_MESSAGES } from "../config/messages";

const router = Router();

/**
 * Apply admin middleware to all routes in this file
 */
router.use(adminAuthMiddleware);

/**
 * GET /api/admin/pending-users
 * Retrieve all users with 'pending_approval' status.
 * Protected by adminAuthMiddleware.
 */
router.get("/pending-users", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      "SELECT id, email, created_at, status FROM users WHERE status = 'pending_approval' ORDER BY created_at ASC"
    );

    if (result.rows.length === 0) {
      res.status(200).json({
        message: ADMIN_MESSAGES.NO_PENDING_USERS,
        users: [],
      });
      return;
    }

    res.status(200).json({
      users: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Fetch pending users error:", error);
    res.status(500).json({
      error: "Internal server error fetching pending users.",
    });
  }
});

/**
 * POST /api/admin/update-status
 * Approve or reject a pending user by ID.
 * Body: { userId: number, newStatus: 'approved' | 'rejected' }
 * Protected by adminAuthMiddleware.
 */
router.post("/update-status", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, newStatus } = req.body;

    // Validate input
    if (!userId || !newStatus) {
      res.status(400).json({
        error: "userId and newStatus are required.",
      });
      return;
    }

    if (!["approved", "rejected"].includes(newStatus)) {
      res.status(400).json({
        error: "newStatus must be 'approved' or 'rejected'.",
      });
      return;
    }

    // Update user status
    const result = await pool.query(
      "UPDATE users SET status = $1 WHERE id = $2 RETURNING id, email, status",
      [newStatus, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: "User not found.",
      });
      return;
    }

    const message =
      newStatus === "approved"
        ? ADMIN_MESSAGES.USER_APPROVED
        : ADMIN_MESSAGES.USER_REJECTED;

    res.status(200).json({
      message,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({
      error: "Internal server error updating user status.",
    });
  }
});

export default router;
