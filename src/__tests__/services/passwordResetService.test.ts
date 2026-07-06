jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../core/logger', () => ({
  serviceLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('new_hashed_password') }));

import {
  createPasswordResetToken,
  validateResetToken,
  resetPasswordWithToken,
} from '../../services/passwordResetService';
import { pool } from '../../db';

const mockQuery = pool.query as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
});

describe('createPasswordResetToken', () => {
  it('returns null without revealing whether the email exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await createPasswordResetToken('nobody@b.com');
    expect(result).toBeNull();
  });

  it('deletes any prior reset tokens before inserting a new one', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockResolvedValueOnce({ rows: [] }) // DELETE prior tokens
      .mockResolvedValueOnce({ rows: [] }); // INSERT new token

    await createPasswordResetToken('me@b.com');

    expect(mockQuery.mock.calls[1][0]).toMatch(/DELETE FROM password_resets/);
    expect(mockQuery.mock.calls[1][1]).toEqual(['user-1']);
  });

  it('returns a token and a reset link pointing at /reset-password', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await createPasswordResetToken('me@b.com');

    expect(result?.token).toMatch(/^[a-f0-9]{64}$/);
    expect(result?.resetLink).toBe(`http://localhost:3001/reset-password?token=${result?.token}`);
  });

  it('propagates errors from the database', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    await expect(createPasswordResetToken('me@b.com')).rejects.toThrow('db down');
  });
});

describe('validateResetToken', () => {
  it('returns null when the token does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await validateResetToken('bogus-token');
    expect(result).toBeNull();
  });

  it('returns the userId for a token that has not expired', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1', expires_at: future }] });

    const result = await validateResetToken('good-token');

    expect(result).toBe('user-1');
  });

  it('deletes and rejects an expired token', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', expires_at: past }] })
      .mockResolvedValueOnce({ rows: [] }); // DELETE expired token

    const result = await validateResetToken('expired-token');

    expect(result).toBeNull();
    expect(mockQuery.mock.calls[1][0]).toMatch(/DELETE FROM password_resets/);
  });
});

describe('resetPasswordWithToken', () => {
  it('returns false when the token is invalid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // validateResetToken lookup

    const result = await resetPasswordWithToken('bad-token', 'newPassword123');

    expect(result).toBe(false);
  });

  it('hashes the new password, updates the user, and deletes the used token', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', expires_at: future }] }) // validate
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users
      .mockResolvedValueOnce({ rows: [] }); // DELETE token

    const result = await resetPasswordWithToken('good-token', 'newPassword123');

    expect(result).toBe(true);
    expect(mockQuery.mock.calls[1][0]).toMatch(/UPDATE users SET password_hash/);
    expect(mockQuery.mock.calls[1][1]).toEqual(['new_hashed_password', 'user-1']);
    expect(mockQuery.mock.calls[2][0]).toMatch(/DELETE FROM password_resets/);
  });
});
