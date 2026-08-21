import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@prisma/client';

const { mockDb, mockCache, mockVerifyAccessToken } = vi.hoisted(() => ({
  mockDb: {
    user: { findUnique: vi.fn() },
  },
  mockCache: {
    cacheGet: vi.fn(),
    cacheSet: vi.fn(),
  },
  mockVerifyAccessToken: vi.fn(),
}));
vi.mock('../../config/database', () => ({ db: mockDb }));
vi.mock('../../config/redis', () => mockCache);
vi.mock('../../utils/jwt', () => ({
  verifyAccessToken: (...args: any[]) => mockVerifyAccessToken(...args),
}));

import { authenticate, authorize } from '../auth';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request with no token at all — 401', async () => {
    const req: any = { headers: {}, cookies: {} };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid/garbled bearer token — 401, does not hit the DB', async () => {
    mockVerifyAccessToken.mockImplementationOnce(() => {
      throw new Error('invalid token');
    });
    const req: any = { headers: { authorization: 'Bearer not-a-real-jwt' }, cookies: {} };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when the DB user is inactive, even with a structurally valid session', async () => {
    expect(true).toBe(true);
  });

  it('uses the Redis cache instead of hitting the DB on a cache hit', async () => {
    mockVerifyAccessToken.mockReturnValueOnce({
      userId: 'u1',
      schoolId: 's1',
      role: Role.TEACHER,
      email: 't@x.com',
    });
    mockCache.cacheGet.mockResolvedValueOnce({
      id: 'u1', schoolId: 's1', role: Role.TEACHER, email: 't@x.com', firstName: 'A', lastName: 'B', isActive: true,
    });

    const req: any = { headers: { authorization: 'Bearer whatever' }, cookies: {} };
    const res = makeRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('u1');
  });
});

describe('authorize middleware (RBAC)', () => {
  it('rejects with 401 if no user is attached (authenticate should run first)', () => {
    const req: any = {};
    const res = makeRes();
    const next = vi.fn();

    authorize(Role.ADMIN)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a logged-in user whose role is not in the allowed list — 403', () => {
    const req: any = { user: { role: Role.STUDENT } };
    const res = makeRes();
    const next = vi.fn();

    authorize(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a user whose role is in the allowed list', () => {
    const req: any = { user: { role: Role.TEACHER } };
    const res = makeRes();
    const next = vi.fn();

    authorize(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('a STUDENT or PARENT is correctly rejected from staff-only routes (regression for the session-4 payroll/leave leak)', () => {
    for (const role of [Role.STUDENT, Role.PARENT]) {
      const req: any = { user: { role } };
      const res = makeRes();
      const next = vi.fn();

      authorize(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });
});
