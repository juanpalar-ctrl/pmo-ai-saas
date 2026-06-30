process.env.JWT_SECRET = 'test-secret-for-unit-tests';

import { requireAuth } from '../../middleware/requireAuth';
import { signToken } from '../../services/jwtService';
import { Request, Response, NextFunction } from 'express';

function makeReq(cookie?: string): Partial<Request> {
  return { cookies: cookie ? { auth_token: cookie } : {}, path: '/test' } as any;
}

function makeRes(): { redirect: jest.Mock; clearCookie: jest.Mock } {
  return { redirect: jest.fn(), clearCookie: jest.fn() };
}

jest.mock('../../core/logger', () => ({
  authLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('requireAuth middleware', () => {
  it('redirects to /login when no cookie is present', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();
    requireAuth(req as Request, res as any, next as NextFunction);
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches user for a valid token', () => {
    const token = signToken('5', 'pm@lara.com', 'user');
    const req = makeReq(token) as any;
    const res = makeRes();
    const next = jest.fn();
    requireAuth(req, res as any, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: '5', email: 'pm@lara.com', role: 'user' });
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirects and clears cookie for a tampered token', () => {
    const token = signToken('1', 'a@b.com', 'user');
    const tampered = token.slice(0, -4) + 'XXXX';
    const req = makeReq(tampered);
    const res = makeRes();
    const next = jest.fn();
    requireAuth(req as Request, res as any, next as NextFunction);
    expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects and clears cookie for a random string token', () => {
    const req = makeReq('not-a-real-token');
    const res = makeRes();
    const next = jest.fn();
    requireAuth(req as Request, res as any, next as NextFunction);
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });
});
