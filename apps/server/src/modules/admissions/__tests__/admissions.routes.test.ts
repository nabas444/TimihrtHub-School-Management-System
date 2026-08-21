import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, ApplicationStatus, StudentStatus } from "@prisma/client";

const { mockDb, mockEmailWorker, mockUsersService } = vi.hoisted(() => ({
  mockDb: {
    school: { findFirst: vi.fn(), findUnique: vi.fn() },
    applicant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    gradeLevel: { findFirst: vi.fn() },
    notification: { create: vi.fn(() => Promise.resolve()) },
  },
  mockEmailWorker: {
    sendApplicationReceivedEmail: vi.fn(() => Promise.resolve()),
    sendNewApplicationAlertEmail: vi.fn(() => Promise.resolve()),
    sendApplicantAcceptedWelcomeEmail: vi.fn(() => Promise.resolve()),
  },
  mockUsersService: {
    createUser: vi.fn(),
  },
}));

vi.mock("../../../config/database", () => ({ db: mockDb }));
vi.mock("../../../jobs/emailWorker", () => mockEmailWorker);
vi.mock("../../users/users.service", () => mockUsersService);

import {
  publicAdmissionsRouter,
  protectedAdmissionsRouter,
} from "../admissions.routes";

function createMockReq(overrides: any = {}) {
  return {
    params: {},
    query: {},
    body: {},
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

describe("Admissions Module (routes & CRM pipeline)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Public Application Submission", () => {
    it("1. Public apply creates an Applicant with SUBMITTED status and triggers admin notification", async () => {
      mockDb.school.findFirst.mockResolvedValueOnce({
        id: "school-1",
        name: "Demo School",
        slug: "demo-school",
        email: "admin@demoschool.edu",
        isActive: true,
      });

      const fakeApplicant = {
        id: "app-123",
        schoolId: "school-1",
        status: ApplicationStatus.SUBMITTED,
        firstName: "Abebe",
        lastName: "Kebede",
        guardianEmail: "parent@gmail.com",
        gradeLevelAppliedFor: "Grade 9",
      };

      mockDb.applicant.create.mockResolvedValueOnce(fakeApplicant);
      mockDb.user.findMany.mockResolvedValueOnce([
        { id: "admin-1", email: "admin@demoschool.edu" },
      ]);

      const req: any = {
        params: { schoolSlug: "demo-school" },
        body: {
          firstName: "Abebe",
          lastName: "Kebede",
          guardianEmail: "parent@gmail.com",
          gradeLevelAppliedFor: "Grade 9",
        },
      };
      const res = createMockRes();
      const next = vi.fn();

      // Find route handler for POST /:schoolSlug/apply
      const routeLayer = (publicAdmissionsRouter.stack as any[]).find(
        (layer) => layer.route && layer.route.path === "/:schoolSlug/apply" && layer.route.methods.post,
      );
      expect(routeLayer).toBeDefined();

      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(req, res, next);

      expect(mockDb.applicant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: "school-1",
            status: ApplicationStatus.SUBMITTED,
            firstName: "Abebe",
            lastName: "Kebede",
            guardianEmail: "parent@gmail.com",
          }),
        }),
      );

      // Verify email & in-app notifications
      expect(mockEmailWorker.sendApplicationReceivedEmail).toHaveBeenCalledWith(
        "parent@gmail.com",
        "Abebe Kebede",
        "Demo School",
        "app-123",
      );
      expect(mockDb.notification.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("2. Public apply rejects submission if school is inactive / admissions closed", async () => {
      mockDb.school.findFirst.mockResolvedValueOnce({
        id: "school-1",
        name: "Demo School",
        isActive: false,
      });

      const req: any = {
        params: { schoolSlug: "demo-school" },
        body: {
          firstName: "Abebe",
          lastName: "Kebede",
          guardianEmail: "parent@gmail.com",
          gradeLevelAppliedFor: "Grade 9",
        },
      };
      const res = createMockRes();
      const next = vi.fn();

      const routeLayer = (publicAdmissionsRouter.stack as any[]).find(
        (layer) => layer.route && layer.route.path === "/:schoolSlug/apply" && layer.route.methods.post,
      );
      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringContaining("closed"),
        }),
      );
    });
  });

  describe("Admin Pipeline Operations", () => {
    it("3. Admin list only returns applicants for the requester's own schoolId", async () => {
      mockDb.applicant.findMany.mockResolvedValueOnce([
        { id: "app-1", schoolId: "school-1", status: ApplicationStatus.SUBMITTED },
      ]);
      mockDb.applicant.count.mockResolvedValueOnce(1);

      const req = createMockReq({
        query: { page: "1", limit: "20" },
      });
      const res = createMockRes();
      const next = vi.fn();

      const routeLayer = (protectedAdmissionsRouter.stack as any[]).find(
        (layer) => layer.route && layer.route.path === "/" && layer.route.methods.get,
      );
      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(req, res, next);

      expect(mockDb.applicant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: "school-1",
          }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("4. Status transitions set reviewedById and reviewedAt", async () => {
      mockDb.applicant.findFirst.mockResolvedValueOnce({
        id: "app-1",
        schoolId: "school-1",
        status: ApplicationStatus.SUBMITTED,
      });
      mockDb.applicant.update.mockResolvedValueOnce({
        id: "app-1",
        status: ApplicationStatus.UNDER_REVIEW,
        reviewedById: "admin-1",
      });

      const req = createMockReq({
        params: { id: "app-1" },
        body: { status: ApplicationStatus.UNDER_REVIEW },
      });
      const res = createMockRes();
      const next = vi.fn();

      const routeLayer = (protectedAdmissionsRouter.stack as any[]).find(
        (layer) => layer.route && layer.route.path === "/:id/status" && layer.route.methods.patch,
      );
      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(req, res, next);

      expect(mockDb.applicant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "app-1" },
          data: expect.objectContaining({
            status: ApplicationStatus.UNDER_REVIEW,
            reviewedById: "admin-1",
            reviewedAt: expect.any(Date),
          }),
        }),
      );
    });

    it("5. Setting status to REJECTED requires rejectionReason and triggers NO applicant email", async () => {
      mockDb.applicant.findFirst.mockResolvedValueOnce({
        id: "app-1",
        schoolId: "school-1",
        status: ApplicationStatus.UNDER_REVIEW,
      });

      const reqWithoutReason = createMockReq({
        params: { id: "app-1" },
        body: { status: ApplicationStatus.REJECTED },
      });
      const res = createMockRes();
      const next = vi.fn();

      const routeLayer = (protectedAdmissionsRouter.stack as any[]).find(
        (layer) => layer.route && layer.route.path === "/:id/status" && layer.route.methods.patch,
      );
      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(reqWithoutReason, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining("Rejection reason is required"),
        }),
      );
      expect(mockEmailWorker.sendApplicantAcceptedWelcomeEmail).not.toHaveBeenCalled();
    });

    it("6. Convert only works when status is ACCEPTED and creates User + StudentProfile via users.service", async () => {
      mockDb.applicant.findFirst.mockResolvedValueOnce({
        id: "app-1",
        schoolId: "school-1",
        status: ApplicationStatus.ACCEPTED,
        firstName: "Dawit",
        lastName: "Haile",
        guardianEmail: "parent@gmail.com",
        gradeLevelAppliedFor: "Grade 10",
        fatherFirstName: "Haile",
        fatherLastName: "Tadesse",
        school: { name: "Demo School", slug: "demo-school" },
      });

      mockDb.gradeLevel.findFirst.mockResolvedValueOnce({ id: "gl-10", name: "Grade 10" });
      mockDb.user.findFirst.mockResolvedValueOnce(null);

      mockUsersService.createUser.mockResolvedValueOnce({
        id: "student-user-1",
        role: Role.STUDENT,
        email: "dawit.haile@demo-school.edu",
        firstName: "Dawit",
        lastName: "Haile",
      });

      mockDb.applicant.update.mockResolvedValueOnce({
        id: "app-1",
        status: ApplicationStatus.ENROLLED,
        convertedUserId: "student-user-1",
      });

      const req = createMockReq({ params: { id: "app-1" } });
      const res = createMockRes();
      const next = vi.fn();

      const routeLayer = (protectedAdmissionsRouter.stack as any[]).find(
        (layer) => layer.route && layer.route.path === "/:id/convert" && layer.route.methods.post,
      );
      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(req, res, next);

      expect(mockUsersService.createUser).toHaveBeenCalledWith(
        "school-1",
        expect.objectContaining({
          role: Role.STUDENT,
          firstName: "Dawit",
          lastName: "Haile",
          status: StudentStatus.ACTIVE,
          fatherFirstName: "Haile",
        }),
      );

      expect(mockDb.applicant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "app-1" },
          data: expect.objectContaining({
            status: ApplicationStatus.ENROLLED,
            convertedUserId: "student-user-1",
          }),
        }),
      );

      expect(mockEmailWorker.sendApplicantAcceptedWelcomeEmail).toHaveBeenCalledWith(
        "parent@gmail.com",
        "Dawit Haile",
        "Demo School",
        "dawit.haile@demo-school.edu",
        expect.any(String),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("7. Convert is rejected if status is not ACCEPTED", async () => {
      mockDb.applicant.findFirst.mockResolvedValueOnce({
        id: "app-1",
        schoolId: "school-1",
        status: ApplicationStatus.UNDER_REVIEW,
        school: { name: "Demo School" },
      });

      const req = createMockReq({ params: { id: "app-1" } });
      const res = createMockRes();
      const next = vi.fn();

      const routeLayer = (protectedAdmissionsRouter.stack as any[]).find(
        (layer) => layer.route && layer.route.path === "/:id/convert" && layer.route.methods.post,
      );
      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining("Only ACCEPTED applicants can be converted"),
        }),
      );
      expect(mockUsersService.createUser).not.toHaveBeenCalled();
    });

    it("8. Delete is blocked unless status is REJECTED or WITHDRAWN", async () => {
      mockDb.applicant.findFirst.mockResolvedValueOnce({
        id: "app-1",
        schoolId: "school-1",
        status: ApplicationStatus.SUBMITTED,
      });

      const req = createMockReq({ params: { id: "app-1" } });
      const res = createMockRes();
      const next = vi.fn();

      const routeLayer = (protectedAdmissionsRouter.stack as any[]).find(
        (layer) => layer.route && layer.route.path === "/:id" && layer.route.methods.delete,
      );
      const handlers = routeLayer.route.stack.map((s: any) => s.handle);
      const mainHandler = handlers[handlers.length - 1];

      await mainHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining("Only REJECTED or WITHDRAWN applications can be deleted"),
        }),
      );
      expect(mockDb.applicant.delete).not.toHaveBeenCalled();
    });
  });
});
