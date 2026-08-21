import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, ApplicationStatus, StudentStatus, NotificationType } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { admissionsLimiter } from "../../middleware/rateLimiter";
import * as UsersService from "../users/users.service";
import {
  sendApplicationReceivedEmail,
  sendNewApplicationAlertEmail,
  sendApplicantAcceptedWelcomeEmail,
} from "../../jobs/emailWorker";

export const publicAdmissionsRouter = Router();
export const protectedAdmissionsRouter = Router();

const adminGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

// ─────────────────────────────────────────────────────────────────────────────
// 1. PUBLIC ADMISSION ENDPOINTS (NO AUTH REQUIRED)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admissions/public/:schoolSlug/info
publicAdmissionsRouter.get(
  "/:schoolSlug/info",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { schoolSlug } = req.params;

      const school = await db.school.findFirst({
        where: {
          OR: [
            { slug: schoolSlug },
            { id: schoolSlug },
            { name: { equals: schoolSlug.replace(/-/g, " "), mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          address: true,
          city: true,
          country: true,
          phone: true,
          email: true,
          website: true,
          academicYear: true,
          isActive: true,
          gradeLevels: {
            select: { id: true, name: true, level: true },
            orderBy: { level: "asc" },
          },
        },
      });

      if (!school) {
        throw new AppError("School not found", 404);
      }

      sendSuccess(res, {
        id: school.id,
        name: school.name,
        slug: school.slug,
        logo: school.logo,
        address: school.address,
        city: school.city,
        country: school.country,
        phone: school.phone,
        email: school.email,
        website: school.website,
        academicYear: school.academicYear,
        admissionsOpen: school.isActive,
        gradeLevels: school.gradeLevels,
      });
    } catch (err) {
      next(err);
    }
  },
);

const PublicApplySchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  middleName: z.string().max(50).optional().nullable(),
  lastName: z.string().min(1, "Last name is required").max(50),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  gradeLevelAppliedFor: z.string().min(1, "Grade level applied for is required").max(50),
  previousSchool: z.string().max(100).optional().nullable(),

  fatherFirstName: z.string().max(50).optional().nullable(),
  fatherLastName: z.string().max(50).optional().nullable(),
  fatherMobile: z.string().max(30).optional().nullable(),
  motherFirstName: z.string().max(50).optional().nullable(),
  motherLastName: z.string().max(50).optional().nullable(),
  motherMobile: z.string().max(30).optional().nullable(),
  guardianEmail: z.string().email("Valid guardian email is required"),
  guardianPhone: z.string().max(30).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  nationality: z.string().max(100).optional().nullable(),
});

