import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { LeaveStatus } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToUser } from "../../config/socket";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";
import { recordAuditEvent } from "../../utils/auditLog";

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isStaff = [Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN];

// ── Teacher directory ─────────────────────────────────────────────────────────
router.get(
  "/teachers",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const skip = (page - 1) * limit;
      const search = req.query.search as string | undefined;
      const roleFilter = (req.query.role as string | undefined) || "ALL";

      const staffRoles = [
        Role.TEACHER,
        Role.FINANCE,
        Role.ADMIN,
        Role.SUPER_ADMIN,
      ];

      const normalizedRole =
        roleFilter && roleFilter !== "ALL" ? (roleFilter as Role) : undefined;

      const where = {
        schoolId: req.user.schoolId,
        ...(normalizedRole
          ? { role: normalizedRole }
          : { role: { in: staffRoles } }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [staff, total] = await Promise.all([
        db.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            role: true,
            email: true,
            phone: true,
            avatar: true,
            gender: true,
            dateOfBirth: true,
            address: true,
            nationality: true,
            city: true,
            state: true,
            pincode: true,
            birthPlace: true,
            emergencyContact: true,
            emergencyPhone: true,
            isActive: true,
            teacherProfile: {
              include: {
                assignedClasses: { select: { id: true, name: true } },
                gradeLevel: { select: { id: true, name: true } },
                religion: { select: { id: true, value: true } },
                house: { select: { id: true, value: true, colorHex: true } },
                subjectTeachings: {
                  include: {
                    subject: { select: { name: true } },
                    class: { select: { name: true } },
                  },
                },
              },
            },
            adminProfile: {
              include: {
                religion: { select: { id: true, value: true } },
              },
            },
            parentProfile: {
              include: {
                studentLinks: {
                  include: {
                    studentProfile: {
                      include: {
                        user: {
                          select: {
                            firstName: true,
                            middleName: true,
                            lastName: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { firstName: "asc" },
        }),
        db.user.count({ where }),
      ]);
      sendSuccess(res, staff, "OK", 200, paginationMeta(total, page, limit));
    } catch (e) {
      next(e);
    }
  },
);

// ── Leave requests — submit ───────────────────────────────────────────────────
router.post(
  "/leave",
  authorize(Role.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          type: z.enum(["SICK", "ANNUAL", "MATERNITY", "UNPAID"]),
          startDate: z.string().datetime(),
          endDate: z.string().datetime(),
          reason: z.string().min(10),
          documents: z.array(z.string()).optional(),
        })
        .parse(req.body);

      const profile = await db.teacherProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!profile) throw new AppError("Teacher profile not found", 404);

      const leave = await db.leaveRequest.create({
        data: {
          teacherProfileId: profile.id,
          ...data,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
        },
      });

      // Notify admins
      const admins = await db.user.findMany({
        where: {
          schoolId: req.user.schoolId,
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        },
        select: { id: true },
      });
      admins.forEach((a) =>
        emitToUser(a.id, "notification:new", {
          type: "GENERAL",
          title: "Leave Request",
          body: `${req.user.firstName} ${req.user.lastName} submitted a ${data.type} leave request`,
        }),
      );

      sendCreated(res, leave, "Leave request submitted");
    } catch (e) {
      next(e);
    }
  },
);

// ── Leave requests — list (admin sees all, teacher sees own) ──────────────────
router.get(
  "/leave",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;
      const skip = (page - 1) * limit;
      const status = req.query.status as LeaveStatus | undefined;

      let where: any = { ...(status && { status }) };

      if (req.user.role === Role.TEACHER) {
        const profile = await db.teacherProfile.findUnique({
          where: { userId: req.user.id },
        });
        where.teacherProfileId = profile?.id;
      } else {
        where.teacherProfile = { user: { schoolId: req.user.schoolId } };
      }

      const [leaves, total] = await Promise.all([
        db.leaveRequest.findMany({
          where,
          skip,
          take: limit,
          include: {
            teacherProfile: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.leaveRequest.count({ where }),
      ]);
      sendSuccess(res, leaves, "OK", 200, paginationMeta(total, page, limit));
    } catch (e) {
      next(e);
    }
  },
);

// ── Leave requests — approve/reject ──────────────────────────────────────────
router.patch(
  "/leave/:id/status",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = z
        .object({ status: z.enum(["APPROVED", "REJECTED"]) })
        .parse(req.body);
      const leave = await db.leaveRequest.findUnique({
        where: { id: req.params.id },
        include: {
          teacherProfile: { include: { user: true } },
          employee: { include: { user: true } },
        },
      });
      const leaveSchoolId =
        leave?.teacherProfile?.user.schoolId || leave?.employee?.schoolId;
      if (!leave || leaveSchoolId !== req.user.schoolId)
        throw new AppError("Leave request not found", 404);

      const updated = await db.leaveRequest.update({
        where: { id: req.params.id },
        data: {
          status: status as LeaveStatus,
          approvedById: req.user.id,
          approvedAt: new Date(),
        },
      });

      // Notify teacher or employee if user exists
      const targetUserId =
        leave.teacherProfile?.userId || leave.employee?.userId;
      if (targetUserId) {
        emitToUser(targetUserId, "notification:new", {
          type: "GENERAL",
          title: `Leave ${status === "APPROVED" ? "Approved ✅" : "Rejected ❌"}`,
          body: `Your ${leave.type} leave request has been ${status.toLowerCase()}`,
        });
      }

      sendSuccess(res, updated, `Leave ${status.toLowerCase()}`);
    } catch (e) {
      next(e);
    }
  },
);

// ── Payroll — record ──────────────────────────────────────────────────────────
router.post(
  "/payroll",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          teacherProfileId: z.string(),
          month: z.number().int().min(1).max(12),
          year: z.number().int(),
          baseSalary: z.number().positive(),
          allowances: z.number().default(0),
          deductions: z.number().default(0),
          notes: z.string().optional(),
        })
        .parse(req.body);

      const teacher = await db.teacherProfile.findFirst({
        where: {
          id: data.teacherProfileId,
          user: { schoolId: req.user.schoolId },
        },
      });
      if (!teacher) throw new AppError("Teacher not found", 404);

      const netPay = data.baseSalary + data.allowances - data.deductions;
      const record = await db.payrollRecord.upsert({
        where: {
          teacherProfileId_month_year: {
            teacherProfileId: data.teacherProfileId,
            month: data.month,
            year: data.year,
          },
        },
        update: {
          baseSalary: data.baseSalary,
          allowances: data.allowances,
          deductions: data.deductions,
          netPay,
          notes: data.notes,
        },
        create: { ...data, netPay },
      });

      await recordAuditEvent({
        schoolId: req.user.schoolId,
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "PAYROLL_UPDATED",
        targetType: "PayrollRecord",
        targetId: record.id,
        metadata: {
          teacherProfileId: data.teacherProfileId,
          month: data.month,
          year: data.year,
          baseSalary: data.baseSalary,
          netPay,
        },
        req,
      });

      sendCreated(res, record, "Payroll recorded");
    } catch (e) {
      next(e);
    }
  },
);

// ── Payroll — list (teacher sees own) ────────────────────────────────────────
router.get(
  "/payroll",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let where: any = {};
      if (req.user.role === Role.TEACHER) {
        const profile = await db.teacherProfile.findUnique({
          where: { userId: req.user.id },
        });
        where.teacherProfileId = profile?.id;
      } else {
        where.teacherProfile = { user: { schoolId: req.user.schoolId } };
      }
      const records = await db.payrollRecord.findMany({
        where,
        orderBy: [{ year: "desc" }, { month: "desc" }],
        include: {
          teacherProfile: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
        take: 24,
      });
      sendSuccess(res, records);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
