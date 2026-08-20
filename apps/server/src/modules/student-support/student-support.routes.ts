import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  Role,
  SupportProgramType,
  SupportEnrollmentStatus,
  FeeStatus,
} from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated } from "../../utils/response";

const router = Router();

const isAuthorizedStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const createProgramSchema = z.object({
  type: z.nativeEnum(SupportProgramType),
  name: z.string().min(1, "Program name is required"),
  description: z.string().optional().nullable(),
  waiverPercent: z
    .number()
    .min(0, "Waiver percent must be >= 0")
    .max(100, "Waiver percent must be <= 100")
    .optional()
    .nullable(),
  academicYear: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(SupportProgramType).optional(),
  description: z.string().optional().nullable(),
  waiverPercent: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .nullable(),
  academicYear: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createEnrollmentSchema = z.object({
  studentProfileId: z.string().min(1, "Student profile ID is required"),
  supportProgramId: z.string().min(1, "Support program ID is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const bulkEnrollSchema = z.object({
  supportProgramId: z.string().min(1, "Support program ID is required"),
  studentProfileIds: z
    .array(z.string())
    .min(1, "At least one student profile ID is required"),
  startDate: z.string().optional(),
  notes: z.string().optional().nullable(),
});

const updateEnrollmentSchema = z.object({
  status: z.nativeEnum(SupportEnrollmentStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const logMealDistributionSchema = z.object({
  supportProgramId: z.string().optional(),
  studentSupportEnrollmentId: z.string().optional(),
  studentSupportEnrollmentIds: z.array(z.string()).optional(),
  date: z.string().min(1, "Date is required (YYYY-MM-DD)"),
  notes: z.string().optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. STUDENT / PARENT VIEW: GET /api/v1/student-support/my-support
// Strictly restricted to the requesting student / parent's linked children
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/my-support",
  authorize(Role.STUDENT, Role.PARENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const role = req.user.role;

      let studentProfileIds: string[] = [];

      if (role === Role.STUDENT) {
        const studentProfile = await db.studentProfile.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (studentProfile) {
          studentProfileIds = [studentProfile.id];
        }
      } else if (role === Role.PARENT) {
        const parentProfile = await db.parentProfile.findUnique({
          where: { userId },
          include: {
            studentLinks: { select: { studentProfileId: true } },
          },
        });
        if (parentProfile) {
          studentProfileIds = parentProfile.studentLinks.map(
            (l) => l.studentProfileId
          );
        }
      }

      if (studentProfileIds.length === 0) {
        return sendSuccess(res, { enrollments: [] });
      }

      const enrollments = await db.studentSupportEnrollment.findMany({
        where: {
          studentProfileId: { in: studentProfileIds },
          supportProgram: { schoolId },
        },
        include: {
          supportProgram: true,
          studentProfile: {
            include: {
              user: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  avatar: true,
                },
              },
              class: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      sendSuccess(res, { enrollments });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/v1/student-support/programs
// List all support programs (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/programs",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { type, academicYear, isActive, search } = req.query;

      const where: any = { schoolId };

      if (type && Object.values(SupportProgramType).includes(type as any)) {
        where.type = type as SupportProgramType;
      }
      if (academicYear) {
        where.academicYear = academicYear as string;
      }
      if (isActive !== undefined && isActive !== "ALL") {
        where.isActive = isActive === "true";
      }
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
        ];
      }

      const programs = await db.supportProgram.findMany({
        where,
        include: {
          _count: {
            select: {
              enrollments: true,
            },
          },
          enrollments: {
            where: { status: SupportEnrollmentStatus.ACTIVE },
            select: { id: true },
          },
        },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      });

      const formatted = programs.map((p) => ({
        ...p,
        totalEnrollments: p._count.enrollments,
        activeEnrollments: p.enrollments.length,
      }));

      sendSuccess(res, { programs: formatted });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/v1/student-support/programs
// Create a new support program (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/programs",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const body = createProgramSchema.parse(req.body);

      const program = await db.supportProgram.create({
        data: {
          schoolId,
          type: body.type,
          name: body.name,
          description: body.description ?? null,
          waiverPercent: body.waiverPercent ?? null,
          academicYear: body.academicYear ?? null,
          isActive: body.isActive !== undefined ? body.isActive : true,
        },
      });

      sendCreated(res, {
        message: "Support program created successfully",
        program,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/v1/student-support/programs/:id
// Get a single support program details (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/programs/:id",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const program = await db.supportProgram.findFirst({
        where: { id, schoolId },
        include: {
          enrollments: {
            include: {
              studentProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      middleName: true,
                      lastName: true,
                      avatar: true,
                      email: true,
                      phone: true,
                    },
                  },
                  class: { select: { id: true, name: true } },
                  gradeLevel: { select: { id: true, name: true } },
                },
              },
              approvedBy: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!program) throw new AppError("Support program not found", 404);

      sendSuccess(res, { program });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. PATCH /api/v1/student-support/programs/:id
// Update a support program (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/programs/:id",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const program = await db.supportProgram.findFirst({
        where: { id, schoolId },
      });
      if (!program) throw new AppError("Support program not found", 404);

      const body = updateProgramSchema.parse(req.body);

      const updated = await db.supportProgram.update({
        where: { id },
        data: {
          name: body.name !== undefined ? body.name : program.name,
          type: body.type !== undefined ? body.type : program.type,
          description:
            body.description !== undefined ? body.description : program.description,
          waiverPercent:
            body.waiverPercent !== undefined
              ? body.waiverPercent
              : program.waiverPercent,
          academicYear:
            body.academicYear !== undefined
              ? body.academicYear
              : program.academicYear,
          isActive:
            body.isActive !== undefined ? body.isActive : program.isActive,
        },
      });

      sendSuccess(res, {
        message: "Support program updated successfully",
        program: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. DELETE /api/v1/student-support/programs/:id
// Delete a support program (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/programs/:id",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const program = await db.supportProgram.findFirst({
        where: { id, schoolId },
      });
      if (!program) throw new AppError("Support program not found", 404);

      await db.supportProgram.delete({ where: { id } });

      sendSuccess(res, { message: "Support program deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. GET /api/v1/student-support/enrollments
// List enrollments with sensitive data protection (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/enrollments",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const {
        supportProgramId,
        studentProfileId,
        status,
        type,
        academicYear,
        classId,
        search,
      } = req.query;

      const where: any = {
        supportProgram: { schoolId },
      };

      if (supportProgramId) {
        where.supportProgramId = supportProgramId as string;
      }
      if (studentProfileId) {
        where.studentProfileId = studentProfileId as string;
      }
      if (status && Object.values(SupportEnrollmentStatus).includes(status as any)) {
        where.status = status as SupportEnrollmentStatus;
      }
      if (type && Object.values(SupportProgramType).includes(type as any)) {
        where.supportProgram = {
          ...where.supportProgram,
          type: type as SupportProgramType,
        };
      }
      if (academicYear) {
        where.supportProgram = {
          ...where.supportProgram,
          academicYear: academicYear as string,
        };
      }
      if (classId) {
        where.studentProfile = {
          classId: classId as string,
        };
      }

      if (search) {
        where.OR = [
          {
            studentProfile: {
              user: {
                OR: [
                  { firstName: { contains: search as string, mode: "insensitive" } },
                  { lastName: { contains: search as string, mode: "insensitive" } },
                ],
              },
            },
          },
          {
            studentProfile: {
              admissionNumber: { contains: search as string, mode: "insensitive" },
            },
          },
          {
            supportProgram: {
              name: { contains: search as string, mode: "insensitive" },
            },
          },
        ];
      }

      const enrollments = await db.studentSupportEnrollment.findMany({
        where,
        include: {
          supportProgram: true,
          studentProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  avatar: true,
                  email: true,
                  phone: true,
                },
              },
              class: { select: { id: true, name: true } },
              gradeLevel: { select: { id: true, name: true } },
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });

      sendSuccess(res, {
        total: enrollments.length,
        enrollments,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/v1/student-support/enrollments
// Enroll a single student in a support program (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/enrollments",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const approvedById = req.user.id;

      const body = createEnrollmentSchema.parse(req.body);

      // Verify program belongs to this school
      const program = await db.supportProgram.findFirst({
        where: { id: body.supportProgramId, schoolId },
      });
      if (!program) throw new AppError("Support program not found", 404);

      // Verify student belongs to this school
      const student = await db.studentProfile.findFirst({
        where: { id: body.studentProfileId, user: { schoolId } },
      });
      if (!student) throw new AppError("Student profile not found", 404);

      // Check if already actively enrolled in this program
      const existing = await db.studentSupportEnrollment.findFirst({
        where: {
          studentProfileId: body.studentProfileId,
          supportProgramId: body.supportProgramId,
          status: SupportEnrollmentStatus.ACTIVE,
        },
      });
      if (existing) {
        throw new AppError(
          "Student is already actively enrolled in this program",
          409
        );
      }

      const enrollment = await db.studentSupportEnrollment.create({
        data: {
          studentProfileId: body.studentProfileId,
          supportProgramId: body.supportProgramId,
          status: SupportEnrollmentStatus.ACTIVE,
          startDate: body.startDate ? new Date(body.startDate) : new Date(),
          endDate: body.endDate ? new Date(body.endDate) : null,
          notes: body.notes ?? null,
          approvedById,
        },
        include: {
          supportProgram: true,
          studentProfile: {
            include: {
              user: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                },
              },
              class: { select: { name: true } },
            },
          },
          approvedBy: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
      });

      sendCreated(res, {
        message: "Student enrolled in support program successfully",
        enrollment,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. POST /api/v1/student-support/enrollments/bulk
// Bulk enroll multiple students into a support program (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/enrollments/bulk",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const approvedById = req.user.id;

      const body = bulkEnrollSchema.parse(req.body);

      const program = await db.supportProgram.findFirst({
        where: { id: body.supportProgramId, schoolId },
      });
      if (!program) throw new AppError("Support program not found", 404);

      const uniqueStudentIds = Array.from(new Set(body.studentProfileIds));

      // Verify students belong to this school
      const validStudents = await db.studentProfile.findMany({
        where: {
          id: { in: uniqueStudentIds },
          user: { schoolId },
        },
        select: { id: true },
      });

      const validIds = validStudents.map((s) => s.id);
      if (validIds.length === 0) {
        throw new AppError("No valid student profiles found", 400);
      }

      // Check existing active enrollments
      const existingEnrollments = await db.studentSupportEnrollment.findMany({
        where: {
          supportProgramId: body.supportProgramId,
          studentProfileId: { in: validIds },
          status: SupportEnrollmentStatus.ACTIVE,
        },
        select: { studentProfileId: true },
      });

      const existingSet = new Set(
        existingEnrollments.map((e) => e.studentProfileId)
      );
      const toCreateIds = validIds.filter((id) => !existingSet.has(id));

      if (toCreateIds.length === 0) {
        return sendSuccess(res, {
          message: "All selected students are already enrolled in this program",
          createdCount: 0,
          skippedCount: existingSet.size,
        });
      }

      const startDate = body.startDate ? new Date(body.startDate) : new Date();

      const created = await Promise.all(
        toCreateIds.map((studentProfileId) =>
          db.studentSupportEnrollment.create({
            data: {
              studentProfileId,
              supportProgramId: body.supportProgramId,
              status: SupportEnrollmentStatus.ACTIVE,
              startDate,
              notes: body.notes ?? null,
              approvedById,
            },
          })
        )
      );

      sendCreated(res, {
        message: `Successfully enrolled ${created.length} students into ${program.name}`,
        createdCount: created.length,
        skippedCount: existingSet.size,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. PATCH /api/v1/student-support/enrollments/:id
// Update enrollment status / notes / endDate (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/enrollments/:id",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const enrollment = await db.studentSupportEnrollment.findFirst({
        where: { id, supportProgram: { schoolId } },
      });
      if (!enrollment) throw new AppError("Enrollment record not found", 404);

      const body = updateEnrollmentSchema.parse(req.body);

      const updated = await db.studentSupportEnrollment.update({
        where: { id },
        data: {
          status: body.status !== undefined ? body.status : enrollment.status,
          startDate:
            body.startDate !== undefined
              ? new Date(body.startDate)
              : enrollment.startDate,
          endDate:
            body.endDate !== undefined
              ? body.endDate
                ? new Date(body.endDate)
                : null
              : enrollment.endDate,
          notes: body.notes !== undefined ? body.notes : enrollment.notes,
        },
        include: {
          supportProgram: true,
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
      });

      sendSuccess(res, {
        message: "Enrollment updated successfully",
        enrollment: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 11. DELETE /api/v1/student-support/enrollments/:id
// Remove an enrollment (Admin / Finance only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/enrollments/:id",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const enrollment = await db.studentSupportEnrollment.findFirst({
        where: { id, supportProgram: { schoolId } },
      });
      if (!enrollment) throw new AppError("Enrollment record not found", 404);

      await db.studentSupportEnrollment.delete({ where: { id } });

      sendSuccess(res, { message: "Enrollment removed successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 12. POST /api/v1/student-support/enrollments/:id/apply-waiver
// Explicitly applies the fee waiver percentage to student's pending invoices
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/enrollments/:id/apply-waiver",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const enrollment = await db.studentSupportEnrollment.findFirst({
        where: { id, supportProgram: { schoolId } },
        include: {
          supportProgram: true,
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
      });

      if (!enrollment) throw new AppError("Enrollment not found", 404);

      const waiverPercent = enrollment.supportProgram.waiverPercent;
      if (waiverPercent === null || waiverPercent === undefined || waiverPercent <= 0) {
        throw new AppError(
          "This support program does not have a fee waiver percentage configured",
          400
        );
      }

      // Fetch pending or partial invoices for this student
      const invoices = await db.feeInvoice.findMany({
        where: {
          schoolId,
          studentProfileId: enrollment.studentProfileId,
          status: { in: [FeeStatus.PENDING, FeeStatus.PARTIAL] },
        },
      });

      if (invoices.length === 0) {
        return sendSuccess(res, {
          message: "No pending or partially paid invoices found for this student",
          updatedInvoicesCount: 0,
          totalWaivedAmount: 0,
        });
      }

      let totalWaivedAmount = 0;
      const updatedInvoices: any[] = [];

      for (const invoice of invoices) {
        // Calculate new discount and tax
        const discountAmount = (invoice.amount * waiverPercent) / 100;
        const netBase = Math.max(0, invoice.amount - discountAmount);
        const taxAmount = (netBase * invoice.taxRate) / 100;
        const totalPayable = netBase + taxAmount;
        const balanceRemaining = Math.max(0, totalPayable - invoice.paidAmount);

        let newStatus = invoice.status;
        if (balanceRemaining === 0) {
          newStatus = waiverPercent === 100 ? FeeStatus.WAIVED : FeeStatus.PAID;
        } else if (invoice.paidAmount > 0) {
          newStatus = FeeStatus.PARTIAL;
        } else {
          newStatus = FeeStatus.PENDING;
        }

        const updated = await db.feeInvoice.update({
          where: { id: invoice.id },
          data: {
            discountType: "PERCENT",
            discount: waiverPercent,
            taxAmount,
            status: newStatus,
            notes: [
              invoice.notes,
              `[${new Date().toLocaleDateString()}] ${waiverPercent}% waiver applied via ${enrollment.supportProgram.name}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        });

        totalWaivedAmount += discountAmount;
        updatedInvoices.push(updated);
      }

      const studentName = [
        enrollment.studentProfile.user.firstName,
        enrollment.studentProfile.user.middleName,
        enrollment.studentProfile.user.lastName,
      ]
        .filter(Boolean)
        .join(" ");

      sendSuccess(res, {
        message: `Successfully applied ${waiverPercent}% waiver (${totalWaivedAmount.toLocaleString()} ETB) to ${updatedInvoices.length} invoice(s) for ${studentName}`,
        updatedInvoicesCount: updatedInvoices.length,
        totalWaivedAmount,
        invoices: updatedInvoices,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 13. POST /api/v1/student-support/meal-distribution
// Log daily meal distribution per enrolled student or bulk for program on date
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/meal-distribution",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const recordedById = req.user.id;

      const body = logMealDistributionSchema.parse(req.body);
      const logDate = new Date(body.date);

      let enrollmentIds: string[] = [];

      if (body.studentSupportEnrollmentId) {
        enrollmentIds = [body.studentSupportEnrollmentId];
      } else if (
        body.studentSupportEnrollmentIds &&
        body.studentSupportEnrollmentIds.length > 0
      ) {
        enrollmentIds = body.studentSupportEnrollmentIds;
      } else if (body.supportProgramId) {
        // Fetch all active enrollments for this meal support program
        const activeEnrollments = await db.studentSupportEnrollment.findMany({
          where: {
            supportProgramId: body.supportProgramId,
            supportProgram: { schoolId, type: SupportProgramType.MEAL_SUPPORT },
            status: SupportEnrollmentStatus.ACTIVE,
          },
          select: { id: true },
        });
        enrollmentIds = activeEnrollments.map((e) => e.id);
      }

      if (enrollmentIds.length === 0) {
        throw new AppError(
          "No enrolled students specified for meal distribution logging",
          400
        );
      }

      const results = await Promise.all(
        enrollmentIds.map((studentSupportEnrollmentId) =>
          db.mealDistributionRecord.upsert({
            where: {
              studentSupportEnrollmentId_date: {
                studentSupportEnrollmentId,
                date: logDate,
              },
            },
            create: {
              studentSupportEnrollmentId,
              date: logDate,
              recordedById,
              notes: body.notes ?? null,
            },
            update: {
              recordedById,
              notes: body.notes !== undefined ? body.notes : undefined,
            },
          })
        )
      );

      sendSuccess(res, {
        message: `Logged meal distribution for ${results.length} student(s) on ${body.date}`,
        count: results.length,
        records: results,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 14. GET /api/v1/student-support/meal-distribution
// Query meal distribution logs for reporting / daily checklist view
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/meal-distribution",
  authorize(...isAuthorizedStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { supportProgramId, date, startDate, endDate } = req.query;

      const where: any = {
        enrollment: {
          supportProgram: { schoolId },
        },
      };

      if (supportProgramId) {
        where.enrollment.supportProgramId = supportProgramId as string;
      }
      if (date) {
        where.date = new Date(date as string);
      } else if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate as string);
        if (endDate) where.date.lte = new Date(endDate as string);
      }

      const records = await db.mealDistributionRecord.findMany({
        where,
        include: {
          enrollment: {
            include: {
              studentProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      middleName: true,
                      lastName: true,
                      avatar: true,
                    },
                  },
                  class: { select: { id: true, name: true } },
                },
              },
              supportProgram: { select: { id: true, name: true, type: true } },
            },
          },
        },
        orderBy: { date: "desc" },
      });

      sendSuccess(res, {
        total: records.length,
        records,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
