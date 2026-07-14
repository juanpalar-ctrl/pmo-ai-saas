/**
 * src/routes/auth.ts
 * Authentication routes: signup, login, logout, me
 * Phase 2: Added role and status management for admin approval flow.
 */

import express, { Request, Response } from 'express';
import { errorMessage } from '../core/errors';
import { authLogger } from '../core/logger';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { createPasswordResetToken, resetPasswordWithToken } from '../services/passwordResetService';
import { signToken, verifyToken } from '../services/jwtService';
import { AUTH_MESSAGES } from '../config/messages';
import { z } from 'zod';

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

    // Validar formato de email (defensa del lado de entrada, además del escape de
    // salida en el panel admin). Rechaza también valores no-string (p.ej. objetos).
    if (!z.email().safeParse(email).success) {
      return res.status(400).json({ error: 'Email inválido' });
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

    // users.id has no DB default — generate it here (same "user_<timestamp>" convention as existing rows)
    const id = `user_${Date.now()}`;

    // Create user with default role='user' and status='pending_approval'
    const result = await pool.query(
      'INSERT INTO users (id, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, status',
      [id, email.toLowerCase(), hash, 'user', 'pending_approval']
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
  } catch (error) {
    authLogger.error({ err: errorMessage(error) }, 'Signup error');
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

    // Block login for accounts an admin rejected (via /api/admin/update-status).
    // Without this the login gate only excluded 'pending_approval', so a
    // rejected user could still sign in — defeating the rejection.
    if (user.status === 'rejected') {
      res.clearCookie('auth_token');
      return res.status(403).json({
        code: 'ERR_REJECTED',
        message: AUTH_MESSAGES.REJECTED,
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
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
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
  } catch (error) {
    authLogger.error({ err: errorMessage(error), code: (error as { code?: string }).code }, 'Login error');
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
  const token = req.cookies?.auth_token;
  
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


/**
 * POST /api/auth/forgot-password
 * Request a password reset token.
 * Body: { email: string }
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }

    const result = await createPasswordResetToken(email);

    // Retornar éxito sin importar si el email existe (por seguridad)
    // SEGURIDAD: el resetLink NUNCA debe volver en la respuesta en producción.
    // Sin transporte de email real, devolverlo permitía que cualquiera pidiera el
    // reset de un email ajeno, leyera el enlace de la respuesta y secuestrara la
    // cuenta (account takeover). Solo se expone fuera de producción (dev/mock).
    const isProd = process.env.NODE_ENV === 'production';
    res.json({
      success: true,
      message: 'Si la cuenta existe, recibirás un email con instrucciones de reset',
      resetLink: isProd ? null : (result?.resetLink || null),
    });
  } catch (error) {
    authLogger.error({ err: errorMessage(error) }, 'Forgot password error');
    res.status(500).json({ error: 'Error en servidor' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with valid token.
 * Body: { token: string, newPassword: string }
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token y contraseña requeridos' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' });
    }

    const success = await resetPasswordWithToken(token, newPassword);

    if (!success) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    res.json({
      success: true,
      message: 'Contraseña reseteada exitosamente. Por favor, inicia sesión.',
    });
  } catch (error) {
    authLogger.error({ err: errorMessage(error) }, 'Reset password error');
    res.status(500).json({ error: 'Error en servidor' });
  }
});


export default router;
