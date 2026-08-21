import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role, AuthProvider } from '@prisma/client';

const { mockDb, mockVerifyIdToken } = vi.hoisted(() => ({
  mockDb: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    school: { create: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
  mockVerifyIdToken: vi.fn(),
}));

vi.mock('../../../config/database', () => ({ db: mockDb }));
vi.mock('../../../config/redis', () => ({ cacheDel: vi.fn() }));
vi.mock('../../../jobs/emailWorker', () => ({
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

// Mock google-auth-library
vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    })),
  };
});

vi.mock('../../../utils/jwt', () => ({
  signAccessToken: vi.fn(() => 'google.access.token.jwt'),
  signRefreshToken: vi.fn(() => 'google.refresh.token.jwt'),
  verifyRefreshToken: vi.fn(),
  generateOpaqueToken: vi.fn(),
  getRefreshTokenExpiry: vi.fn(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  getPasswordResetExpiry: vi.fn(),
}));

vi.mock('../../users/users.service', () => ({
  getUserById: vi.fn((userId: string, schoolId: string) =>
    Promise.resolve({ id: userId, schoolId, email: 'mocked@test.com' }),
  ),
}));

import { googleLogin } from '../auth.service';

describe('Google Authentication (POST /api/v1/auth/google)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Valid token + existing linked non-admin user logs in successfully', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: 'teacher@school.edu',
        sub: 'google-sub-12345',
      }),
    });

    mockDb.user.findFirst.mockResolvedValueOnce({
      id: 'u-teacher-1',
      schoolId: 's1',
      role: Role.TEACHER,
      email: 'teacher@school.edu',
      googleId: 'google-sub-12345',
      authProvider: AuthProvider.LOCAL,
      isActive: true,
      school: { id: 's1', name: 'School', slug: 'school', isActive: true },
    });

    mockDb.user.update.mockResolvedValueOnce({
      id: 'u-teacher-1',
      lastLoginAt: new Date(),
    });

    const result = await googleLogin('valid-google-credential');

    expect(result.accessToken).toBe('google.access.token.jwt');
    expect(result.refreshToken).toBe('google.refresh.token.jwt');
    expect(mockDb.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u-teacher-1',
          token: 'google.refresh.token.jwt',
        }),
      }),
    );
  });

  it('2. Valid token + existing unlinked LOCAL non-admin user is auto-linked and logged in', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: 'student@school.edu',
        sub: 'google-sub-67890',
      }),
    });

    mockDb.user.findFirst.mockResolvedValueOnce({
      id: 'u-student-1',
      schoolId: 's1',
      role: Role.STUDENT,
      email: 'student@school.edu',
      googleId: null,
      authProvider: AuthProvider.LOCAL,
      isActive: true,
      school: { id: 's1', name: 'School', slug: 'school', isActive: true },
    });

    mockDb.user.update.mockResolvedValue({
      id: 'u-student-1',
      googleId: 'google-sub-67890',
      lastLoginAt: new Date(),
    });

    const result = await googleLogin('valid-google-credential');

    expect(result.accessToken).toBe('google.access.token.jwt');
    expect(result.refreshToken).toBe('google.refresh.token.jwt');
    // Verify auto-linking occurred
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-student-1' },
        data: expect.objectContaining({
          googleId: 'google-sub-67890',
          isEmailVerified: true,
        }),
      }),
    );
  });

  it('3. Valid token + no matching user at all is rejected with 403', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: 'stranger@gmail.com',
        sub: 'google-sub-unknown',
      }),
    });

    mockDb.user.findFirst.mockResolvedValueOnce(null);

    await expect(googleLogin('valid-google-credential')).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('No account found for this email'),
    });

    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockDb.refreshToken.create).not.toHaveBeenCalled();
  });

  it('4. Valid token + matching user has role ADMIN is rejected with 403, and record remains untouched', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: 'admin@demoschool.edu',
        sub: 'google-sub-admin',
      }),
    });

    mockDb.user.findFirst.mockResolvedValueOnce({
      id: 'u-admin-1',
      schoolId: 's1',
      role: Role.ADMIN,
      email: 'admin@demoschool.edu',
      googleId: null,
      authProvider: AuthProvider.LOCAL,
      isActive: true,
      school: { id: 's1', name: 'School', slug: 'school', isActive: true },
    });

    await expect(googleLogin('valid-google-credential')).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('Admin accounts must sign in with email and password'),
    });

    // Verify record was untouched: no googleId update, no refreshToken write
    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockDb.refreshToken.create).not.toHaveBeenCalled();
  });

  it('5. Invalid/expired Google token is rejected with 401', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('Token expired or invalid signature'));

    await expect(googleLogin('invalid-or-expired-token')).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringContaining('Invalid or expired Google token'),
    });

    expect(mockDb.user.findFirst).not.toHaveBeenCalled();
    expect(mockDb.user.update).not.toHaveBeenCalled();
    expect(mockDb.refreshToken.create).not.toHaveBeenCalled();
  });
});
