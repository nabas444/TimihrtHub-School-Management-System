import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  Role,
  EmploymentType,
  RequisitionStatus,
  PostingStatus,
  ApplicationStage,
  InterviewFormat,
  InterviewRecommendation,
  OfferStatus,
  EmployeeStatus,
} from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { generateJobOfferLetterPdf } from "../../utils/pdf";

export const protectedRecruitingRouter = Router();
export const publicRecruitingRouter = Router();

const adminGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

// ─────────────────────────────────────────────────────────────────────────────
// 1. PUBLIC JOB BOARD (NO AUTH REQUIRED)
// ─────────────────────────────────────────────────────────────────────────────

publicRecruitingRouter.get("/:schoolSlug/jobs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { schoolSlug } = req.params;

    const school = await db.school.findFirst({
      where: {
        OR: [{ id: schoolSlug }, { name: { equals: schoolSlug.replace(/-/g, " "), mode: "insensitive" } }],
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        email: true,
        phone: true,
        website: true,
      },
    });

    if (!school) {
      throw new AppError("School not found or inactive", 404);
    }

    const postings = await db.jobPosting.findMany({
      where: {
        schoolId: school.id,
        status: PostingStatus.PUBLISHED,
        OR: [{ closingDate: null }, { closingDate: { gte: new Date() } }],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        employmentType: true,
        location: true,
        description: true,
        requirements: true,
        benefits: true,
        salaryRange: true,
        closingDate: true,
        publishedAt: true,
        department: { select: { value: true } },
        position: { select: { value: true } },
      },
      orderBy: { publishedAt: "desc" },
    });

    return sendSuccess(res, { school, postings });
  } catch (err) {
    next(err);
  }
});

publicRecruitingRouter.get("/:schoolSlug/jobs/:idOrSlug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { schoolSlug, idOrSlug } = req.params;

    const school = await db.school.findFirst({
      where: {
        OR: [{ id: schoolSlug }, { name: { equals: schoolSlug.replace(/-/g, " "), mode: "insensitive" } }],
      },
      select: { id: true, name: true, city: true, country: true },
    });

    if (!school) throw new AppError("School not found", 404);

    const posting = await db.jobPosting.findFirst({
      where: {
        schoolId: school.id,
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        status: PostingStatus.PUBLISHED,
      },
      include: {
        department: { select: { value: true } },
        position: { select: { value: true } },
      },
    });

    if (!posting) throw new AppError("Job posting not found or is no longer open", 404);

    return sendSuccess(res, { school, posting });
  } catch (err) {
    next(err);
  }
});

const applyJobSchema = z.object({
  candidateName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().nullable(),
  resumeUrl: z.string().optional().nullable(),
  coverLetter: z.string().optional().nullable(),
  portfolioUrl: z.string().optional().nullable(),
  experienceYears: z.number().optional().nullable(),
  currentEmployer: z.string().optional().nullable(),
  highestEducation: z.string().optional().nullable(),
});

