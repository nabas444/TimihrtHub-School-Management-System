import bcrypt from "bcryptjs";
import { Role, Gender } from "@prisma/client";
import { db } from "../../config/database";
import { cacheDel } from "../../config/redis";
import { AppError } from "../../middleware/errorHandler";

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "12");

// ── List users (paginated, filterable by role) ───────────────────────────────
export const listUsers = async (
  schoolId: string,
  params: {
    role?: Role;
    search?: string;
    page: number;
    limit: number;
    isActive?: boolean;
  },
) => {
  const { role, search, page, limit, isActive } = params;
  const skip = (page - 1) * limit;

  const where = {
    schoolId,
    ...(role && { role }),
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        schoolId: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        gender: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        studentProfile: {
          select: {
            id: true,
            admissionNumber: true,
            rollNumber: true,
            classId: true,
          },
        },
        teacherProfile: {
          select: {
            id: true,
            employeeId: true,
            specialization: true,
            isClassTeacher: true,
          },
        },
        parentProfile: {
          select: { id: true, occupation: true, relation: true },
        },
        adminProfile: {
          select: { id: true, department: true, isSuperAdmin: true },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  return { users, total };
};

// ── Get single user ──────────────────────────────────────────────────────────
export const getUserById = async (id: string, schoolId: string) => {
  const user = await db.user.findFirst({
    where: { id, schoolId },
    select: {
      id: true,
      schoolId: true,
      role: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatar: true,
      gender: true,
      dateOfBirth: true,
      address: true,
      smsOptIn: true,
      isActive: true,
      isEmailVerified: true,
      lastLoginAt: true,
      createdAt: true,
      studentProfile: {
        include: {
          class: { select: { id: true, name: true } },
          gradeLevel: { select: { id: true, name: true } },
          parentLinks: {
            include: {
              parentProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      teacherProfile: {
        include: {
          classTeacherOf: { select: { id: true, name: true } },
          subjectTeachings: {
            include: {
              subject: { select: { id: true, name: true } },
              class: { select: { id: true, name: true } },
            },
          },
        },
      },
      parentProfile: {
        include: {
          studentLinks: {
            include: {
              studentProfile: {
                include: {
                  user: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                  class: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      adminProfile: true,
    },
  });

  if (!user) throw new AppError("User not found", 404);
  return user;
};

// ── Create user ──────────────────────────────────────────────────────────────
export const createUser = async (
  schoolId: string,
  data: {
    role: Role;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    gender?: Gender;
    dateOfBirth?: Date;
    address?: string;
    // Student-specific
    admissionNumber?: string;
    classId?: string;
    gradeLevelId?: string;
    // Teacher-specific
    employeeId?: string;
    qualification?: string;
    specialization?: string;
    // Parent-specific
    occupation?: string;
    relation?: string;
    // Admin-specific
    department?: string;
  },
) => {
  const existing = await db.user.findUnique({
    where: { schoolId_email: { schoolId, email: data.email } },
  });
  if (existing) throw new AppError("Email already in use at this school", 409);

  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await db.user.create({
    data: {
      schoolId,
      role: data.role,
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      address: data.address,
      // Create role-specific profile inline
      ...(data.role === Role.STUDENT && {
        studentProfile: {
          create: {
            admissionNumber: data.admissionNumber ?? `STU${Date.now()}`,
            classId: data.classId,
            gradeLevelId: data.gradeLevelId,
          },
        },
      }),
      ...(data.role === Role.TEACHER && {
        teacherProfile: {
          create: {
            employeeId: data.employeeId ?? `TCH${Date.now()}`,
            qualification: data.qualification,
            specialization: data.specialization,
          },
        },
      }),
      ...(data.role === Role.PARENT && {
        parentProfile: {
          create: { occupation: data.occupation, relation: data.relation },
        },
      }),
      ...(data.role === Role.ADMIN && {
        adminProfile: {
          create: { department: data.department },
        },
      }),
    },
    select: {
      id: true,
      role: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      studentProfile: { select: { id: true, admissionNumber: true } },
      teacherProfile: { select: { id: true, employeeId: true } },
    },
  });

  return user;
};

// ── Update user ──────────────────────────────────────────────────────────────
export const updateUser = async (
  id: string,
  schoolId: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    gender: Gender;
    dateOfBirth: Date;
    address: string;
    avatar: string;
    isActive: boolean;
    smsOptIn: boolean;
  }>,
) => {
  const user = await db.user.findFirst({ where: { id, schoolId } });
  if (!user) throw new AppError("User not found", 404);

  const updated = await db.user.update({
    where: { id },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      gender: true,
      dateOfBirth: true,
      address: true,
      avatar: true,
      isActive: true,
      smsOptIn: true,
    },
  });

  await cacheDel(`user:${id}`);
  return updated;
};

// ── Toggle user active status ────────────────────────────────────────────────
export const toggleUserStatus = async (id: string, schoolId: string) => {
  const user = await db.user.findFirst({ where: { id, schoolId } });
  if (!user) throw new AppError("User not found", 404);

  const updated = await db.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: { id: true, isActive: true },
  });

  await cacheDel(`user:${id}`);
  return updated;
};

// ── Bulk create students (CSV import) ────────────────────────────────────────
export const bulkCreateStudents = async (
  schoolId: string,
  students: Array<{
    email: string;
    firstName: string;
    lastName: string;
    admissionNumber?: string;
    classId?: string;
  }>,
) => {
  const defaultPassword = await bcrypt.hash("Welcome@123", SALT_ROUNDS);
  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const s of students) {
    try {
      const exists = await db.user.findUnique({
        where: { schoolId_email: { schoolId, email: s.email } },
      });
      if (exists) {
        results.skipped++;
        continue;
      }

      await db.user.create({
        data: {
          schoolId,
          role: Role.STUDENT,
          email: s.email,
          password: defaultPassword,
          firstName: s.firstName,
          lastName: s.lastName,
          studentProfile: {
            create: {
              admissionNumber: s.admissionNumber ?? `STU${Date.now()}`,
              classId: s.classId,
            },
          },
        },
      });
      results.created++;
    } catch (e: any) {
      results.errors.push(`${s.email}: ${e.message}`);
    }
  }

  return results;
};

// ── School stats ─────────────────────────────────────────────────────────────
export const getSchoolStats = async (schoolId: string) => {
  const [students, teachers, parents, admins, classes, activeStudents] =
    await Promise.all([
      db.user.count({ where: { schoolId, role: Role.STUDENT } }),
      db.user.count({ where: { schoolId, role: Role.TEACHER } }),
      db.user.count({ where: { schoolId, role: Role.PARENT } }),
      db.user.count({ where: { schoolId, role: Role.ADMIN } }),
      db.class.count({ where: { schoolId } }),
      db.user.count({
        where: { schoolId, role: Role.STUDENT, isActive: true },
      }),
    ]);

  return {
    students,
    teachers,
    parents,
    admins,
    classes,
    activeStudents,
    totalUsers: students + teachers + parents + admins,
  };
};

// ── ID card (requirement doc: "Print student ID cards ... using standard
// desktop or thermal printers") — nothing generated a card of any kind before
// this; there's also no dedicated ID-card model, so this is built directly
// from User + StudentProfile/TeacherProfile at request time rather than stored.
export const getIdCardPdf = async (userId: string, schoolId: string) => {
  const user = await db.user.findFirst({
    where: { id: userId, schoolId },
    include: {
      studentProfile: { include: { class: true } },
      teacherProfile: true,
      school: {
        select: { name: true, address: true, phone: true, email: true },
      },
    },
  });
  if (!user) throw new AppError("User not found", 404);

  const idNumber =
    user.studentProfile?.admissionNumber ??
    user.teacherProfile?.employeeId ??
    user.id.slice(0, 8).toUpperCase();
  const roleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase();

  const { generateIdCardPdf } = await import("../../utils/pdf");
  const pdf = await generateIdCardPdf({
    school: {
      name: user.school.name,
      address: user.school.address,
      phone: user.school.phone,
      email: user.school.email,
    },
    person: {
      name: `${user.firstName} ${user.lastName}`,
      role: roleLabel,
      idNumber,
      className: user.studentProfile?.class?.name ?? null,
      validThrough: undefined,
    },
  });

  return { pdf, fileName: `id-card-${idNumber}.pdf` };
};
