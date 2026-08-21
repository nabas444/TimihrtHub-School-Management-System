import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";

const router = Router();
const adminGuard = authorize(Role.ADMIN, Role.SUPER_ADMIN);

// ─────────────────────────────────────────────────────────────────────────────
// PARENTS DIRECTORY & LIST
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

      const where: any = {
        schoolId,
        role: Role.PARENT,
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            {
              parentProfile: {
                OR: [
                  { occupation: { contains: search, mode: "insensitive" } },
                  { relation: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          ],
        }),
      };

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            phone: true,
            gender: true,
            address: true,
            city: true,
            avatar: true,
            isActive: true,
            createdAt: true,
            parentProfile: {
              select: {
                id: true,
                occupation: true,
                relation: true,
                annualIncome: true,
                education: true,
                studentLinks: {
                  select: {
                    id: true,
                    isPrimary: true,
                    relation: true,
                    studentProfile: {
                      select: {
                        id: true,
                        admissionNumber: true,
                        user: {
                          select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatar: true,
                          },
                        },
                        class: {
                          select: {
                            id: true,
                            name: true,
                            gradeLevel: { select: { name: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
        }),
        db.user.count({ where }),
      ]);

      return sendSuccess(
        res,
        users,
        "Parents retrieved successfully",
        200,
        paginationMeta(page, limit, total),
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE PARENT DETAIL
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/:id",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;

      const user = await db.user.findFirst({
        where: { id, schoolId, role: Role.PARENT },
        include: {
          parentProfile: {
            include: {
              studentLinks: {
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
                      class: {
                        include: { gradeLevel: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) throw new AppError("Parent record not found", 404);

      return sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PARENT ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────

const createParentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters").default("Welcome@123"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  relation: z.string().optional().nullable(), // Father | Mother | Guardian
  annualIncome: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  linkedStudentIds: z.array(z.string().uuid()).optional(),
});

router.post(
  "/",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const data = createParentSchema.parse(req.body);

      // Check if email in use
      const existing = await db.user.findUnique({
        where: {
          schoolId_email: {
            schoolId,
            email: data.email.toLowerCase(),
          },
        },
      });
      if (existing) throw new AppError("Email already in use", 400);

      const hashedPassword = await bcrypt.hash(data.password, 12);

      const newParent = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            schoolId,
            role: Role.PARENT,
            email: data.email.toLowerCase(),
            password: hashedPassword,
            firstName: data.firstName,
            middleName: data.middleName || null,
            lastName: data.lastName,
            phone: data.phone || null,
            gender: data.gender || null,
            address: data.address || null,
            city: data.city || null,
            avatar: data.avatar || null,
            isActive: true,
          },
        });

        const profile = await tx.parentProfile.create({
          data: {
            userId: user.id,
            occupation: data.occupation || null,
            relation: data.relation || "Parent",
            annualIncome: data.annualIncome || null,
            education: data.education || null,
          },
        });

        if (data.linkedStudentIds && data.linkedStudentIds.length > 0) {
          for (const studentProfileId of data.linkedStudentIds) {
            await tx.parentStudentLink.create({
              data: {
                parentProfileId: profile.id,
                studentProfileId,
                isPrimary: true,
                relation: data.relation || "Guardian",
              },
            });
          }
        }

        return user;
      });

      return sendCreated(res, newParent, "Parent account created successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PARENT PROFILE
// ─────────────────────────────────────────────────────────────────────────────

const updateParentSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional().nullable(),
  lastName: z.string().optional(),
  phone: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  relation: z.string().optional().nullable(),
  annualIncome: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.patch(
  "/:id",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id } = req.params;
      const data = updateParentSchema.parse(req.body);

      const user = await db.user.findFirst({
        where: { id, schoolId, role: Role.PARENT },
        include: { parentProfile: true },
      });
      if (!user) throw new AppError("Parent record not found", 404);

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            ...(data.firstName !== undefined && { firstName: data.firstName }),
            ...(data.middleName !== undefined && { middleName: data.middleName || null }),
            ...(data.lastName !== undefined && { lastName: data.lastName }),
            ...(data.phone !== undefined && { phone: data.phone || null }),
            ...(data.gender !== undefined && { gender: data.gender }),
            ...(data.address !== undefined && { address: data.address || null }),
            ...(data.city !== undefined && { city: data.city || null }),
            ...(data.avatar !== undefined && { avatar: data.avatar || null }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
          },
        });

        if (user.parentProfile) {
          await tx.parentProfile.update({
            where: { id: user.parentProfile.id },
            data: {
              ...(data.occupation !== undefined && { occupation: data.occupation || null }),
              ...(data.relation !== undefined && { relation: data.relation || null }),
              ...(data.annualIncome !== undefined && { annualIncome: data.annualIncome || null }),
              ...(data.education !== undefined && { education: data.education || null }),
            },
          });
        }
      });

      return sendSuccess(res, { id }, "Parent profile updated successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// LINK / UNLINK STUDENTS
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  "/:id/link-student",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: userId } = req.params;
      const { studentProfileId, isPrimary, relation } = req.body;

      if (!studentProfileId) throw new AppError("Student profile ID required", 400);

      const user = await db.user.findFirst({
        where: { id: userId, schoolId, role: Role.PARENT },
        include: { parentProfile: true },
      });
      if (!user || !user.parentProfile) throw new AppError("Parent not found", 404);

      const student = await db.studentProfile.findFirst({
        where: { id: studentProfileId, user: { schoolId } },
      });
      if (!student) throw new AppError("Student not found", 404);

      const link = await db.parentStudentLink.upsert({
        where: {
          parentProfileId_studentProfileId: {
            parentProfileId: user.parentProfile.id,
            studentProfileId,
          },
        },
        update: {
          isPrimary: Boolean(isPrimary),
          ...(relation && { relation }),
        },
        create: {
          parentProfileId: user.parentProfile.id,
          studentProfileId,
          isPrimary: isPrimary !== undefined ? Boolean(isPrimary) : true,
          relation: relation || "Guardian",
        },
      });

      return sendSuccess(res, link, "Student linked to parent");
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id/unlink-student/:linkId",
  adminGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { id: userId, linkId } = req.params;

      const user = await db.user.findFirst({
        where: { id: userId, schoolId, role: Role.PARENT },
        include: { parentProfile: true },
      });
      if (!user || !user.parentProfile) throw new AppError("Parent not found", 404);

      const link = await db.parentStudentLink.findFirst({
        where: { id: linkId, parentProfileId: user.parentProfile.id },
      });
      if (!link) throw new AppError("Link not found", 404);

      await db.parentStudentLink.delete({ where: { id: linkId } });

      return sendSuccess(res, { deleted: true }, "Student unlinked from parent");
    } catch (err) {
      next(err);
    }
  },
);

export default router;
