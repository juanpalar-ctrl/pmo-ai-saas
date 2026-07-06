process.env.JWT_SECRET = 'test-secret-admin-middleware';

import { Request, Response } from 'express';
import { adminAuthMiddleware } from '../../middleware/adminAuthMiddleware';

jest.mock('../../services/jwtService', () => ({ verifyToken: jest.fn() }));
import { verifyToken } from '../../services/jwtService';

const mockVerifyToken = verifyToken as jest.Mock;

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  mockVerifyToken.mockReset();
});

describe('adminAuthMiddleware', () => {
  it('returns 401 when there is no auth_token cookie', () => {
    const req = { cookies: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    adminAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token fails verification', () => {
    mockVerifyToken.mockReturnValueOnce(null);
    const req = { cookies: { auth_token: 'bad.token' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    adminAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the token is valid but the role is not admin', () => {
    mockVerifyToken.mockReturnValueOnce({ id: '1', email: 'u@b.com', role: 'analyst' });
    const req = { cookies: { auth_token: 'valid.token' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    adminAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.user and calls next for a valid admin token', () => {
    mockVerifyToken.mockReturnValueOnce({ id: '1', email: 'admin@b.com', role: 'admin' });
    const req = { cookies: { auth_token: 'valid.token' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    adminAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: '1', email: 'admin@b.com', role: 'admin' });
    expect(res.status).not.toHaveBeenCalled();
  });
});
