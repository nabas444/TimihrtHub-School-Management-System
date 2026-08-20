import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  Role,
  AnnualPlanScope,
  AnnualPlanStatus,
  NotificationType,
} from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated } from "../../utils/response";
import { generateAnnualPlanPdf, AnnualPlanPdfData } from "../../utils/pdf";
import { emitToUser } from "../../config/socket";

const router = Router();

const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];
const isSchoolAdminRole = [Role.ADMIN, Role.SUPER_ADMIN];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const createPlanSchema = z.object({
  title: z.string().min(1, "Title is required"),
  scope: z.nativeEnum(AnnualPlanScope),
  academicYear: z.string().min(1, "Academic Year is required"),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
  gradeLevelId: z.string().optional(),
  columns: z.array(z.string()).min(1, "At least one column is required"),
  rows: z.array(z.any()).default([]),
});

const updatePlanSchema = z.object({
  title: z.string().min(1).optional(),
  academicYear: z.string().optional(),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
  gradeLevelId: z.string().optional(),
  columns: z.array(z.string()).optional(),
  rows: z.array(z.any()).optional(),
});

const reviewPlanSchema = z.object({
  decision: z.enum(["APPROVED", "REVISION_REQUESTED"]),
  notes: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/v1/annual-plans/my-teachings
// Returns teacher's real subjectTeachings for quick dropdown selection
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/my-teachings",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;

      const teacher = await db.teacherProfile.findUnique({
        where: { userId },
        include: {
          subjectTeachings: {
            include: {
              subject: true,
              class: {
                include: { gradeLevel: true },
              },
            },
          },
        },
      });

      if (!teacher) {
        return sendSuccess(res, { teachings: [] });
      }

      sendSuccess(res, {
        teacherProfileId: teacher.id,
        teachings: teacher.subjectTeachings,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/v1/annual-plans
// Lists plans filterable by status, scope, academicYear, subjectId
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const role = req.user.role;
      const userId = req.user.id;

      const {
        status,
        scope,
        academicYear,
        subjectId,
        teacherProfileId,
        search,
      } = req.query;

      const where: any = { schoolId };

      if (status && Object.values(AnnualPlanStatus).includes(status as any)) {
        where.status = status as AnnualPlanStatus;
      }
      if (scope && Object.values(AnnualPlanScope).includes(scope as any)) {
        where.scope = scope as AnnualPlanScope;
      }
      if (academicYear) where.academicYear = academicYear as string;
      if (subjectId) where.subjectId = subjectId as string;
      if (teacherProfileId) where.teacherProfileId = teacherProfileId as string;

      if (search) {
        where.OR = [
          { title: { contains: search as string, mode: "insensitive" } },
          { subject: { name: { contains: search as string, mode: "insensitive" } } },
        ];
      }

      // If user is a TEACHER, restrict to plans they authored or are assigned to
      if (role === Role.TEACHER) {
        const teacher = await db.teacherProfile.findUnique({
          where: { userId },
        });

        where.OR = [
          { createdById: userId },
          ...(teacher ? [{ teacherProfileId: teacher.id }] : []),
        ];
      }

      const plans = await db.annualPlan.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              avatar: true,
              role: true,
            },
          },
          teacherProfile: {
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
          subject: true,
          reviewedBy: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      });

      sendSuccess(res, {
        total: plans.length,
        plans,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/v1/annual-plans
// Creates a new annual plan
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const role = req.user.role;

      const body = createPlanSchema.parse(req.body);

      let teacherProfileId: string | null = null;

      if (body.scope === AnnualPlanScope.TEACHER_SUBJECT) {
        if (role === Role.TEACHER) {
          const teacher = await db.teacherProfile.findUnique({
            where: { userId },
          });
          if (!teacher) {
            throw new AppError("Teacher profile not found for current user", 400);
          }
          teacherProfileId = teacher.id;

          // If subjectId provided, verify teacher teaches it
          if (body.subjectId) {
            const teaching = await db.subjectTeaching.findFirst({
              where: {
                teacherProfileId: teacher.id,
                subjectId: body.subjectId,
              },
            });
            if (!teaching) {
              throw new AppError(
                "You can only create subject plans for subjects you are assigned to teach",
                403,
              );
            }
          }
        } else if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
          // Admin can assign a teacherProfileId if provided in body
          if (req.body.teacherProfileId) {
            teacherProfileId = req.body.teacherProfileId;
          }
        }
      }

      const plan = await db.annualPlan.create({
        data: {
          schoolId,
          scope: body.scope,
          createdById: userId,
          teacherProfileId,
          subjectId: body.subjectId || null,
          classId: body.classId || null,
          gradeLevelId: body.gradeLevelId || null,
          academicYear: body.academicYear,
          title: body.title,
          columns: body.columns,
          rows: body.rows,
          status: AnnualPlanStatus.DRAFT,
        },
        include: {
          createdBy: true,
          subject: true,
          teacherProfile: { include: { user: true } },
        },
      });

      sendCreated(res, {
        message: "Annual plan created successfully",
        plan,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/v1/annual-plans/:id
// Fetches a single annual plan
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const plan = await db.annualPlan.findFirst({
        where: { id, schoolId },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              avatar: true,
              role: true,
            },
          },
          teacherProfile: {
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
          subject: true,
          reviewedBy: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
      });

      if (!plan) throw new AppError("Annual plan not found", 404);

      // If classId is set, fetch class details
      let classData = null;
      if (plan.classId) {
        classData = await db.class.findUnique({
          where: { id: plan.classId },
          include: { gradeLevel: true },
        });
      }

      // If gradeLevelId is set, fetch grade level details
      let gradeLevelData = null;
      if (plan.gradeLevelId) {
        gradeLevelData = await db.gradeLevel.findUnique({
          where: { id: plan.gradeLevelId },
        });
      }

      sendSuccess(res, {
        plan: {
          ...plan,
          class: classData,
          gradeLevel: gradeLevelData,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. PUT /api/v1/annual-plans/:id
// Updates plan columns, rows, or metadata
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  "/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const role = req.user.role;

      const plan = await db.annualPlan.findFirst({
        where: { id, schoolId },
      });
      if (!plan) throw new AppError("Annual plan not found", 404);

      // Check edit permissions
      const isSchoolAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
      const isAuthor = plan.createdById === userId;

      if (!isSchoolAdmin && !isAuthor) {
        throw new AppError("You do not have permission to edit this plan", 403);
      }

      // If teacher author, only allowed when DRAFT or REVISION_REQUESTED
      const isDraftOrRevision =
        plan.status === AnnualPlanStatus.DRAFT ||
        plan.status === AnnualPlanStatus.REVISION_REQUESTED;

      if (!isSchoolAdmin && isAuthor && !isDraftOrRevision) {
        throw new AppError(
          "Plan cannot be edited while submitted or approved. Contact an administrator to request revisions.",
          400,
        );
      }

      const body = updatePlanSchema.parse(req.body);

      const updated = await db.annualPlan.update({
        where: { id },
        data: {
          title: body.title !== undefined ? body.title : plan.title,
          academicYear: body.academicYear !== undefined ? body.academicYear : plan.academicYear,
          subjectId: body.subjectId !== undefined ? body.subjectId : plan.subjectId,
          classId: body.classId !== undefined ? body.classId : plan.classId,
          gradeLevelId: body.gradeLevelId !== undefined ? body.gradeLevelId : plan.gradeLevelId,
          columns: body.columns !== undefined ? body.columns : (plan.columns as any),
          rows: body.rows !== undefined ? body.rows : (plan.rows as any),
        },
        include: {
          createdBy: true,
          subject: true,
          teacherProfile: { include: { user: true } },
        },
      });

      sendSuccess(res, {
        message: "Annual plan updated successfully",
        plan: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. DELETE /api/v1/annual-plans/:id
// Deletes a plan
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const role = req.user.role;

      const plan = await db.annualPlan.findFirst({
        where: { id, schoolId },
      });
      if (!plan) throw new AppError("Annual plan not found", 404);

      const isSchoolAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
      const isAuthor = plan.createdById === userId;

      if (!isSchoolAdmin && (!isAuthor || plan.status === AnnualPlanStatus.APPROVED)) {
        throw new AppError("You do not have permission to delete this plan", 403);
      }

      await db.annualPlan.delete({ where: { id } });

      sendSuccess(res, { message: "Annual plan deleted successfully" });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/v1/annual-plans/:id/submit
// Submits plan to admin review queue
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:id/submit",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const role = req.user.role;

      const plan = await db.annualPlan.findFirst({
        where: { id, schoolId },
        include: {
          createdBy: true,
          subject: true,
        },
      });
      if (!plan) throw new AppError("Annual plan not found", 404);

      const isSchoolAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
      if (plan.createdById !== userId && !isSchoolAdmin) {
        throw new AppError("Only the author or an admin can submit this plan", 403);
      }

      const updated = await db.annualPlan.update({
        where: { id },
        data: {
          status: AnnualPlanStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        include: {
          createdBy: true,
          subject: true,
        },
      });

      // Notify school admins
      const admins = await db.user.findMany({
        where: {
          schoolId,
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
          isActive: true,
        },
        select: { id: true },
      });

      const authorName = [
        plan.createdBy.firstName,
        plan.createdBy.middleName,
        plan.createdBy.lastName,
      ]
        .filter(Boolean)
        .join(" ");

      const subjectText = plan.subject?.name ? ` for ${plan.subject.name}` : "";

      for (const admin of admins) {
        await db.notification.create({
          data: {
            schoolId,
            userId: admin.id,
            type: NotificationType.ANNUAL_PLAN,
            title: "Annual Plan Submitted",
            body: `${authorName} submitted an annual curriculum plan "${plan.title}"${subjectText} for administrative review.`,
          },
        });
        emitToUser(admin.id, "notification", {
          type: NotificationType.ANNUAL_PLAN,
          title: "Annual Plan Submitted",
          message: `${authorName} submitted an annual plan for review.`,
        });
      }

      sendSuccess(res, {
        message: "Annual plan submitted for administrative review",
        plan: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/v1/annual-plans/:id/review
// Admin approves or requests revision on plan
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:id/review",
  authorize(...isSchoolAdminRole),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const reviewerId = req.user.id;

      const body = reviewPlanSchema.parse(req.body);

      const plan = await db.annualPlan.findFirst({
        where: { id, schoolId },
        include: { createdBy: true, subject: true },
      });
      if (!plan) throw new AppError("Annual plan not found", 404);

      const targetStatus =
        body.decision === "APPROVED"
          ? AnnualPlanStatus.APPROVED
          : AnnualPlanStatus.REVISION_REQUESTED;

      const updated = await db.annualPlan.update({
        where: { id },
        data: {
          status: targetStatus,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: body.notes || null,
        },
        include: {
          createdBy: true,
          reviewedBy: true,
          subject: true,
        },
      });

      // Notify the teacher / author
      const decisionTitle =
        body.decision === "APPROVED"
          ? "Annual Plan Approved"
          : "Annual Plan Revision Requested";

      const decisionMsg =
        body.decision === "APPROVED"
          ? `Your annual plan "${plan.title}" has been approved by the school administration.`
          : `Your annual plan "${plan.title}" requires revisions. Notes: ${body.notes || "Please check with the admin."}`;

      await db.notification.create({
        data: {
          schoolId,
          userId: plan.createdById,
          type: NotificationType.ANNUAL_PLAN,
          title: decisionTitle,
          body: decisionMsg,
        },
      });

      emitToUser(plan.createdById, "notification", {
        type: NotificationType.ANNUAL_PLAN,
        title: decisionTitle,
        message: decisionMsg,
      });

      sendSuccess(res, {
        message:
          body.decision === "APPROVED"
            ? "Annual plan successfully approved"
            : "Revision requested and returned to author",
        plan: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET|POST /api/v1/annual-plans/:id/pdf
// Streams formatted A4 landscape PDF
// ─────────────────────────────────────────────────────────────────────────────
const handleGeneratePdf = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        logo: true,
        address: true,
        phone: true,
        email: true,
      },
    });
    if (!school) throw new AppError("School not found", 404);

    const plan = await db.annualPlan.findFirst({
      where: { id, schoolId },
      include: {
        createdBy: true,
        teacherProfile: { include: { user: true } },
        subject: true,
        reviewedBy: true,
      },
    });
    if (!plan) throw new AppError("Annual plan not found", 404);

    // Class / Grade info
    let className: string | null = null;
    let gradeLevelName: string | null = null;

    if (plan.classId) {
      const cls = await db.class.findUnique({
        where: { id: plan.classId },
        include: { gradeLevel: true },
      });
      className = cls?.name || null;
      gradeLevelName = cls?.gradeLevel?.name || null;
    } else if (plan.gradeLevelId) {
      const gl = await db.gradeLevel.findUnique({
        where: { id: plan.gradeLevelId },
      });
      gradeLevelName = gl?.name || null;
    }

    const authorName = [
      plan.createdBy.firstName,
      plan.createdBy.middleName,
      plan.createdBy.lastName,
    ]
      .filter(Boolean)
      .join(" ");

    const reviewedByName = plan.reviewedBy
      ? [
          plan.reviewedBy.firstName,
          plan.reviewedBy.middleName,
          plan.reviewedBy.lastName,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

    const pdfData: AnnualPlanPdfData = {
      school: {
        name: school.name,
        logo: school.logo,
        address: school.address,
        phone: school.phone,
        email: school.email,
      },
      plan: {
        id: plan.id,
        title: plan.title,
        scope: plan.scope,
        academicYear: plan.academicYear,
        status: plan.status,
        authorName,
        authorRole: plan.createdBy.role,
        subjectName: plan.subject?.name || null,
        className,
        gradeLevelName,
        columns: (plan.columns as string[]) || [],
        rows: (plan.rows as any[]) || [],
        reviewedByName,
        reviewNotes: plan.reviewNotes,
        submittedAt: plan.submittedAt,
        reviewedAt: plan.reviewedAt,
        createdAt: plan.createdAt,
      },
    };

    const pdfBuffer = await generateAnnualPlanPdf(pdfData);

    const safeTitle = plan.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const filename = `annual-plan-${safeTitle}-${plan.academicYear.replace("/", "-")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

router.get("/:id/pdf", handleGeneratePdf);
router.post("/:id/pdf", handleGeneratePdf);

export default router;
