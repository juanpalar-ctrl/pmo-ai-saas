import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

export interface AuthRequest extends Request {
  user?: { id: number; email: string };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.redirect('/login');
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: user.id, email: user.email };
    next();
  } catch {
    res.clearCookie('auth_token');
    res.redirect('/login');
  }
};