// POST /api/v1/admissions/public/:schoolSlug/apply
publicAdmissionsRouter.post(
  "/:schoolSlug/apply",
  admissionsLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { schoolSlug } = req.params;
      const data = PublicApplySchema.parse(req.body);

      const school = await db.school.findFirst({
        where: {
          OR: [
            { slug: schoolSlug },
            { id: schoolSlug },
            { name: { equals: schoolSlug.replace(/-/g, " "), mode: "insensitive" } },
          ],
        },
      });

      if (!school) {
        throw new AppError("School not found", 404);
      }

      if (!school.isActive) {
        throw new AppError("Admissions are currently closed for this school", 403);
      }

      const applicant = await db.applicant.create({
        data: {
          schoolId: school.id,
          status: ApplicationStatus.SUBMITTED,
          firstName: data.firstName.trim(),
          middleName: data.middleName?.trim() || null,
          lastName: data.lastName.trim(),
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender || null,
          gradeLevelAppliedFor: data.gradeLevelAppliedFor.trim(),
          previousSchool: data.previousSchool?.trim() || null,
          fatherFirstName: data.fatherFirstName?.trim() || null,
          fatherLastName: data.fatherLastName?.trim() || null,
          fatherMobile: data.fatherMobile?.trim() || null,
          motherFirstName: data.motherFirstName?.trim() || null,
          motherLastName: data.motherLastName?.trim() || null,
          motherMobile: data.motherMobile?.trim() || null,
          guardianEmail: data.guardianEmail.toLowerCase().trim(),
          guardianPhone: data.guardianPhone?.trim() || null,
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          nationality: data.nationality?.trim() || null,
        },
      });

      // 1. Send confirmation email to applicant's guardian
      try {
        await sendApplicationReceivedEmail(
          applicant.guardianEmail,
          `${applicant.firstName} ${applicant.lastName}`,
          school.name,
          applicant.id,
        );
      } catch (err) {
        console.warn("Failed to send application confirmation email:", err);
      }

      // 2. Fetch school admins for in-app and email alerts
      const schoolAdmins = await db.user.findMany({
        where: {
          schoolId: school.id,
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
          isActive: true,
        },
        select: { id: true, email: true },
      });

      // In-app notifications
      const notifPromises = schoolAdmins.map((admin) =>
        db.notification.create({
          data: {
            schoolId: school.id,
            userId: admin.id,
            type: NotificationType.ADMISSIONS,
            title: "New Admission Application",
            body: `Application received for ${applicant.firstName} ${applicant.lastName} (${applicant.gradeLevelAppliedFor || "N/A"}).`,
            data: {
              applicantId: applicant.id,
              link: `/admissions`,
            },
          },
        }).catch((err) => console.warn("Failed to create admin notification:", err)),
      );
      await Promise.allSettled(notifPromises);

      // Email alert to school admin(s)
      const adminEmails = Array.from(
        new Set([school.email, ...schoolAdmins.map((a) => a.email)].filter(Boolean) as string[]),
      );
      if (adminEmails.length > 0) {
        try {
          await sendNewApplicationAlertEmail(
            adminEmails,
            `${applicant.firstName} ${applicant.lastName}`,
            applicant.gradeLevelAppliedFor || "Not Specified",
            school.name,
            applicant.id,
          );
        } catch (err) {
          console.warn("Failed to send admin email alert:", err);
        }
      }

      sendCreated(res, applicant, "Application submitted successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADMIN ADMISSION CRM ENDPOINTS (AUTHENTICATED & TENANT GUARDED)
// ─────────────────────────────────────────────────────────────────────────────

protectedAdmissionsRouter.use(adminGuard);

// GET /api/v1/admissions — list applicants with filters & pagination
protectedAdmissionsRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const status = req.query.status as ApplicationStatus | undefined;
      const search = (req.query.search as string | undefined)?.trim();
      const gradeLevel = (req.query.gradeLevel as string | undefined)?.trim();

      const where: any = {
        schoolId: req.user.schoolId,
        ...(status && status !== ("ALL" as any) && { status }),
        ...(gradeLevel && gradeLevel !== "ALL" && { gradeLevelAppliedFor: gradeLevel }),
      };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { middleName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { guardianEmail: { contains: search, mode: "insensitive" } },
          { guardianPhone: { contains: search, mode: "insensitive" } },
          { gradeLevelAppliedFor: { contains: search, mode: "insensitive" } },
        ];
      }

      const [applicants, total] = await Promise.all([
        db.applicant.findMany({
          where,
          skip,
          take: limit,
          orderBy: { submittedAt: "desc" },
        }),
        db.applicant.count({ where }),
      ]);

      sendSuccess(res, {
        applicants,
        ...paginationMeta(total, page, limit),
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/admissions/:id — get applicant details
protectedAdmissionsRouter.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicant = await db.applicant.findFirst({
        where: {
          id: req.params.id,
          schoolId: req.user.schoolId,
        },
      });

      if (!applicant) {
        throw new AppError("Applicant not found", 404);
      }

      sendSuccess(res, applicant);
    } catch (err) {
      next(err);
    }
  },
);

const UpdateStatusSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  rejectionReason: z.string().optional(),
});

// PATCH /api/v1/admissions/:id/status — update pipeline stage
protectedAdmissionsRouter.patch(
  "/:id/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, rejectionReason } = UpdateStatusSchema.parse(req.body);

      const applicant = await db.applicant.findFirst({
        where: {
          id: req.params.id,
          schoolId: req.user.schoolId,
        },
      });

      if (!applicant) {
        throw new AppError("Applicant not found", 404);
      }

      if (status === ApplicationStatus.REJECTED && (!rejectionReason || !rejectionReason.trim())) {
        throw new AppError("Rejection reason is required when rejecting an application", 400);
      }

      const updated = await db.applicant.update({
        where: { id: applicant.id },
        data: {
          status,
          reviewedById: req.user.id,
          reviewedAt: new Date(),
          rejectionReason: status === ApplicationStatus.REJECTED ? rejectionReason?.trim() : applicant.rejectionReason,
        },
      });

      sendSuccess(res, updated, "Status updated successfully");
    } catch (err) {
      next(err);
    }
  },
);

const UpdateNotesSchema = z.object({
  notes: z.string().nullable().optional(),
});

