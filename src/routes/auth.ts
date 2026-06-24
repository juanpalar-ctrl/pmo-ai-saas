/**
 * src/routes/auth.ts
 * Authentication routes: signup, login, logout, me
 * Phase 2: Added role and status management for admin approval flow.
 */

import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { signToken, verifyToken } from '../services/jwtService';
import { AUTH_MESSAGES } from '../config/messages';

const router = express.Router();

/**
 * POST /api/auth/signup
 * Register a new user with default 'user' role and 'pending_approval' status.
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' });
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: AUTH_MESSAGES.EMAIL_ALREADY_EXISTS });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);
    
    // Create user with default role='user' and status='pending_approval'
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id, email, role, status',
      [email.toLowerCase(), hash, 'user', 'pending_approval']
    );

    const user = result.rows[0];

    res.status(201).json({
      success: true,
      message: AUTH_MESSAGES.REGISTRATION_SUCCESS,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token with role claim.
 * Blocks login if user status is 'pending_approval'.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Query user with role and status
    const result = await pool.query(
      'SELECT id, email, password_hash, role, status FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: AUTH_MESSAGES.INVALID_CREDENTIALS });
    }

    const user = result.rows[0];

    // CRITICAL: Block login if user is pending approval
    if (user.status === 'pending_approval') {
      res.clearCookie('auth_token');
      return res.status(403).json({
        code: 'ERR_PENDING_APPROVAL',
        message: AUTH_MESSAGES.PENDING_APPROVAL,
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: AUTH_MESSAGES.INVALID_CREDENTIALS });
    }

    // Generate JWT with role claim using jwtService
    const token = signToken(user.id, user.email, user.role);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    res.json({
      success: true,
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

/**
 * POST /api/auth/logout
 * Clear authentication token and end session.
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Logout exitoso' });
});

/**
 * GET /api/auth/me
 * Verify session and return current user with role.
 */
router.get('/me', (req: Request, res: Response) => {
  const token = (req as any).cookies?.auth_token;
  
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const user = verifyToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;
