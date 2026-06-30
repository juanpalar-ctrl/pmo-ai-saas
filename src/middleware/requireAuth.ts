import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwtService';
import { authLogger } from '../core/logger';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const token = authReq.cookies?.auth_token;

  if (!token) {
    return res.redirect('/login');
  }

  try {
    const user = verifyToken(token);
    if (!user) {
      throw new Error('Token inválido');
    }
    authReq.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (error: any) {
    authLogger.warn({ err: error.message, path: req.path }, 'Auth token inválido');
    res.clearCookie('auth_token');
    res.redirect('/login');
  }
};