// PATCH /api/v1/admissions/:id/notes — update internal notes
protectedAdmissionsRouter.patch(
  "/:id/notes",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { notes } = UpdateNotesSchema.parse(req.body);

      const applicant = await db.applicant.findFirst({
        where: {
          id: req.params.id,
          schoolId: req.user.schoolId,
        },
      });

      if (!applicant) {
        throw new AppError("Applicant not found", 404);
      }

      const updated = await db.applicant.update({
        where: { id: applicant.id },
        data: { notes: notes ?? null },
      });

      sendSuccess(res, updated, "Notes updated successfully");
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/admissions/:id/convert — convert ACCEPTED applicant to real Student Account
protectedAdmissionsRouter.post(
  "/:id/convert",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicant = await db.applicant.findFirst({
        where: {
          id: req.params.id,
          schoolId: req.user.schoolId,
        },
        include: { school: true },
      });

      if (!applicant) {
        throw new AppError("Applicant not found", 404);
      }

      if (applicant.status !== ApplicationStatus.ACCEPTED) {
        throw new AppError(
          `Only ACCEPTED applicants can be converted to student accounts. Current status is ${applicant.status}`,
          400,
        );
      }

      if (applicant.convertedUserId) {
        throw new AppError("This applicant has already been converted to a student account", 400);
      }

      // 1. Resolve matching grade level if present
      let matchedGradeLevelId: string | null = null;
      if (applicant.gradeLevelAppliedFor) {
        const gradeLevel = await db.gradeLevel.findFirst({
          where: {
            schoolId: req.user.schoolId,
            OR: [
              { id: applicant.gradeLevelAppliedFor },
              { name: { equals: applicant.gradeLevelAppliedFor, mode: "insensitive" } },
            ],
          },
        });
        if (gradeLevel) matchedGradeLevelId = gradeLevel.id;
      }

      // 2. Generate temporary password & student email
      const tempPassword = `Student@${Math.floor(1000 + Math.random() * 9000)}`;
      const cleanFirst = applicant.firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanLast = applicant.lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const emailDomain = applicant.school.slug ? `${applicant.school.slug}.edu` : "timhirthub.edu";
      let studentEmail = `${cleanFirst}.${cleanLast}@${emailDomain}`;

      const existingUser = await db.user.findFirst({
        where: { schoolId: req.user.schoolId, email: studentEmail },
      });
      if (existingUser) {
        studentEmail = `${cleanFirst}.${cleanLast}${Math.floor(100 + Math.random() * 900)}@${emailDomain}`;
      }

      const admissionNumber = `STU-${Date.now().toString().slice(-6)}`;

      // 3. Create Student User & Profile using UsersService.createUser
      const newStudentUser = await UsersService.createUser(req.user.schoolId, {
        role: Role.STUDENT,
        email: studentEmail,
        password: tempPassword,
        firstName: applicant.firstName,
        middleName: applicant.middleName,
        lastName: applicant.lastName,
        gender: (applicant.gender as any) || undefined,
        dateOfBirth: applicant.dateOfBirth ?? undefined,
        address: applicant.address,
        city: applicant.city,
        nationality: applicant.nationality,
        emergencyContact: applicant.fatherFirstName
          ? `${applicant.fatherFirstName} ${applicant.fatherLastName || ""}`.trim()
          : applicant.motherFirstName
          ? `${applicant.motherFirstName} ${applicant.motherLastName || ""}`.trim()
          : null,
        emergencyPhone: applicant.guardianPhone || applicant.fatherMobile || applicant.motherMobile,
        admissionNumber,
        gradeLevelId: matchedGradeLevelId,
        status: StudentStatus.ACTIVE,
        fatherFirstName: applicant.fatherFirstName,
        fatherLastName: applicant.fatherLastName,
        fatherMobile: applicant.fatherMobile,
        motherFirstName: applicant.motherFirstName,
        motherLastName: applicant.motherLastName,
        motherMobile: applicant.motherMobile,
      });

      // 4. Update applicant status to ENROLLED
      const updatedApplicant = await db.applicant.update({
        where: { id: applicant.id },
        data: {
          status: ApplicationStatus.ENROLLED,
          convertedUserId: newStudentUser.id,
          convertedAt: new Date(),
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        },
      });

      // 5. Send welcome email with student credentials to guardian
      try {
        await sendApplicantAcceptedWelcomeEmail(
          applicant.guardianEmail,
          `${applicant.firstName} ${applicant.lastName}`,
          applicant.school.name,
          studentEmail,
          tempPassword,
        );
      } catch (err) {
        console.warn("Failed to send student welcome email:", err);
      }

      sendCreated(
        res,
        {
          applicant: updatedApplicant,
          studentUser: newStudentUser,
          studentEmail,
          tempPassword,
          admissionNumber,
        },
        "Applicant successfully converted to student account",
      );
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/admissions/:id — delete REJECTED or WITHDRAWN application
protectedAdmissionsRouter.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicant = await db.applicant.findFirst({
        where: {
          id: req.params.id,
          schoolId: req.user.schoolId,
        },
      });

      if (!applicant) {
        throw new AppError("Applicant not found", 404);
      }

      if (
        applicant.status !== ApplicationStatus.REJECTED &&
        applicant.status !== ApplicationStatus.WITHDRAWN
      ) {
        throw new AppError(
          `Cannot delete application in status ${applicant.status}. Only REJECTED or WITHDRAWN applications can be deleted.`,
          400,
        );
      }

      await db.applicant.delete({
        where: { id: applicant.id },
      });

      sendSuccess(res, null, "Application deleted successfully");
    } catch (err) {
      next(err);
    }
  },
);
