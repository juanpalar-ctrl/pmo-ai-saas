process.env.JWT_SECRET = 'test-secret-for-unit-tests';

import { signToken, verifyToken } from '../../services/jwtService';

describe('signToken', () => {
  it('returns a non-empty string', () => {
    const token = signToken('1', 'user@test.com', 'user');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('produces a valid JWT with three segments', () => {
    const token = signToken('1', 'user@test.com', 'user');
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyToken', () => {
  it('returns payload for a valid token', () => {
    const token = signToken('42', 'admin@test.com', 'admin');
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.id).toBe('42');
    expect(payload!.email).toBe('admin@test.com');
    expect(payload!.role).toBe('admin');
  });

  it('returns null for a tampered token', () => {
    const token = signToken('1', 'a@b.com', 'user');
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('returns null for a random string', () => {
    expect(verifyToken('not.a.token')).toBeNull();
  });
});

