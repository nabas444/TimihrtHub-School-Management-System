import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role } from "@prisma/client";

const { mockDb, mockLogger } = vi.hoisted(() => ({
  mockDb: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../config/database", () => ({ db: mockDb }));
vi.mock("../../../utils/logger", () => ({ logger: mockLogger }));

import { recordAuditEvent } from "../../../utils/auditLog";
import auditLogRoutes from "../audit-logs.routes";

function createMockReq(overrides: any = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ip: "192.168.1.100",
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    user: { id: "admin-1", schoolId: "school-1", role: Role.ADMIN },
    ...overrides,
  };
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("Audit Log System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. recordAuditEvent helper", () => {
    it("writes an audit record with correct fields, IP, and userAgent extracted from req", async () => {
      mockDb.auditLog.create.mockResolvedValueOnce({ id: "log-1" });

      const req = createMockReq({
        ip: "10.0.0.1",
        headers: { "user-agent": "CustomClient/1.0" },
      });

      await recordAuditEvent({
        schoolId: "school-1",
        actorId: "admin-1",
        actorEmail: "admin@demoschool.edu",
        actorRole: Role.ADMIN,
        action: "LOGIN_SUCCESS",
        targetType: "User",
        targetId: "admin-1",
        metadata: { method: "PASSWORD" },
        req: req as any,
      });

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: {
          schoolId: "school-1",
          actorId: "admin-1",
          actorEmail: "admin@demoschool.edu",
          actorRole: Role.ADMIN,
          action: "LOGIN_SUCCESS",
          targetType: "User",
          targetId: "admin-1",
          metadata: { method: "PASSWORD" },
          ipAddress: "10.0.0.1",
          userAgent: "CustomClient/1.0",
        },
      });
    });

    it("sanitizes sensitive fields (password, secret, token) from metadata", async () => {
      mockDb.auditLog.create.mockResolvedValueOnce({ id: "log-2" });

      await recordAuditEvent({
        schoolId: "school-1",
        actorId: "admin-1",
        action: "USER_CREATED",
        metadata: {
          email: "teacher@school.edu",
          password: "SuperSecretPassword123!",
          mfaSecret: "JBSWY3DPEHPK3PXP",
          refreshToken: "eyJhbGciOi...",
          amount: 500,
        },
      });

      expect(mockDb.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {
              email: "teacher@school.edu",
              password: "[REDACTED]",
              mfaSecret: "[REDACTED]",
              refreshToken: "[REDACTED]",
              amount: 500,
            },
          }),
        }),
      );
    });

    it("does not throw or break the application when database write fails", async () => {
      mockDb.auditLog.create.mockRejectedValueOnce(new Error("Database connection lost"));

      await expect(
        recordAuditEvent({
          schoolId: "school-1",
          action: "PAYROLL_UPDATED",
        }),
      ).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to record audit event"),
        expect.any(Error),
      );
    });
  });

  describe("2. GET /api/v1/audit-logs endpoint", () => {
    it("blocks access for non-admin roles (STUDENT / TEACHER / PARENT)", async () => {
      const req = createMockReq({
        user: { id: "student-1", schoolId: "school-1", role: Role.STUDENT },
      });
      const res = createMockRes();
      const next = vi.fn();

      // Find role guard middleware in router stack
      const guardLayer = (auditLogRoutes.stack as any[]).find(
        (l) => !l.route && typeof l.handle === "function",
      );
      expect(guardLayer).toBeDefined();

      guardLayer.handle(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Access restricted"),
        }),
      );
    });

    it("only returns logs scoped to the requester's own schoolId (tenant isolation)", async () => {
      mockDb.auditLog.findMany.mockResolvedValueOnce([
        { id: "log-1", schoolId: "school-1", action: "FEE_RECORD_CREATED" },
      ]);
      mockDb.auditLog.count.mockResolvedValueOnce(1);

      const req = createMockReq({
        user: { id: "admin-1", schoolId: "school-1", role: Role.ADMIN },
        query: { page: "1", limit: "20" },
      });
      const res = createMockRes();
      const next = vi.fn();

      const routeLayer = (auditLogRoutes.stack as any[]).find(
        (l) => l.route && l.route.path === "/" && l.route.methods.get,
      );
      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(req, res, next);

      expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: "school-1",
          }),
          orderBy: { createdAt: "desc" },
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("filters correctly by action, actorId, and date range", async () => {
      mockDb.auditLog.findMany.mockResolvedValueOnce([]);
      mockDb.auditLog.count.mockResolvedValueOnce(0);

      const startDate = "2026-01-01T00:00:00.000Z";
      const endDate = "2026-01-31T23:59:59.999Z";

      const req = createMockReq({
        user: { id: "admin-1", schoolId: "school-1", role: Role.ADMIN },
        query: {
          action: "SCHOOL_SETTINGS_UPDATED",
          actorId: "admin-1",
          targetType: "SchoolSettings",
          startDate,
          endDate,
          page: "2",
          limit: "10",
        },
      });
      const res = createMockRes();
      const next = vi.fn();

      const routeLayer = (auditLogRoutes.stack as any[]).find(
        (l) => l.route && l.route.path === "/" && l.route.methods.get,
      );
      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(req, res, next);

      expect(mockDb.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            schoolId: "school-1",
            action: "SCHOOL_SETTINGS_UPDATED",
            actorId: "admin-1",
            targetType: "SchoolSettings",
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          skip: 10,
          take: 10,
        }),
      );
    });
  });
});