publicRecruitingRouter.post("/:schoolSlug/jobs/:id/apply", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { schoolSlug, id: postingId } = req.params;
    const data = applyJobSchema.parse(req.body);

    const school = await db.school.findFirst({
      where: {
        OR: [{ id: schoolSlug }, { name: { equals: schoolSlug.replace(/-/g, " "), mode: "insensitive" } }],
      },
    });
    if (!school) throw new AppError("School not found", 404);

    const posting = await db.jobPosting.findFirst({
      where: { id: postingId, schoolId: school.id, status: PostingStatus.PUBLISHED },
    });
    if (!posting) throw new AppError("Job posting not found or is closed", 404);

    const application = await db.jobApplication.create({
      data: {
        schoolId: school.id,
        postingId: posting.id,
        candidateName: data.candidateName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        resumeUrl: data.resumeUrl || null,
        coverLetter: data.coverLetter || null,
        portfolioUrl: data.portfolioUrl || null,
        experienceYears: data.experienceYears ?? null,
        currentEmployer: data.currentEmployer || null,
        highestEducation: data.highestEducation || null,
        stage: ApplicationStage.APPLIED,
      },
    });

    return sendCreated(
      res,
      { applicationId: application.id, candidateName: application.candidateName },
      "Application submitted successfully. Our hiring team will review your submission.",
    );
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROTECTED RECRUITING PIPELINE & HR API
// ─────────────────────────────────────────────────────────────────────────────

// Dashboard KPI Analytics
protectedRecruitingRouter.get(
  "/dashboard",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;

      const [
        openRequisitionsCount,
        activePostingsCount,
        totalApplications,
        stageCountsRaw,
        upcomingInterviews,
        recentOffers,
      ] = await Promise.all([
        db.jobRequisition.count({
          where: { schoolId, status: { in: [RequisitionStatus.APPROVED, RequisitionStatus.PENDING_APPROVAL] } },
        }),
        db.jobPosting.count({
          where: { schoolId, status: PostingStatus.PUBLISHED },
        }),
        db.jobApplication.count({ where: { schoolId } }),
        db.jobApplication.groupBy({
          by: ["stage"],
          where: { schoolId },
          _count: { id: true },
        }),
        db.jobInterview.findMany({
          where: {
            schoolId,
            scheduledAt: { gte: new Date() },
          },
          include: {
            application: {
              select: {
                id: true,
                candidateName: true,
                email: true,
                posting: { select: { title: true } },
              },
            },
          },
          take: 6,
          orderBy: { scheduledAt: "asc" },
        }),
        db.jobOffer.findMany({
          where: { schoolId },
          include: {
            application: {
              select: {
                id: true,
                candidateName: true,
                email: true,
              },
            },
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const stageBreakdown: Record<string, number> = {
        APPLIED: 0,
        SCREENING: 0,
        INTERVIEW: 0,
        OFFER: 0,
        HIRED: 0,
        REJECTED: 0,
      };

      for (const item of stageCountsRaw) {
        stageBreakdown[item.stage] = item._count.id;
      }

      return sendSuccess(res, {
        metrics: {
          openRequisitionsCount,
          activePostingsCount,
          totalApplications,
          hiredCount: stageBreakdown.HIRED,
        },
        stageBreakdown,
        upcomingInterviews,
        recentOffers,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// JOB REQUISITIONS
// ─────────────────────────────────────────────────────────────────────────────

protectedRecruitingRouter.get(
  "/requisitions",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const status = req.query.status as RequisitionStatus | undefined;
      const departmentId = req.query.departmentId as string | undefined;

      const requisitions = await db.jobRequisition.findMany({
        where: {
          schoolId,
          ...(status && { status }),
          ...(departmentId && { departmentId }),
        },
        include: {
          department: { select: { id: true, value: true, colorHex: true } },
          position: { select: { id: true, value: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { postings: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return sendSuccess(res, requisitions);
    } catch (err) {
      next(err);
    }
  },
);

const createRequisitionSchema = z.object({
  title: z.string().min(2, "Job title is required"),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  vacanciesCount: z.number().min(1).default(1),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  reason: z.string().optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  justification: z.string().optional().nullable(),
  targetStartDate: z.string().optional().nullable(),
  autoApprove: z.boolean().default(false),
});

protectedRecruitingRouter.post(
  "/requisitions",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const data = createRequisitionSchema.parse(req.body);

      const count = await db.jobRequisition.count({ where: { schoolId } });
      const year = new Date().getFullYear();
      const requisitionNumber = `REQ-${year}-${String(count + 1).padStart(3, "0")}`;

      const requisition = await db.jobRequisition.create({
        data: {
          schoolId,
          requisitionNumber,
          title: data.title,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          vacanciesCount: data.vacanciesCount,
          employmentType: data.employmentType,
          reason: data.reason || null,
          salaryMin: data.salaryMin ?? null,
          salaryMax: data.salaryMax ?? null,
          description: data.description || null,
          justification: data.justification || null,
          targetStartDate: data.targetStartDate ? new Date(data.targetStartDate) : null,
          status: data.autoApprove ? RequisitionStatus.APPROVED : RequisitionStatus.PENDING_APPROVAL,
          requestedById: req.user.id,
          approvedById: data.autoApprove ? req.user.id : null,
          approvedAt: data.autoApprove ? new Date() : null,
        },
        include: {
          department: true,
          position: true,
        },
      });

      return sendCreated(res, requisition, "Job requisition created successfully");
    } catch (err) {
      next(err);
    }
  },
);

protectedRecruitingRouter.post(
  "/requisitions/:id/approve",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const { approved, rejectionReason } = req.body;

      const reqRecord = await db.jobRequisition.findFirst({ where: { id, schoolId } });
      if (!reqRecord) throw new AppError("Requisition not found", 404);

      const updated = await db.jobRequisition.update({
        where: { id },
        data: {
          status: approved ? RequisitionStatus.APPROVED : RequisitionStatus.REJECTED,
          approvedById: approved ? req.user.id : null,
          approvedAt: approved ? new Date() : null,
          rejectionReason: !approved ? rejectionReason || "Rejected by administrator" : null,
        },
      });

      return sendSuccess(res, updated, approved ? "Requisition approved" : "Requisition rejected");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// JOB POSTINGS
// ─────────────────────────────────────────────────────────────────────────────

protectedRecruitingRouter.get(
  "/postings",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const status = req.query.status as PostingStatus | undefined;

      const postings = await db.jobPosting.findMany({
        where: {
          schoolId,
          ...(status && { status }),
        },
        include: {
          department: { select: { id: true, value: true, colorHex: true } },
          position: { select: { id: true, value: true } },
          requisition: { select: { id: true, requisitionNumber: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return sendSuccess(res, postings);
    } catch (err) {
      next(err);
    }
  },
);

const createPostingSchema = z.object({
  title: z.string().min(2, "Title is required"),
  requisitionId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  location: z.string().optional().nullable(),
  description: z.string().min(10, "Job description is required"),
  requirements: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),
  salaryRange: z.string().optional().nullable(),
  closingDate: z.string().optional().nullable(),
  publishNow: z.boolean().default(false),
});

protectedRecruitingRouter.post(
  "/postings",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const data = createPostingSchema.parse(req.body);

      // Generate clean slug
      const rawSlug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const slug = `${rawSlug}-${randomSuffix}`;

      const posting = await db.jobPosting.create({
        data: {
          schoolId,
          requisitionId: data.requisitionId || null,
          title: data.title,
          slug,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          employmentType: data.employmentType,
          location: data.location || "Main Campus",
          description: data.description,
          requirements: data.requirements || null,
          benefits: data.benefits || null,
          salaryRange: data.salaryRange || null,
          closingDate: data.closingDate ? new Date(data.closingDate) : null,
          status: data.publishNow ? PostingStatus.PUBLISHED : PostingStatus.DRAFT,
          publishedAt: data.publishNow ? new Date() : null,
        },
        include: {
          department: true,
          position: true,
        },
      });

      return sendCreated(res, posting, "Job posting created successfully");
    } catch (err) {
      next(err);
    }
  },
);

protectedRecruitingRouter.patch(
  "/postings/:id",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const data = createPostingSchema.partial().parse(req.body);

      const existing = await db.jobPosting.findFirst({ where: { id, schoolId } });
      if (!existing) throw new AppError("Posting not found", 404);

      const updated = await db.jobPosting.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.departmentId !== undefined && { departmentId: data.departmentId || null }),
          ...(data.positionId !== undefined && { positionId: data.positionId || null }),
          ...(data.employmentType !== undefined && { employmentType: data.employmentType }),
          ...(data.location !== undefined && { location: data.location || null }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.requirements !== undefined && { requirements: data.requirements || null }),
          ...(data.benefits !== undefined && { benefits: data.benefits || null }),
          ...(data.salaryRange !== undefined && { salaryRange: data.salaryRange || null }),
          ...(data.closingDate !== undefined && {
            closingDate: data.closingDate ? new Date(data.closingDate) : null,
          }),
          ...(data.publishNow !== undefined && {
            status: data.publishNow ? PostingStatus.PUBLISHED : PostingStatus.DRAFT,
            publishedAt: data.publishNow ? new Date() : existing.publishedAt,
          }),
        },
      });

      return sendSuccess(res, updated, "Job posting updated");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// APPLICANT TRACKING PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

protectedRecruitingRouter.get(
  "/applications",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
      const skip = (page - 1) * limit;

      const postingId = req.query.postingId as string | undefined;
      const stage = req.query.stage as ApplicationStage | undefined;
      const search = req.query.search as string | undefined;

      const where: any = {
        schoolId,
        ...(postingId && { postingId }),
        ...(stage && { stage }),
        ...(search && {
          OR: [
            { candidateName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }),
      };

      const [applications, total] = await Promise.all([
        db.jobApplication.findMany({
          where,
          skip,
          take: limit,
          include: {
            posting: {
              select: {
                id: true,
                title: true,
                department: { select: { value: true } },
                position: { select: { value: true } },
              },
            },
            interviews: {
              select: {
                id: true,
                title: true,
                scheduledAt: true,
                format: true,
                feedbacks: { select: { score: true, recommendation: true } },
              },
            },
            offers: {
              select: {
                id: true,
                offerNumber: true,
                offeredSalary: true,
                status: true,
              },
            },
            hiredEmployee: {
              select: {
                id: true,
                employeeNumber: true,
              },
            },
          },
          orderBy: { appliedAt: "desc" },
        }),
        db.jobApplication.count({ where }),
      ]);

      return sendSuccess(
        res,
        applications,
        "Applications retrieved successfully",
        200,
        paginationMeta(page, limit, total),
      );
    } catch (err) {
      next(err);
    }
  },
);

protectedRecruitingRouter.get(
  "/applications/:id",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;

      const application = await db.jobApplication.findFirst({
        where: { id, schoolId },
        include: {
          posting: {
            include: {
              department: true,
              position: true,
            },
          },
          interviews: {
            include: {
              feedbacks: {
                include: {
                  interviewer: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
            orderBy: { scheduledAt: "asc" },
          },
          offers: {
            orderBy: { createdAt: "desc" },
          },
          hiredEmployee: true,
        },
      });

      if (!application) throw new AppError("Application not found", 404);

      return sendSuccess(res, application);
    } catch (err) {
      next(err);
    }
  },
);

protectedRecruitingRouter.patch(
  "/applications/:id/stage",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const { stage, rating, notes, rejectionReason } = req.body;

      const application = await db.jobApplication.findFirst({ where: { id, schoolId } });
      if (!application) throw new AppError("Application not found", 404);

      const updated = await db.jobApplication.update({
        where: { id },
        data: {
          ...(stage && { stage: stage as ApplicationStage }),
          ...(rating !== undefined && { rating }),
          ...(notes !== undefined && { notes }),
          ...(rejectionReason !== undefined && { rejectionReason }),
        },
      });

      return sendSuccess(res, updated, `Candidate moved to ${stage || "updated stage"}`);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEW SCHEDULING & STRUCTURED FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────

const scheduleInterviewSchema = z.object({
  title: z.string().min(2, "Interview title required"),
  scheduledAt: z.string().min(1, "Date and time required"),
  durationMinutes: z.number().min(15).default(45),
  format: z.nativeEnum(InterviewFormat).default(InterviewFormat.IN_PERSON),
  locationOrLink: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  interviewerIds: z.array(z.string().uuid()).optional(),
});

protectedRecruitingRouter.post(
  "/applications/:id/interviews",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: applicationId } = req.params;
      const data = scheduleInterviewSchema.parse(req.body);

      const application = await db.jobApplication.findFirst({ where: { id: applicationId, schoolId } });
      if (!application) throw new AppError("Application not found", 404);

      const interview = await db.jobInterview.create({
        data: {
          schoolId,
          applicationId,
          title: data.title,
          scheduledAt: new Date(data.scheduledAt),
          durationMinutes: data.durationMinutes,
          format: data.format,
          locationOrLink: data.locationOrLink || null,
          notes: data.notes || null,
          ...(data.interviewerIds && data.interviewerIds.length > 0 && {
            interviewers: {
              connect: data.interviewerIds.map((uid) => ({ id: uid })),
            },
          }),
        },
        include: {
          interviewers: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Auto-update application stage to INTERVIEW if still in APPLIED/SCREENING
      if (
        application.stage === ApplicationStage.APPLIED ||
        application.stage === ApplicationStage.SCREENING
      ) {
        await db.jobApplication.update({
          where: { id: applicationId },
          data: { stage: ApplicationStage.INTERVIEW },
        });
      }

      return sendCreated(res, interview, "Interview scheduled successfully");
    } catch (err) {
      next(err);
    }
  },
);

const submitFeedbackSchema = z.object({
  score: z.number().min(1).max(5),
  recommendation: z.nativeEnum(InterviewRecommendation).default(InterviewRecommendation.HOLD),
  criteriaScores: z.any().optional(),
  strengths: z.string().optional().nullable(),
  concerns: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

protectedRecruitingRouter.post(
  "/interviews/:id/feedback",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: interviewId } = req.params;
      const data = submitFeedbackSchema.parse(req.body);

      const interview = await db.jobInterview.findFirst({
        where: { id: interviewId, schoolId },
      });
      if (!interview) throw new AppError("Interview not found", 404);

      const feedback = await db.interviewFeedback.upsert({
        where: {
          interviewId_interviewerId: {
            interviewId,
            interviewerId: req.user.id,
          },
        },
        update: {
          score: data.score,
          recommendation: data.recommendation,
          criteriaScores: data.criteriaScores || null,
          strengths: data.strengths || null,
          concerns: data.concerns || null,
          notes: data.notes || null,
        },
        create: {
          interviewId,
          interviewerId: req.user.id,
          score: data.score,
          recommendation: data.recommendation,
          criteriaScores: data.criteriaScores || null,
          strengths: data.strengths || null,
          concerns: data.concerns || null,
          notes: data.notes || null,
        },
      });

      return sendSuccess(res, feedback, "Structured feedback submitted");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// JOB OFFERS & HIRE CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

const createOfferSchema = z.object({
  positionTitle: z.string().min(1, "Position title required"),
  departmentName: z.string().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  offeredSalary: z.number().min(0, "Salary required"),
  salaryPeriod: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
  startDate: z.string().min(1, "Start date required"),
  probationMonths: z.number().default(3),
  benefits: z.string().optional().nullable(),
  conditions: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

protectedRecruitingRouter.post(
  "/applications/:id/offer",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: applicationId } = req.params;
      const data = createOfferSchema.parse(req.body);

      const application = await db.jobApplication.findFirst({
        where: { id: applicationId, schoolId },
      });
      if (!application) throw new AppError("Application not found", 404);

      const count = await db.jobOffer.count({ where: { schoolId } });
      const year = new Date().getFullYear();
      const offerNumber = `OFR-${year}-${String(count + 1).padStart(4, "0")}`;

      const offer = await db.jobOffer.create({
        data: {
          schoolId,
          applicationId,
          offerNumber,
          positionTitle: data.positionTitle,
          departmentName: data.departmentName || null,
          employmentType: data.employmentType,
          offeredSalary: data.offeredSalary,
          salaryPeriod: data.salaryPeriod,
          startDate: new Date(data.startDate),
          probationMonths: data.probationMonths,
          benefits: data.benefits || null,
          conditions: data.conditions || null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          status: OfferStatus.SENT,
          sentAt: new Date(),
          notes: data.notes || null,
        },
      });

      // Update application stage to OFFER
      await db.jobApplication.update({
        where: { id: applicationId },
        data: { stage: ApplicationStage.OFFER },
      });

      return sendCreated(res, offer, "Job offer created and generated");
    } catch (err) {
      next(err);
    }
  },
);

protectedRecruitingRouter.get(
  "/offers/:id/pdf",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;

      const [offer, school] = await Promise.all([
        db.jobOffer.findFirst({
          where: { id, schoolId },
          include: { application: true },
        }),
        db.school.findUnique({
          where: { id: schoolId },
          select: { name: true, address: true, phone: true, email: true },
        }),
      ]);

      if (!offer) throw new AppError("Job offer not found", 404);
      if (!school) throw new AppError("School details not found", 404);

      const pdfBuffer = await generateJobOfferLetterPdf(
        {
          name: school.name,
          address: school.address,
          phone: school.phone,
          email: school.email,
        },
        {
          offerNumber: offer.offerNumber,
          candidateName: offer.application.candidateName,
          candidateEmail: offer.application.email,
          candidatePhone: offer.application.phone,
          positionTitle: offer.positionTitle,
          departmentName: offer.departmentName,
          employmentType: offer.employmentType,
          offeredSalary: offer.offeredSalary,
          salaryPeriod: offer.salaryPeriod,
          startDate: offer.startDate,
          probationMonths: offer.probationMonths,
          benefits: offer.benefits,
          conditions: offer.conditions,
          expiresAt: offer.expiresAt,
        },
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Offer_Letter_${offer.offerNumber}.pdf"`,
      );
      return res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  },
);

protectedRecruitingRouter.patch(
  "/offers/:id/status",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const { status } = req.body;

      const offer = await db.jobOffer.findFirst({ where: { id, schoolId } });
      if (!offer) throw new AppError("Job offer not found", 404);

      const updated = await db.jobOffer.update({
        where: { id },
        data: {
          status: status as OfferStatus,
          acceptedAt: status === OfferStatus.ACCEPTED ? new Date() : offer.acceptedAt,
          declinedAt: status === OfferStatus.DECLINED ? new Date() : offer.declinedAt,
        },
      });

      return sendSuccess(res, updated, `Offer status updated to ${status}`);
    } catch (err) {
      next(err);
    }
  },
);

// ONE-CLICK HIRE CONVERSION: Converts Applicant directly into an Employee record
const convertToHireSchema = z.object({
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  employeeNumber: z.string().optional().nullable(),
  createUserAccount: z.boolean().default(false),
  userRole: z.enum(["TEACHER", "ADMIN", "FINANCE"]).optional(),
  userPassword: z.string().min(6).optional(),
});

protectedRecruitingRouter.post(
  "/offers/:id/convert-to-hire",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: offerId } = req.params;
      const data = convertToHireSchema.parse(req.body);

      const offer = await db.jobOffer.findFirst({
        where: { id: offerId, schoolId },
        include: {
          application: {
            include: {
              posting: true,
            },
          },
        },
      });

      if (!offer) throw new AppError("Offer not found", 404);
      const app = offer.application;

      // Parse candidate names
      const nameParts = app.candidateName.trim().split(" ");
      const firstName = nameParts[0] || "Staff";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Member";

      // Generate employee number
      let employeeNumber = data.employeeNumber?.trim();
      if (!employeeNumber) {
        const empCount = await db.employee.count({ where: { schoolId } });
        const year = new Date().getFullYear();
        employeeNumber = `EMP-${year}-${String(empCount + 1).padStart(4, "0")}`;
      }

      // Execute transaction: create Employee, update Application/Offer, optionally create User
      const result = await db.$transaction(async (tx) => {
        let createdUser: any = null;

        if (data.createUserAccount && data.userRole && data.userPassword) {
          const hashedPassword = await bcrypt.hash(data.userPassword, 12);
          createdUser = await tx.user.create({
            data: {
              schoolId,
              role: data.userRole as Role,
              email: app.email.toLowerCase(),
              password: hashedPassword,
              firstName,
              lastName,
              phone: app.phone || null,
              isActive: true,
            },
          });

          if (data.userRole === Role.TEACHER) {
            await tx.teacherProfile.create({
              data: {
                userId: createdUser.id,
                employeeId: employeeNumber,
                joinedAt: offer.startDate,
              },
            });
          } else if (data.userRole === Role.ADMIN || data.userRole === Role.FINANCE) {
            await tx.adminProfile.create({
              data: {
                userId: createdUser.id,
                employeeId: employeeNumber,
              },
            });
          }
        }

        const employee = await tx.employee.create({
          data: {
            schoolId,
            employeeNumber,
            firstName,
            lastName,
            email: app.email,
            phone: app.phone || null,
            hireDate: offer.startDate,
            employmentType: offer.employmentType,
            status: EmployeeStatus.ACTIVE,
            departmentId: data.departmentId || app.posting.departmentId || null,
            positionId: data.positionId || app.posting.positionId || null,
            managerId: data.managerId || null,
            salary: offer.offeredSalary,
            probationEnd: new Date(
              new Date(offer.startDate).setMonth(
                new Date(offer.startDate).getMonth() + offer.probationMonths,
              ),
            ),
            userId: createdUser?.id || null,
          },
        });

        // Update offer & application
        await tx.jobOffer.update({
          where: { id: offer.id },
          data: { status: OfferStatus.ACCEPTED, acceptedAt: new Date() },
        });

        await tx.jobApplication.update({
          where: { id: app.id },
          data: { stage: ApplicationStage.HIRED, hiredEmployeeId: employee.id },
        });

        // Initialize onboarding checklist
        await tx.onboardingChecklist.create({
          data: {
            schoolId,
            employeeId: employee.id,
            title: `Onboarding: ${employee.firstName} ${employee.lastName}`,
            status: "IN_PROGRESS",
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            items: {
              create: [
                { title: "National ID / Passport Verification", category: "DOCUMENTATION" },
                { title: "Educational Credentials Verification", category: "DOCUMENTATION" },
                { title: "Police Clearance / Background Check", category: "DOCUMENTATION" },
                { title: "Employment Contract Countersigned", category: "DOCUMENTATION" },
                { title: "Staff ID Badge Issuance", category: "LOGISTICS" },
                { title: "School Campus & Dept Orientation", category: "ORIENTATION" },
              ],
            },
          },
        });

        return { employee, user: createdUser };
      });

      return sendCreated(
        res,
        result,
        `Applicant converted to Employee (${result.employee.employeeNumber}) successfully!`,
      );
    } catch (err) {
      next(err);
    }
  },
);
