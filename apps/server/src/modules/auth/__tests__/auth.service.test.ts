import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@prisma/client';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    passwordReset: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    school: { create: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../../config/database', () => ({ db: mockDb }));
vi.mock('../../../config/redis', () => ({ cacheDel: vi.fn() }));
vi.mock('../../../jobs/emailWorker', () => ({
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

// bcryptjs and jsonwebtoken are real production deps (not available in the
// authoring sandbox) — mocked here so the test asserts our own logic
// (rotation, status checks) rather than re-testing bcrypt/jwt themselves.
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(async (pw: string) => `hashed:${pw}`), compare: vi.fn(async (pw: string, hash: string) => hash === `hashed:${pw}`) },
}));
vi.mock('../../../utils/jwt', () => ({
  signAccessToken: vi.fn(() => 'access.token.here'),
  signRefreshToken: vi.fn(() => 'refresh.token.here'),
  verifyRefreshToken: vi.fn((token: string) => {
    if (token === 'expired-or-garbage') throw new Error('invalid');
    return { userId: 'u1', schoolId: 's1', role: Role.TEACHER, email: 't@x.com' };
  }),
  generateOpaqueToken: vi.fn(() => 'opaque-reset-token'),
  getRefreshTokenExpiry: vi.fn(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  getPasswordResetExpiry: vi.fn(() => new Date(Date.now() + 60 * 60 * 1000)),
}));

vi.mock('../../users/users.service', () => ({
  getUserById: vi.fn((userId: string, schoolId: string) =>
    Promise.resolve({ id: userId, schoolId, email: 'u@x.com' }),
  ),
}));

import { login, refreshTokens, logout, requestPasswordReset, changePassword } from '../auth.service';
import bcrypt from 'bcryptjs';

describe('login', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects an unknown email without revealing whether the school/user exists', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce(null);
    await expect(login('nobody@x.com', 'pw')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a disabled user account even with the correct password', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce({
      id: 'u1', isActive: false, password: 'hashed:pw', school: { isActive: true },
    });
    await expect(login('u@x.com', 'pw')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects login when the user is fine but their school has been deactivated', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce({
      id: 'u1', isActive: true, password: 'hashed:pw', school: { isActive: false },
    });
    await expect(login('u@x.com', 'pw')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects an incorrect password with a generic message', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce({
      id: 'u1', isActive: true, password: 'hashed:correct', school: { isActive: true },
    });
    await expect(login('u@x.com', 'wrong')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('on success, stores the refresh token in the DB and returns both tokens', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce({
      id: 'u1', schoolId: 's1', role: Role.TEACHER, email: 'u@x.com', firstName: 'A', lastName: 'B',
      avatar: null, isActive: true, password: 'hashed:pw',
      school: { id: 's1', name: 'School', slug: 'school', isActive: true },
    });

    const result = await login('u@x.com', 'pw');

    expect(result.accessToken).toBe('access.token.here');
    expect(result.refreshToken).toBe('refresh.token.here');
    expect(mockDb.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', token: 'refresh.token.here' }) }),
    );
  });
});

describe('refreshTokens — rotation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects an unparseable/expired-signature refresh token before ever touching the DB', async () => {
    await expect(refreshTokens('expired-or-garbage')).rejects.toMatchObject({ statusCode: 401 });
    expect(mockDb.refreshToken.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a syntactically valid token that is not found in the DB (already rotated/logged out)', async () => {
    mockDb.refreshToken.findUnique.mockResolvedValueOnce(null);
    await expect(refreshTokens('some.valid.jwt')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a token that is found but past its expiry timestamp', async () => {
    mockDb.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'rt1', userId: 'u1', expiresAt: new Date(Date.now() - 1000),
    });
    await expect(refreshTokens('some.valid.jwt')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('on success: deletes the OLD refresh token and issues a brand-new one (rotation, not reuse)', async () => {
    mockDb.refreshToken.findUnique.mockResolvedValueOnce({
      id: 'rt1', userId: 'u1', expiresAt: new Date(Date.now() + 10000),
    });

    const result = await refreshTokens('some.valid.jwt');

    expect(mockDb.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt1' } });
    expect(mockDb.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', token: 'refresh.token.here' }) }),
    );
    expect(result.accessToken).toBe('access.token.here');
    expect(result.refreshToken).toBe('refresh.token.here');
  });
});

describe('logout', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('with a specific refresh token: only deletes that one session', async () => {
    await logout('u1', 'that-one-token');
    expect(mockDb.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token: 'that-one-token' } });
  });

  it('with no refresh token given: logs out ALL sessions for that user', async () => {
    await logout('u1');
    expect(mockDb.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});

describe('requestPasswordReset', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does not throw and does not create a reset record for an unknown email (no user-enumeration)', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce(null);
    const result = await requestPasswordReset('nobody@x.com');
    expect(result).toBeUndefined();
    expect(mockDb.passwordReset.create).not.toHaveBeenCalled();
  });

  it('for a known email, creates a reset record and returns the token', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce({ id: 'u1', firstName: 'A', lastName: 'B', email: 'u@x.com' });
    const token = await requestPasswordReset('u@x.com');
    expect(token).toBe('opaque-reset-token');
    expect(mockDb.passwordReset.create).toHaveBeenCalled();
  });
});

describe('changePassword', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects when the current password does not match', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'u1', password: 'hashed:actualpw' });
    await expect(changePassword('u1', 'wrongguess', 'newpw')).rejects.toMatchObject({ statusCode: 400 });
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it('on a correct current password, hashes and stores the new one', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'u1', password: 'hashed:actualpw' });
    await changePassword('u1', 'actualpw', 'newpw');
    expect(mockDb.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { password: 'hashed:newpw' } });
  });
});
