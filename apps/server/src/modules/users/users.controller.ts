import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, Gender } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import * as UsersService from "./users.service";
import {
  sendSuccess,
  sendCreated,
  sendError,
  paginationMeta,
} from "../../utils/response";

const CreateUserSchema = z.object({
  role: z.nativeEnum(Role),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().datetime().optional(),
  address: z.string().optional(),
  // Student
  admissionNumber: z.string().optional(),
  rollNumber: z.string().optional(),
  classId: z.string().optional(),
  classIds: z.array(z.string()).optional(),
  gradeLevelId: z.string().optional(),
  // Teacher
  employeeId: z.string().optional(),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  // Parent
  occupation: z.string().optional(),
  relation: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
  // Admin
  department: z.string().optional(),
});

const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().datetime().optional(),
  address: z.string().optional(),
  avatar: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
  smsOptIn: z.boolean().optional(), // Phase 5 — parent SMS alert opt-in
  rollNumber: z.string().optional(),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  occupation: z.string().optional(),
});

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const role = req.query.role as Role | undefined;
    const search = req.query.search as string | undefined;
    const classId = req.query.classId as string | undefined;
    const gradeLevelId = req.query.gradeLevelId as string | undefined;
    const gender = req.query.gender as Gender | undefined;
    const enrollmentStatus = req.query.enrollmentStatus as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;

    const classIds = (req.query.classIds as string | undefined)
      ? (req.query.classIds as string).split(",").filter(Boolean)
      : undefined;
    const isActive =
      req.query.isActive !== undefined && req.query.isActive !== "ALL"
        ? req.query.isActive === "true"
        : undefined;

    const { users, total } = await UsersService.listUsers(req.user.schoolId, {
      role,
      search,
      page,
      limit,
      isActive,
      classIds,
      classId,
      gradeLevelId,
      gender,
      enrollmentStatus,
      sortBy,
    });
    sendSuccess(
      res,
      users,
      "Users fetched",
      200,
      paginationMeta(total, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await UsersService.getUserById(
      req.params.id,
      req.user.schoolId,
    );
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = CreateUserSchema.parse(req.body);
    const user = await UsersService.createUser(req.user.schoolId, {
      ...data,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    });
    sendCreated(res, user, "User created successfully");
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = UpdateUserSchema.parse(req.body);
    const user = await UsersService.updateUser(
      req.params.id,
      req.user.schoolId,
      {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
    );
    sendSuccess(res, user, "User updated");
  } catch (err) {
    next(err);
  }
};

export const toggleStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await UsersService.toggleUserStatus(
      req.params.id,
      req.user.schoolId,
    );
    sendSuccess(
      res,
      result,
      `User ${result.isActive ? "activated" : "deactivated"}`,
    );
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await UsersService.deleteUser(req.params.id, req.user.schoolId);
    sendSuccess(res, null, "User deleted successfully");
  } catch (err) {
    next(err);
  }
};

export const bulkCreateStudents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { students } = z
      .object({
        students: z
          .array(
            z.object({
              email: z.string().email(),
              firstName: z.string(),
              lastName: z.string(),
              admissionNumber: z.string().optional(),
              classId: z.string().optional(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(req.body);

    const result = await UsersService.bulkCreateStudents(
      req.user.schoolId,
      students,
    );
    sendSuccess(
      res,
      result,
      `Bulk import: ${result.created} created, ${result.skipped} skipped`,
    );
  } catch (err) {
    next(err);
  }
};

export const getSchoolStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const stats = await UsersService.getSchoolStats(req.user.schoolId);
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
};

export const downloadIdCard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const targetId = req.params.id ?? req.user.id;
    const isStaff = (
      [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER] as Role[]
    ).includes(req.user.role as Role);
    const isSelf = targetId === req.user.id;
    let isLinkedParent = false;

    if (!isStaff && !isSelf && req.user.role === Role.PARENT) {
      const link = await db.parentStudentLink.findFirst({
        where: {
          studentProfile: { userId: targetId },
          parentProfile: { userId: req.user.id },
        },
      });
      isLinkedParent = !!link;
    }

    if (!isStaff && !isSelf && !isLinkedParent) {
      throw new AppError("Not authorized to download this ID card", 403);
    }

    const { pdf, fileName } = await UsersService.getIdCardPdf(
      targetId,
      req.user.schoolId,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
};

export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await UsersService.getUserById(req.user.id, req.user.schoolId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = UpdateUserSchema.parse(req.body);
    // Only allow non-admin fields for self-update
    const { isActive, ...selfData } = data;
    const user = await UsersService.updateUser(req.user.id, req.user.schoolId, {
      ...selfData,
      dateOfBirth: selfData.dateOfBirth
        ? new Date(selfData.dateOfBirth)
        : undefined,
    });
    sendSuccess(res, user, "Profile updated");
  } catch (err) {
    next(err);
  }
};
