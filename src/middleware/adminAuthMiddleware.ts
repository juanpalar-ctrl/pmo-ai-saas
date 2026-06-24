/**
 * src/middleware/adminAuthMiddleware.ts
 * Middleware to verify admin role from JWT token.
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/jwtService";
import { ADMIN_MESSAGES } from "../config/messages";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to authenticate and verify admin role.
 * Extracts JWT from cookies and validates admin access.
 */
export function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: ADMIN_MESSAGES.UNAUTHORIZED_ADMIN });
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: ADMIN_MESSAGES.UNAUTHORIZED_ADMIN });
    return;
  }

  if (payload.role !== "admin") {
    res.status(403).json({ error: ADMIN_MESSAGES.UNAUTHORIZED_ADMIN });
    return;
  }

  // Attach user to request for downstream handlers
  req.user = {
    id: payload.id,
    email: payload.email,
    role: payload.role,
  };

  next();
}
