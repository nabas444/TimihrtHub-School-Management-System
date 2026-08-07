import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = { school: { findUnique: vi.fn() } };
const mockCache = { cacheGet: vi.fn(), cacheSet: vi.fn() };
vi.mock("../../config/database", () => ({ db: mockDb }));
vi.mock("../../config/redis", () => mockCache);

import { tenantGuard } from "../tenancy";

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("tenantGuard middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when req.user has no schoolId at all", async () => {
    const req: any = { user: {} };
    const res = makeRes();
    const next = vi.fn();

    await tenantGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects when the school is inactive (fresh DB lookup, no cache)", async () => {
    mockCache.cacheGet.mockResolvedValueOnce(null);
    mockDb.school.findUnique.mockResolvedValueOnce({ isActive: false });

    const req: any = { user: { schoolId: "s1" } };
    const res = makeRes();
    const next = vi.fn();

    await tenantGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects when the schoolId does not correspond to any school", async () => {
    mockCache.cacheGet.mockResolvedValueOnce(null);
    mockDb.school.findUnique.mockResolvedValueOnce(null);

    const req: any = { user: { schoolId: "does-not-exist" } };
    const res = makeRes();
    const next = vi.fn();

    await tenantGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows through and skips the DB when Redis already has the active flag cached", async () => {
    mockCache.cacheGet.mockResolvedValueOnce(true);

    const req: any = { user: { schoolId: "s1" } };
    const res = makeRes();
    const next = vi.fn();

    await tenantGuard(req, res, next);

    expect(mockDb.school.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("allows through on a fresh active-school lookup and populates the cache", async () => {
    mockCache.cacheGet.mockResolvedValueOnce(null);
    mockDb.school.findUnique.mockResolvedValueOnce({ isActive: true });

    const req: any = { user: { schoolId: "s1" } };
    const res = makeRes();
    const next = vi.fn();

    await tenantGuard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockCache.cacheSet).toHaveBeenCalledWith(
      "school:active:s1",
      true,
      600,
    );
  });
});
