import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role, Gender, StudentStatus, ProgramType } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import * as UsersService from "./users.service";
import {
  sendSuccess,
  sendCreated,
  sendError,
  paginationMeta,
} from "../../utils/response";
import { recordAuditEvent } from "../../utils/auditLog";

const CreateUserSchema = z.object({
  role: z.nativeEnum(Role),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  middleName: z.string().max(50).nullable().optional(),
  lastName: z.string().min(1).max(50),
  phone: z.string().nullable().optional(),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().datetime().optional(),
  address: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
  emergencyPhone: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),

  // Student specific
  admissionNumber: z.string().nullable().optional(),
  rollNumber: z.string().nullable().optional(),
  classId: z.string().nullable().optional(),
  classIds: z.array(z.string()).optional(),
  gradeLevelId: z.string().nullable().optional(),
  busRouteId: z.string().nullable().optional(),
  usesTransport: z.boolean().nullable().optional(),
  programType: z.nativeEnum(ProgramType).nullable().optional(),
  programTypeLabel: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  medicalNotes: z.string().nullable().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  fatherFirstName: z.string().nullable().optional(),
  fatherMiddleName: z.string().nullable().optional(),
  fatherLastName: z.string().nullable().optional(),
  motherFirstName: z.string().nullable().optional(),
  motherMiddleName: z.string().nullable().optional(),
  motherLastName: z.string().nullable().optional(),
  fatherMobile: z.string().nullable().optional(),
  fatherPhoto: z.string().nullable().optional(),
  motherMobile: z.string().nullable().optional(),
  motherPhoto: z.string().nullable().optional(),
  landline: z.string().nullable().optional(),
  religionId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  feeCategoryId: z.string().nullable().optional(),
  sourceId: z.string().nullable().optional(),
  houseId: z.string().nullable().optional(),
  curriculumId: z.string().nullable().optional(),
  previousSchoolId: z.string().nullable().optional(),
  previousClassYear: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),

  // Teacher specific
  employeeId: z.string().nullable().optional(),
  qualification: z.string().nullable().optional(),
  specialization: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  experienceYears: z.number().nullable().optional(),

  // Parent specific
  occupation: z.string().nullable().optional(),
  relation: z.string().nullable().optional(),
  annualIncome: z.string().nullable().optional(),
  education: z.string().nullable().optional(),
  studentIds: z.array(z.string()).optional(),

  // Admin specific
  department: z.string().nullable().optional(),
});

const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  middleName: z.string().max(50).nullable().optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().nullable().optional(),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().datetime().optional(),
  address: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
  emergencyPhone: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),

  // Student specific
  admissionNumber: z.string().nullable().optional(),
  rollNumber: z.string().nullable().optional(),
  classId: z.string().nullable().optional(),
  gradeLevelId: z.string().nullable().optional(),
  busRouteId: z.string().nullable().optional(),
  usesTransport: z.boolean().nullable().optional(),
  programType: z.nativeEnum(ProgramType).nullable().optional(),
  programTypeLabel: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  medicalNotes: z.string().nullable().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  fatherFirstName: z.string().nullable().optional(),
  fatherMiddleName: z.string().nullable().optional(),
  fatherLastName: z.string().nullable().optional(),
  motherFirstName: z.string().nullable().optional(),
  motherMiddleName: z.string().nullable().optional(),
  motherLastName: z.string().nullable().optional(),
  fatherMobile: z.string().nullable().optional(),
  fatherPhoto: z.string().nullable().optional(),
  motherMobile: z.string().nullable().optional(),
  motherPhoto: z.string().nullable().optional(),
  landline: z.string().nullable().optional(),
  religionId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  feeCategoryId: z.string().nullable().optional(),
  sourceId: z.string().nullable().optional(),
  houseId: z.string().nullable().optional(),
  curriculumId: z.string().nullable().optional(),
  previousSchoolId: z.string().nullable().optional(),
  previousClassYear: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),

  // Teacher specific
  qualification: z.string().nullable().optional(),
  specialization: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  experienceYears: z.number().nullable().optional(),

  // Parent specific
  occupation: z.string().nullable().optional(),
  relation: z.string().nullable().optional(),
  annualIncome: z.string().nullable().optional(),
  education: z.string().nullable().optional(),

  // Admin specific
  department: z.string().nullable().optional(),
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
    const status = req.query.status as string | undefined;
    const usesTransport = req.query.usesTransport as string | undefined;
    const busRouteId = req.query.busRouteId as string | undefined;
    const programType = req.query.programType as ProgramType | undefined;

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
      status,
      classIds,
      classId,
      gradeLevelId,
      gender,
      enrollmentStatus,
      sortBy,
      usesTransport,
      busRouteId,
      programType,
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

    await recordAuditEvent({
      schoolId: req.user.schoolId,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "USER_CREATED",
      targetType: "User",
      targetId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      req,
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

    await recordAuditEvent({
      schoolId: req.user.schoolId,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: result.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      targetType: "User",
      targetId: req.params.id,
      metadata: { isActive: result.isActive },
      req,
    });

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
