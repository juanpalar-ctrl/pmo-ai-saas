import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../services/jwtService';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.redirect('/login');
  }

  try {
    const user = verifyToken(token);
    if (!user) {
      throw new Error('Token inválido');
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.clearCookie('auth_token');
    res.redirect('/login');
  }
};
