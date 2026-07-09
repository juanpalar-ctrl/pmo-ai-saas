process.env.JWT_SECRET = 'test-secret-auth-routes';

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRouter from '../../routes/auth';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('bcryptjs', () => ({
  hash:    jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));
jest.mock('../../core/logger', () => ({
  authLogger:    { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  serviceLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../services/passwordResetService', () => ({
  createPasswordResetToken: jest.fn(),
  resetPasswordWithToken:   jest.fn(),
}));
jest.mock('../../config/messages', () => ({
  AUTH_MESSAGES: {
    EMAIL_ALREADY_EXISTS: 'Email ya registrado',
    REGISTRATION_SUCCESS: 'Registro exitoso. Pendiente de aprobación.',
    INVALID_CREDENTIALS:  'Credenciales inválidas',
    PENDING_APPROVAL:     'Cuenta pendiente de aprobación',
    REJECTED:             'Cuenta rechazada',
    LOGIN_SUCCESS:        'Login exitoso',
  },
}));

import { pool } from '../../db';
import bcrypt from 'bcryptjs';
import { createPasswordResetToken, resetPasswordWithToken } from '../../services/passwordResetService';

const mockQuery         = pool.query   as jest.Mock;
const mockCompare       = bcrypt.compare as jest.Mock;
const mockCreateReset   = createPasswordResetToken as jest.Mock;
const mockResetWithToken = resetPasswordWithToken as jest.Mock;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockCompare.mockReset();
  mockCreateReset.mockReset();
  mockResetWithToken.mockReset();
});

// ─── POST /signup ────────────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/signup').send({ password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is shorter than 8 chars', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'a@b.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email already exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app).post('/api/auth/signup').send({ email: 'dup@b.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('returns 201 and success on valid new user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'new@b.com', role: 'user', status: 'pending_approval' }] });
    const res = await request(app).post('/api/auth/signup').send({ email: 'new@b.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('new@b.com');
    expect(res.body.user.status).toBe('pending_approval');
  });

  it('normalises email to lowercase', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 2, email: 'upper@b.com', role: 'user', status: 'pending_approval' }] });
    await request(app).post('/api/auth/signup').send({ email: 'UPPER@B.COM', password: 'password123' });
    expect(mockQuery.mock.calls[0][1][0]).toBe('upper@b.com');
  });
});

// ─── POST /login ─────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 400 when credentials are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'pass1234' });
    expect(res.status).toBe(401);
  });

  it('returns 403 with ERR_PENDING_APPROVAL when account is not approved', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'p@b.com', password_hash: 'h', role: 'user', status: 'pending_approval' }] });
    const res = await request(app).post('/api/auth/login').send({ email: 'p@b.com', password: 'pass1234' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ERR_PENDING_APPROVAL');
  });

  it('returns 401 when password is wrong', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'u@b.com', password_hash: 'h', role: 'user', status: 'active' }] });
    mockCompare.mockResolvedValueOnce(false);
    const res = await request(app).post('/api/auth/login').send({ email: 'u@b.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and sets auth_token cookie on valid login', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, email: 'ok@b.com', password_hash: 'h', role: 'user', status: 'active' }] });
    mockCompare.mockResolvedValueOnce(true);
    const res = await request(app).post('/api/auth/login').send({ email: 'ok@b.com', password: 'validpass' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/auth_token/);
  });

  it('cookie is HttpOnly', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, email: 'ok@b.com', password_hash: 'h', role: 'admin', status: 'active' }] });
    mockCompare.mockResolvedValueOnce(true);
    const res = await request(app).post('/api/auth/login').send({ email: 'ok@b.com', password: 'validpass' });
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  it('lets an admin-approved user (status "approved") log in', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 7, email: 'ok@b.com', password_hash: 'h', role: 'user', status: 'approved' }] });
    mockCompare.mockResolvedValueOnce(true);
    const res = await request(app).post('/api/auth/login').send({ email: 'ok@b.com', password: 'validpass' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 with ERR_REJECTED when the account was rejected by an admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 8, email: 'r@b.com', password_hash: 'h', role: 'user', status: 'rejected' }] });
    const res = await request(app).post('/api/auth/login').send({ email: 'r@b.com', password: 'validpass' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ERR_REJECTED');
    // Password must never be checked for a rejected account
    expect(mockCompare).not.toHaveBeenCalled();
  });
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/auth_token=;/);
  });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns 401 when no cookie is present', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'auth_token=bad.token.here');
    expect(res.status).toBe(401);
  });

  it('returns user payload for a valid token', async () => {
    const { signToken } = await import('../../services/jwtService');
    const token = signToken('9', 'me@b.com', 'admin');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `auth_token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@b.com');
    expect(res.body.user.role).toBe('admin');
  });
});

// ─── POST /forgot-password ────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('returns 200 with the reset link when the account exists', async () => {
    mockCreateReset.mockResolvedValueOnce({
      token: 'abc',
      resetLink: 'https://app.example.com/reset-password?token=abc',
    });
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'me@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resetLink).toBe('https://app.example.com/reset-password?token=abc');
  });

  it('returns 200 with a generic message and null link when the email is unknown (no enumeration)', async () => {
    mockCreateReset.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resetLink).toBeNull();
  });

  it('returns 500 when the service throws', async () => {
    mockCreateReset.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'me@b.com' });
    expect(res.status).toBe(500);
  });
});

// ─── POST /reset-password ─────────────────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  it('returns 400 when the token is missing', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ newPassword: 'password123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the new password is missing', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'tok' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the new password is shorter than 8 chars', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'tok', newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(mockResetWithToken).not.toHaveBeenCalled();
  });

  it('returns 400 when the token is invalid or expired', async () => {
    mockResetWithToken.mockResolvedValueOnce(false);
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'bad', newPassword: 'password123' });
    expect(res.status).toBe(400);
  });

  it('returns 200 when the password is reset successfully', async () => {
    mockResetWithToken.mockResolvedValueOnce(true);
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'good', newPassword: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockResetWithToken).toHaveBeenCalledWith('good', 'password123');
  });

  it('returns 500 when the service throws', async () => {
    mockResetWithToken.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'good', newPassword: 'password123' });
    expect(res.status).toBe(500);
  });
});
