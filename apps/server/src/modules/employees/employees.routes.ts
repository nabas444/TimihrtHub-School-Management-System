import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  Role,
  EmploymentType,
  EmployeeStatus,
  EmployeeDocumentType,
  OnboardingStatus,
  OnboardingItemStatus,
  StaffDisciplinaryType,
  OffboardingStatus,
} from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";

const router = Router();
const adminGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

// ─────────────────────────────────────────────────────────────────────────────
// HR DASHBOARD ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/dashboard",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;

      const [
        totalEmployees,
        activeEmployees,
        onLeaveEmployees,
        probationEmployees,
        byDepartmentRaw,
        byEmploymentTypeRaw,
        upcomingExpiringDocs,
        pendingOnboardingCount,
        recentDisciplinary,
      ] = await Promise.all([
        db.employee.count({ where: { schoolId } }),
        db.employee.count({ where: { schoolId, status: EmployeeStatus.ACTIVE } }),
        db.employee.count({ where: { schoolId, status: EmployeeStatus.ON_LEAVE } }),
        db.employee.count({ where: { schoolId, status: EmployeeStatus.PROBATION } }),
        db.employee.groupBy({
          by: ["departmentId"],
          where: { schoolId, status: { in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION] } },
          _count: { id: true },
        }),
        db.employee.groupBy({
          by: ["employmentType"],
          where: { schoolId, status: { in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION] } },
          _count: { id: true },
        }),
        db.employeeDocument.findMany({
          where: {
            schoolId,
            expiryDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // Next 60 days
            },
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
              },
            },
          },
          take: 8,
          orderBy: { expiryDate: "asc" },
        }),
        db.onboardingChecklist.count({
          where: {
            schoolId,
            status: { in: [OnboardingStatus.PENDING, OnboardingStatus.IN_PROGRESS] },
          },
        }),
        db.staffDisciplinaryRecord.findMany({
          where: { schoolId },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
              },
            },
          },
          take: 5,
          orderBy: { incidentDate: "desc" },
        }),
      ]);

      // Populate department names from lookup values
      const departmentIds = byDepartmentRaw
        .map((d) => d.departmentId)
        .filter((id): id is string => Boolean(id));

      const lookupDepartments = await db.lookupValue.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, value: true, colorHex: true },
      });

      const deptMap = new Map(lookupDepartments.map((d) => [d.id, d]));

      const departmentBreakdown = byDepartmentRaw.map((d) => ({
        departmentId: d.departmentId,
        departmentName: d.departmentId ? deptMap.get(d.departmentId)?.value || "Unknown" : "Unassigned",
        count: d._count.id,
        colorHex: d.departmentId ? deptMap.get(d.departmentId)?.colorHex : null,
      }));

      const employmentTypeBreakdown = byEmploymentTypeRaw.map((e) => ({
        employmentType: e.employmentType,
        count: e._count.id,
      }));

      return sendSuccess(res, {
        headcount: {
          total: totalEmployees,
          active: activeEmployees,
          onLeave: onLeaveEmployees,
          probation: probationEmployees,
        },
        departmentBreakdown,
        employmentTypeBreakdown,
        upcomingExpiringDocs,
        pendingOnboardingCount,
        recentDisciplinary,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// ORG CHART HIERARCHY
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/org-chart",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;

      const employees = await db.employee.findMany({
        where: {
          schoolId,
          status: { in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION, EmployeeStatus.ON_LEAVE] },
        },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          employeeNumber: true,
          email: true,
          managerId: true,
          status: true,
          employmentType: true,
          department: { select: { id: true, value: true } },
          position: { select: { id: true, value: true } },
          user: { select: { id: true, role: true, avatar: true } },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });

      return sendSuccess(res, employees);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRING DOCUMENTS LIST
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/documents/expiring",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const days = parseInt(req.query.days as string) || 60;
      const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const documents = await db.employeeDocument.findMany({
        where: {
          schoolId,
          expiryDate: {
            lte: futureDate,
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              department: { select: { value: true } },
              position: { select: { value: true } },
            },
          },
        },
        orderBy: { expiryDate: "asc" },
      });

      return sendSuccess(res, documents);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// UNLINKED USERS (FOR ATTACHING EXISTING USERS TO EMPLOYEES)
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/unlinked-users",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const search = req.query.search as string | undefined;

      const unlinkedUsers = await db.user.findMany({
        where: {
          schoolId,
          role: { in: [Role.TEACHER, Role.ADMIN, Role.FINANCE, Role.SUPER_ADMIN] },
          isActive: true,
          employeeProfile: null,
          ...(search && {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }),
        },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          role: true,
          avatar: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });

      return sendSuccess(res, unlinkedUsers);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE DIRECTORY & LIST
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const search = req.query.search as string | undefined;
      const departmentId = req.query.departmentId as string | undefined;
      const positionId = req.query.positionId as string | undefined;
      const status = req.query.status as EmployeeStatus | undefined;
      const employmentType = req.query.employmentType as EmploymentType | undefined;
      const hasUserAccount = req.query.hasUserAccount as string | undefined;

      const where: any = {
        schoolId,
        ...(departmentId && { departmentId }),
        ...(positionId && { positionId }),
        ...(status && { status }),
        ...(employmentType && { employmentType }),
        ...(hasUserAccount === "true" && { userId: { not: null } }),
        ...(hasUserAccount === "false" && { userId: null }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { employeeNumber: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }),
      };

      const [employees, total] = await Promise.all([
        db.employee.findMany({
          where,
          skip,
          take: limit,
          include: {
            department: { select: { id: true, value: true, colorHex: true } },
            position: { select: { id: true, value: true } },
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
              },
            },
            user: {
              select: {
                id: true,
                role: true,
                email: true,
                avatar: true,
                isActive: true,
              },
            },
            _count: {
              select: {
                documents: true,
                disciplinaryRecords: true,
                performanceReviews: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
        }),
        db.employee.count({ where }),
      ]);

      return sendSuccess(
        res,
        employees,
        "Employees retrieved successfully",
        200,
        paginationMeta(page, limit, total),
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE EMPLOYEE DETAIL
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/:id",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;

      const employee = await db.employee.findFirst({
        where: { id, schoolId },
        include: {
          department: true,
          position: true,
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              department: { select: { value: true } },
              position: { select: { value: true } },
            },
          },
          directReports: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              status: true,
              position: { select: { value: true } },
            },
          },
          user: {
            select: {
              id: true,
              role: true,
              email: true,
              avatar: true,
              isActive: true,
              lastLoginAt: true,
            },
          },
          documents: {
            orderBy: { createdAt: "desc" },
          },
          onboardingChecklists: {
            include: {
              items: {
                orderBy: { id: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          performanceReviews: {
            include: {
              reviewer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: { reviewPeriodStart: "desc" },
          },
          trainingRecords: {
            orderBy: { completionDate: "desc" },
          },
          disciplinaryRecords: {
            orderBy: { incidentDate: "desc" },
          },
          offboardingRecords: {
            include: {
              checklistItems: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!employee) {
        throw new AppError("Employee record not found", 404);
      }

      return sendSuccess(res, employee);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// CREATE EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────

const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1, "Last name is required"),
  avatar: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  status: z.nativeEnum(EmployeeStatus).default(EmployeeStatus.ACTIVE),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  salary: z.number().optional().nullable(),
  contractStart: z.string().optional().nullable(),
  contractEnd: z.string().optional().nullable(),
  probationEnd: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  employeeNumber: z.string().optional().nullable(),
  createOnboardingChecklist: z.boolean().default(true),
});

router.post(
  "/",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const data = createEmployeeSchema.parse(req.body);

      // Auto-generate employee number if not provided
      let employeeNumber = data.employeeNumber?.trim();
      if (!employeeNumber) {
        const count = await db.employee.count({ where: { schoolId } });
        const year = new Date().getFullYear();
        employeeNumber = `EMP-${year}-${String(count + 1).padStart(4, "0")}`;
      }

      // Check unique employee number per school
      const existing = await db.employee.findUnique({
        where: {
          schoolId_employeeNumber: {
            schoolId,
            employeeNumber,
          },
        },
      });
      if (existing) {
        throw new AppError(`Employee number ${employeeNumber} already exists in this school`, 400);
      }

      const employee = await db.employee.create({
        data: {
          schoolId,
          employeeNumber,
          firstName: data.firstName,
          middleName: data.middleName || null,
          lastName: data.lastName,
          avatar: data.avatar || null,
          email: data.email || null,
          phone: data.phone || null,
          gender: data.gender || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          nationalId: data.nationalId || null,
          hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
          employmentType: data.employmentType,
          status: data.status,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          managerId: data.managerId || null,
          salary: data.salary ?? null,
          contractStart: data.contractStart ? new Date(data.contractStart) : null,
          contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
          probationEnd: data.probationEnd ? new Date(data.probationEnd) : null,
          address: data.address || null,
          city: data.city || null,
          emergencyContact: data.emergencyContact || null,
          emergencyPhone: data.emergencyPhone || null,
          bankName: data.bankName || null,
          bankAccountNumber: data.bankAccountNumber || null,
          notes: data.notes || null,
        },
        include: {
          department: true,
          position: true,
        },
      });

      // Optionally auto-create standard onboarding checklist
      if (data.createOnboardingChecklist) {
        await db.onboardingChecklist.create({
          data: {
            schoolId,
            employeeId: employee.id,
            title: `Onboarding: ${employee.firstName} ${employee.lastName}`,
            status: OnboardingStatus.IN_PROGRESS,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            items: {
              create: [
                {
                  title: "National ID / Passport Verification",
                  description: "Collect and verify government-issued photo identification",
                  category: "DOCUMENTATION",
                  isRequired: true,
                },
                {
                  title: "Educational Credentials & Teaching License",
                  description: "Verify university degrees and professional teaching license",
                  category: "DOCUMENTATION",
                  isRequired: true,
                },
                {
                  title: "Police Clearance / Background Check",
                  description: "Confirm criminal record check / reference check",
                  category: "DOCUMENTATION",
                  isRequired: true,
                },
                {
                  title: "Employment Contract Signing",
                  description: "Countersign appointment offer & contract terms",
                  category: "DOCUMENTATION",
                  isRequired: true,
                },
                {
                  title: "School ID Badge Issuance",
                  description: "Issue staff card and barcode/RFID credentials",
                  category: "LOGISTICS",
                  isRequired: true,
                },
                {
                  title: "IT & System Account Provisioning",
                  description: "Setup official email, portal access, and curriculum tools",
                  category: "IT_SETUP",
                  isRequired: false,
                },
                {
                  title: "School Campus & Department Orientation",
                  description: "Tour of school facilities, introduction to department head",
                  category: "ORIENTATION",
                  isRequired: true,
                },
              ],
            },
          },
        });
      }

      return sendCreated(res, employee, "Employee record created successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────

const updateEmployeeSchema = createEmployeeSchema.partial();

router.patch(
  "/:id",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const data = updateEmployeeSchema.parse(req.body);

      const existing = await db.employee.findFirst({
        where: { id, schoolId },
      });
      if (!existing) {
        throw new AppError("Employee record not found", 404);
      }

      const updated = await db.employee.update({
        where: { id },
        data: {
          ...(data.firstName !== undefined && { firstName: data.firstName }),
          ...(data.middleName !== undefined && { middleName: data.middleName || null }),
          ...(data.lastName !== undefined && { lastName: data.lastName }),
          ...(data.avatar !== undefined && { avatar: data.avatar || null }),
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.phone !== undefined && { phone: data.phone || null }),
          ...(data.gender !== undefined && { gender: data.gender }),
          ...(data.dateOfBirth !== undefined && {
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          }),
          ...(data.nationalId !== undefined && { nationalId: data.nationalId || null }),
          ...(data.hireDate !== undefined && {
            hireDate: data.hireDate ? new Date(data.hireDate) : existing.hireDate,
          }),
          ...(data.employmentType !== undefined && { employmentType: data.employmentType }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.departmentId !== undefined && { departmentId: data.departmentId || null }),
          ...(data.positionId !== undefined && { positionId: data.positionId || null }),
          ...(data.managerId !== undefined && { managerId: data.managerId || null }),
          ...(data.salary !== undefined && { salary: data.salary }),
          ...(data.contractStart !== undefined && {
            contractStart: data.contractStart ? new Date(data.contractStart) : null,
          }),
          ...(data.contractEnd !== undefined && {
            contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
          }),
          ...(data.probationEnd !== undefined && {
            probationEnd: data.probationEnd ? new Date(data.probationEnd) : null,
          }),
          ...(data.address !== undefined && { address: data.address || null }),
          ...(data.city !== undefined && { city: data.city || null }),
          ...(data.emergencyContact !== undefined && {
            emergencyContact: data.emergencyContact || null,
          }),
          ...(data.emergencyPhone !== undefined && {
            emergencyPhone: data.emergencyPhone || null,
          }),
          ...(data.bankName !== undefined && { bankName: data.bankName || null }),
          ...(data.bankAccountNumber !== undefined && {
            bankAccountNumber: data.bankAccountNumber || null,
          }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
        },
        include: {
          department: true,
          position: true,
          user: true,
        },
      });

      // Synchronize employee status with linked User account and hostel assignments
      if (data.status !== undefined) {
        const isInactive =
          data.status === EmployeeStatus.RESIGNED ||
          data.status === EmployeeStatus.TERMINATED ||
          data.status === EmployeeStatus.SUSPENDED;

        if (isInactive) {
          // Deactivate linked user login account
          if (existing.userId) {
            await db.user.update({
              where: { id: existing.userId },
              data: { isActive: false },
            });
          }

          // Deactivate any active hostel staff assignments
          await db.hostelStaffAssignment.updateMany({
            where: { employeeId: id, isActive: true },
            data: { isActive: false },
          });

          // Unassign from head warden of any hostel
          await db.hostel.updateMany({
            where: { wardenId: id, schoolId },
            data: { wardenId: null },
          });
        } else if (data.status === EmployeeStatus.ACTIVE || data.status === EmployeeStatus.PROBATION) {
          // Re-activate linked user login account
          if (existing.userId) {
            await db.user.update({
              where: { id: existing.userId },
              data: { isActive: true },
            });
          }
        }
      }

      return sendSuccess(res, updated, "Employee record updated successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────

router.delete(
  "/:id",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;

      const employee = await db.employee.findFirst({
        where: { id, schoolId },
      });

      if (!employee) {
        throw new AppError("Employee record not found", 404);
      }

      await db.$transaction(async (tx) => {
        // 1. Unassign from head warden of hostels
        await tx.hostel.updateMany({
          where: { wardenId: id, schoolId },
          data: { wardenId: null },
        });

        // 2. Delete hostel staff assignments
        await tx.hostelStaffAssignment.deleteMany({
          where: { employeeId: id },
        });

        // 3. Unassign from hostel maintenance tickets
        await tx.hostelMaintenanceTicket.updateMany({
          where: { assignedToId: id },
          data: { assignedToId: null },
        });

        // 4. Unlink from hired job applications
        await tx.jobApplication.updateMany({
          where: { hiredEmployeeId: id },
          data: { hiredEmployeeId: null },
        });

        // 5. Clear direct reports manager reference
        await tx.employee.updateMany({
          where: { managerId: id },
          data: { managerId: null },
        });

        // 6. Delete documents
        await tx.employeeDocument.deleteMany({
          where: { employeeId: id },
        });

        // 7. Delete onboarding checklists & items
        const checklists = await tx.onboardingChecklist.findMany({
          where: { employeeId: id },
          select: { id: true },
        });
        const clIds = checklists.map((c) => c.id);
        if (clIds.length > 0) {
          await tx.onboardingItem.deleteMany({
            where: { checklistId: { in: clIds } },
          });
          await tx.onboardingChecklist.deleteMany({
            where: { employeeId: id },
          });
        }

        // 8. Delete offboarding records & exit checklist items
        const offboards = await tx.offboardingRecord.findMany({
          where: { employeeId: id },
          select: { id: true },
        });
        const offIds = offboards.map((o) => o.id);
        if (offIds.length > 0) {
          await tx.exitChecklistItem.deleteMany({
            where: { offboardingId: { in: offIds } },
          });
          await tx.offboardingRecord.deleteMany({
            where: { employeeId: id },
          });
        }

        // 9. Delete performance reviews
        await tx.performanceReview.deleteMany({
          where: { employeeId: id },
        });

        // 10. Delete training records
        await tx.staffTraining.deleteMany({
          where: { employeeId: id },
        });

        // 11. Delete disciplinary records
        await tx.staffDisciplinaryRecord.deleteMany({
          where: { employeeId: id },
        });

        // 12. Delete leave requests
        await tx.leaveRequest.deleteMany({
          where: { employeeId: id },
        });

        // 13. Delete payroll records
        await tx.payrollRecord.deleteMany({
          where: { employeeId: id },
        });

        // 14. Delete the employee record
        await tx.employee.delete({
          where: { id },
        });

        // 15. If user was linked, deactivate user account
        if (employee.userId) {
          await tx.user.update({
            where: { id: employee.userId },
            data: { isActive: false },
          });
        }
      });

      return sendSuccess(res, { id, deleted: true }, "Employee removed successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// LINK OR CREATE SYSTEM USER ACCOUNT FOR EMPLOYEE
// ─────────────────────────────────────────────────────────────────────────────

const linkUserSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

router.post(
  "/:id/link-user",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const { userId } = linkUserSchema.parse(req.body);

      const [employee, targetUser] = await Promise.all([
        db.employee.findFirst({ where: { id, schoolId } }),
        db.user.findFirst({ where: { id: userId, schoolId } }),
      ]);

      if (!employee) throw new AppError("Employee not found", 404);
      if (!targetUser) throw new AppError("User account not found", 404);

      const updated = await db.employee.update({
        where: { id },
        data: { userId },
        include: { user: true },
      });

      return sendSuccess(res, updated, "User account linked to employee successfully");
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:id/unlink-user",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;

      const employee = await db.employee.findFirst({ where: { id, schoolId } });
      if (!employee) throw new AppError("Employee not found", 404);

      const updated = await db.employee.update({
        where: { id },
        data: { userId: null },
      });

      return sendSuccess(res, updated, "User account unlinked from employee");
    } catch (err) {
      next(err);
    }
  },
);

const createUserAccountSchema = z.object({
  role: z.nativeEnum(Role),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  specialization: z.string().optional(), // For teachers
  qualification: z.string().optional(), // For teachers
});

router.post(
  "/:id/create-user-account",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const data = createUserAccountSchema.parse(req.body);

      const employee = await db.employee.findFirst({ where: { id, schoolId } });
      if (!employee) throw new AppError("Employee not found", 404);
      if (employee.userId) throw new AppError("Employee already has a linked user account", 400);

      // Check if email already in use
      const existingEmail = await db.user.findUnique({
        where: {
          schoolId_email: {
            schoolId,
            email: data.email.toLowerCase(),
          },
        },
      });
      if (existingEmail) throw new AppError("Email already in use by another account", 400);

      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Transaction: create User, create role profile, link to Employee
      const newUser = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            schoolId,
            role: data.role,
            email: data.email.toLowerCase(),
            password: hashedPassword,
            firstName: employee.firstName,
            middleName: employee.middleName,
            lastName: employee.lastName,
            phone: employee.phone,
            gender: employee.gender,
            dateOfBirth: employee.dateOfBirth,
            address: employee.address,
            emergencyContact: employee.emergencyContact,
            emergencyPhone: employee.emergencyPhone,
            isActive: true,
          },
        });

        if (data.role === Role.TEACHER) {
          await tx.teacherProfile.create({
            data: {
              userId: user.id,
              employeeId: employee.employeeNumber,
              specialization: data.specialization || null,
              qualification: data.qualification || null,
              joinedAt: employee.hireDate,
            },
          });
        } else if (
          data.role === Role.ADMIN ||
          data.role === Role.SUPER_ADMIN ||
          data.role === Role.FINANCE
        ) {
          await tx.adminProfile.create({
            data: {
              userId: user.id,
              employeeId: employee.employeeNumber,
            },
          });
        }

        await tx.employee.update({
          where: { id: employee.id },
          data: {
            userId: user.id,
            email: employee.email || user.email,
          },
        });

        return user;
      });

      return sendCreated(
        res,
        { userId: newUser.id, email: newUser.email, role: newUser.role },
        "Portal account created and linked to employee successfully",
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT VAULT
// ─────────────────────────────────────────────────────────────────────────────

const createDocumentSchema = z.object({
  type: z.nativeEnum(EmployeeDocumentType).default(EmployeeDocumentType.OTHER),
  title: z.string().min(1, "Document title is required"),
  documentNumber: z.string().optional().nullable(),
  fileUrl: z.string().min(1, "Document file URL is required"),
  fileSize: z.number().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  reminderDays: z.number().default(30),
  notes: z.string().optional().nullable(),
});

router.post(
  "/:id/documents",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId } = req.params;
      const data = createDocumentSchema.parse(req.body);

      const employee = await db.employee.findFirst({ where: { id: employeeId, schoolId } });
      if (!employee) throw new AppError("Employee not found", 404);

      const doc = await db.employeeDocument.create({
        data: {
          schoolId,
          employeeId,
          type: data.type,
          title: data.title,
          documentNumber: data.documentNumber || null,
          fileUrl: data.fileUrl,
          fileSize: data.fileSize || null,
          mimeType: data.mimeType || null,
          issueDate: data.issueDate ? new Date(data.issueDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          reminderDays: data.reminderDays,
          notes: data.notes || null,
        },
      });

      return sendCreated(res, doc, "Document added to employee vault");
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/documents/:docId",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId, docId } = req.params;
      const { isVerified, notes, expiryDate } = req.body;

      const doc = await db.employeeDocument.findFirst({
        where: { id: docId, employeeId, schoolId },
      });
      if (!doc) throw new AppError("Document not found", 404);

      const updated = await db.employeeDocument.update({
        where: { id: docId },
        data: {
          ...(isVerified !== undefined && {
            isVerified,
            verifiedById: isVerified ? req.user.id : null,
            verifiedAt: isVerified ? new Date() : null,
          }),
          ...(notes !== undefined && { notes }),
          ...(expiryDate !== undefined && {
            expiryDate: expiryDate ? new Date(expiryDate) : null,
          }),
        },
      });

      return sendSuccess(res, updated, "Document updated");
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id/documents/:docId",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId, docId } = req.params;

      const doc = await db.employeeDocument.findFirst({
        where: { id: docId, employeeId, schoolId },
      });
      if (!doc) throw new AppError("Document not found", 404);

      await db.employeeDocument.delete({ where: { id: docId } });

      return sendSuccess(res, { deleted: true }, "Document deleted successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING CHECKLIST ITEM TOGGLE
// ─────────────────────────────────────────────────────────────────────────────

router.patch(
  "/:id/onboarding/items/:itemId",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId, itemId } = req.params;
      const { status, notes } = req.body;

      const item = await db.onboardingItem.findFirst({
        where: {
          id: itemId,
          checklist: { employeeId, schoolId },
        },
        include: { checklist: true },
      });
      if (!item) throw new AppError("Checklist item not found", 404);

      const updatedItem = await db.onboardingItem.update({
        where: { id: itemId },
        data: {
          status: status as OnboardingItemStatus,
          completedAt: status === OnboardingItemStatus.COMPLETED ? new Date() : null,
          completedById: status === OnboardingItemStatus.COMPLETED ? req.user.id : null,
          ...(notes !== undefined && { notes }),
        },
      });

      // Check if all items are completed to auto-update checklist status
      const allItems = await db.onboardingItem.findMany({
        where: { checklistId: item.checklistId },
      });

      const allCompleted = allItems.every(
        (i) =>
          i.id === itemId
            ? status === OnboardingItemStatus.COMPLETED || status === OnboardingItemStatus.WAIVED
            : i.status === OnboardingItemStatus.COMPLETED || i.status === OnboardingItemStatus.WAIVED,
      );

      if (allCompleted) {
        await db.onboardingChecklist.update({
          where: { id: item.checklistId },
          data: {
            status: OnboardingStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }

      return sendSuccess(res, updatedItem, "Checklist item status updated");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

const createReviewSchema = z.object({
  cycleName: z.string().min(1, "Cycle name is required"),
  reviewPeriodStart: z.string().min(1, "Period start is required"),
  reviewPeriodEnd: z.string().min(1, "Period end is required"),
  selfReviewNotes: z.string().optional().nullable(),
  reviewerNotes: z.string().optional().nullable(),
  competencyScores: z.any().optional(),
  overallRating: z.number().min(1).max(5).optional().nullable(),
  goalsSet: z.string().optional().nullable(),
  developmentPlan: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "SUBMITTED", "COMPLETED"]).default("COMPLETED"),
});

router.post(
  "/:id/reviews",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId } = req.params;
      const data = createReviewSchema.parse(req.body);

      const employee = await db.employee.findFirst({ where: { id: employeeId, schoolId } });
      if (!employee) throw new AppError("Employee not found", 404);

      const review = await db.performanceReview.create({
        data: {
          schoolId,
          employeeId,
          reviewerId: req.user.id,
          cycleName: data.cycleName,
          reviewPeriodStart: new Date(data.reviewPeriodStart),
          reviewPeriodEnd: new Date(data.reviewPeriodEnd),
          selfReviewNotes: data.selfReviewNotes || null,
          reviewerNotes: data.reviewerNotes || null,
          competencyScores: data.competencyScores || null,
          overallRating: data.overallRating ?? null,
          goalsSet: data.goalsSet || null,
          developmentPlan: data.developmentPlan || null,
          status: data.status,
          completedAt: data.status === "COMPLETED" ? new Date() : null,
        },
      });

      return sendCreated(res, review, "Performance review saved successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// STAFF TRAINING & PROFESSIONAL DEVELOPMENT
// ─────────────────────────────────────────────────────────────────────────────

const createTrainingSchema = z.object({
  title: z.string().min(1, "Training title is required"),
  provider: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  hoursCompleted: z.number().optional().nullable(),
  startDate: z.string().optional().nullable(),
  completionDate: z.string().min(1, "Completion date is required"),
  expiryDate: z.string().optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post(
  "/:id/trainings",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId } = req.params;
      const data = createTrainingSchema.parse(req.body);

      const employee = await db.employee.findFirst({ where: { id: employeeId, schoolId } });
      if (!employee) throw new AppError("Employee not found", 404);

      const training = await db.staffTraining.create({
        data: {
          schoolId,
          employeeId,
          title: data.title,
          provider: data.provider || null,
          category: data.category || null,
          hoursCompleted: data.hoursCompleted ?? null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          completionDate: new Date(data.completionDate),
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          certificateUrl: data.certificateUrl || null,
          notes: data.notes || null,
        },
      });

      return sendCreated(res, training, "Training record added successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// DISCIPLINARY & CONDUCT RECORDS
// ─────────────────────────────────────────────────────────────────────────────

const createDisciplinarySchema = z.object({
  type: z.nativeEnum(StaffDisciplinaryType).default(StaffDisciplinaryType.WRITTEN_WARNING),
  incidentDate: z.string().optional().nullable(),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  actionTaken: z.string().optional().nullable(),
  documentUrl: z.string().optional().nullable(),
});

router.post(
  "/:id/disciplinary",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId } = req.params;
      const data = createDisciplinarySchema.parse(req.body);

      const employee = await db.employee.findFirst({ where: { id: employeeId, schoolId } });
      if (!employee) throw new AppError("Employee not found", 404);

      const record = await db.staffDisciplinaryRecord.create({
        data: {
          schoolId,
          employeeId,
          type: data.type,
          incidentDate: data.incidentDate ? new Date(data.incidentDate) : new Date(),
          title: data.title,
          description: data.description,
          actionTaken: data.actionTaken || null,
          documentUrl: data.documentUrl || null,
          recordedById: req.user.id,
        },
      });

      return sendCreated(res, record, "Conduct / Disciplinary record logged");
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/disciplinary/:recordId",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId, recordId } = req.params;
      const { isResolved, resolutionNotes } = req.body;

      const record = await db.staffDisciplinaryRecord.findFirst({
        where: { id: recordId, employeeId, schoolId },
      });
      if (!record) throw new AppError("Record not found", 404);

      const updated = await db.staffDisciplinaryRecord.update({
        where: { id: recordId },
        data: {
          isResolved: Boolean(isResolved),
          resolvedAt: isResolved ? new Date() : null,
          resolutionNotes: resolutionNotes || null,
        },
      });

      return sendSuccess(res, updated, "Disciplinary resolution updated");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// OFFBOARDING WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

const createOffboardingSchema = z.object({
  type: z.enum(["RESIGNATION", "TERMINATION", "RETIREMENT", "END_OF_CONTRACT"]).default("RESIGNATION"),
  reason: z.string().optional().nullable(),
  noticeDate: z.string().optional().nullable(),
  lastWorkingDay: z.string().min(1, "Last working day is required"),
  exitInterviewNotes: z.string().optional().nullable(),
  finalSettlementNotes: z.string().optional().nullable(),
  deactivateUserNow: z.boolean().default(false),
});

router.post(
  "/:id/offboard",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId } = req.params;
      const data = createOffboardingSchema.parse(req.body);

      const employee = await db.employee.findFirst({
        where: { id: employeeId, schoolId },
        include: { user: true },
      });
      if (!employee) throw new AppError("Employee not found", 404);

      const offboardRecord = await db.$transaction(async (tx) => {
        const offboard = await tx.offboardingRecord.create({
          data: {
            schoolId,
            employeeId,
            type: data.type,
            reason: data.reason || null,
            noticeDate: data.noticeDate ? new Date(data.noticeDate) : null,
            lastWorkingDay: new Date(data.lastWorkingDay),
            exitInterviewNotes: data.exitInterviewNotes || null,
            finalSettlementNotes: data.finalSettlementNotes || null,
            status: OffboardingStatus.IN_PROGRESS,
            userDeactivated: data.deactivateUserNow,
            checklistItems: {
              create: [
                { title: "Asset Return (Laptop, Keys, School Property)", category: "ASSETS" },
                { title: "Staff ID Card & Access Badge Surrender", category: "HR" },
                { title: "Revoke Portal / Email System Access", category: "IT_ACCESS" },
                { title: "Final Salary, Leave Balance & Settlement Clearance", category: "FINANCE" },
                { title: "Experience Certificate & Relieving Letter Issued", category: "HR" },
              ],
            },
          },
          include: { checklistItems: true },
        });

        // Update employee status
        await tx.employee.update({
          where: { id: employeeId },
          data: {
            status: data.type === "TERMINATION" ? EmployeeStatus.TERMINATED : EmployeeStatus.RESIGNED,
          },
        });

        // Optionally deactivate User account immediately
        if (data.deactivateUserNow && employee.userId) {
          await tx.user.update({
            where: { id: employee.userId },
            data: { isActive: false },
          });
        }

        return offboard;
      });

      return sendCreated(res, offboardRecord, "Offboarding initiated successfully");
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/offboard/:offboardId/items/:itemId",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: employeeId, offboardId, itemId } = req.params;
      const { isCompleted, notes } = req.body;

      const item = await db.exitChecklistItem.findFirst({
        where: {
          id: itemId,
          offboarding: { id: offboardId, employeeId, schoolId },
        },
        include: {
          offboarding: {
            include: { employee: true },
          },
        },
      });
      if (!item) throw new AppError("Exit checklist item not found", 404);

      const updatedItem = await db.exitChecklistItem.update({
        where: { id: itemId },
        data: {
          isCompleted: Boolean(isCompleted),
          completedAt: isCompleted ? new Date() : null,
          completedBy: isCompleted ? req.user.id : null,
          ...(notes !== undefined && { notes }),
        },
      });

      // If all items completed, mark offboarding as completed and deactivate linked user
      const allItems = await db.exitChecklistItem.findMany({
        where: { offboardingId: offboardId },
      });
      const allDone = allItems.every((i) => (i.id === itemId ? isCompleted : i.isCompleted));

      if (allDone) {
        await db.$transaction(async (tx) => {
          await tx.offboardingRecord.update({
            where: { id: offboardId },
            data: {
              status: OffboardingStatus.COMPLETED,
              completedAt: new Date(),
              userDeactivated: true,
            },
          });

          if (item.offboarding.employee.userId) {
            await tx.user.update({
              where: { id: item.offboarding.employee.userId },
              data: { isActive: false },
            });
          }
        });
      }

      return sendSuccess(res, updatedItem, "Exit item updated");
    } catch (err) {
      next(err);
    }
  },
);

export default router;
