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
    classIds?: string[];
    classId?: string;
    gradeLevelId?: string;
    gender?: Gender;
    enrollmentStatus?: string;
    sortBy?: string;
  },
) => {
  const {
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
  } = params;
  const skip = (page - 1) * limit;

  const where: any = {
    schoolId,
    ...(role && { role }),
    ...(isActive !== undefined && { isActive }),
    ...(gender && { gender }),
  };

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { studentProfile: { is: { admissionNumber: { contains: q, mode: "insensitive" } } } },
      { studentProfile: { is: { rollNumber: { contains: q, mode: "insensitive" } } } },
    ];
  }

  // Student profile filters
  const studentFilters: any = {};
  if (classId && classId !== "ALL") {
    studentFilters.classId = classId;
  } else if (classIds && classIds.length > 0) {
    studentFilters.classId = { in: classIds };
  }

  if (gradeLevelId && gradeLevelId !== "ALL") {
    studentFilters.OR = [
      { gradeLevelId },
      { class: { is: { gradeLevelId } } },
    ];
  }

  if (enrollmentStatus === "ENROLLED") {
    studentFilters.graduatedAt = null;
  } else if (enrollmentStatus === "GRADUATED") {
    studentFilters.graduatedAt = { not: null };
  }

  if (Object.keys(studentFilters).length > 0) {
    where.studentProfile = { is: studentFilters };
  }

  let orderBy: any = { createdAt: "desc" };
  if (sortBy === "name-asc") {
    orderBy = [{ firstName: "asc" }, { lastName: "asc" }];
  } else if (sortBy === "name-desc") {
    orderBy = [{ firstName: "desc" }, { lastName: "desc" }];
  } else if (sortBy === "created-asc") {
    orderBy = { createdAt: "asc" };
  } else if (sortBy === "created-desc") {
    orderBy = { createdAt: "desc" };
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy,
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
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        studentProfile: {
          select: {
            id: true,
            admissionNumber: true,
            rollNumber: true,
            classId: true,
            gradeLevelId: true,
            class: {
              select: {
                id: true,
                name: true,
                gradeLevel: { select: { id: true, name: true, level: true } },
              },
            },
            gradeLevel: { select: { id: true, name: true, level: true } },
            enrolledAt: true,
            graduatedAt: true,
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
          // assignedClasses is the many-to-many relation for classes assigned to the teacher
          assignedClasses: { select: { id: true, name: true } },
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
    rollNumber?: string;
    classId?: string;
    gradeLevelId?: string;
    classIds?: string[];
    // Teacher-specific
    employeeId?: string;
    qualification?: string;
    specialization?: string;
    // Parent-specific
    occupation?: string;
    relation?: string;
    studentIds?: string[];
    // Admin-specific
    department?: string;
  },
) => {
  const existing = await db.user.findUnique({
    where: { schoolId_email: { schoolId, email: data.email } },
  });
  if (existing) throw new AppError("Email already in use at this school", 409);

  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  let parentStudentProfileIds: string[] = [];
  if (
    data.role === Role.PARENT &&
    data.studentIds &&
    data.studentIds.length > 0
  ) {
    const uniqueStudentIds = Array.from(new Set(data.studentIds));
    const studentUsers = await db.user.findMany({
      where: {
        id: { in: uniqueStudentIds },
        schoolId,
        role: Role.STUDENT,
      },
      include: { studentProfile: true },
    });
    if (studentUsers.length !== uniqueStudentIds.length) {
      throw new AppError("One or more students not found", 404);
    }
    parentStudentProfileIds = studentUsers.map((u) => u.studentProfile!.id);
  }

  // Build create payload so we can retry without grade connect if DB doesn't support it yet
  const createPayload: any = {
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
            rollNumber: data.rollNumber,
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
            // connect assigned classes if provided (many-to-many)
            ...(data.classIds && data.classIds.length > 0
              ? {
                  assignedClasses: {
                    connect: data.classIds.map((id) => ({ id })),
                  },
                }
              : {}),
          },
        },
      }),
      ...(data.role === Role.PARENT && {
        parentProfile: {
          create: {
            occupation: data.occupation,
            relation: data.relation,
            ...(parentStudentProfileIds.length > 0
              ? {
                  studentLinks: {
                    create: parentStudentProfileIds.map((studentProfileId) => ({
                      studentProfileId,
                    })),
                  },
                }
              : {}),
          },
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
  };

  let user: any;
  try {
    user = await db.user.create(createPayload);
  } catch (err: any) {
    // Fallbacks for missing relations in DB schema: try to recover so user
    // creation still succeeds even if migrations haven't been applied.
    const msg = String(err?.message ?? "").toLowerCase();

    // If assignedClasses (many-to-many) failed, remove it and retry,
    // then attach classes in a separate update if possible.
    if (
      data.classIds &&
      data.classIds.length > 0 &&
      (msg.includes("assignedclasses") ||
        msg.includes("assigned_classes") ||
        msg.includes("class_teacher") ||
        msg.includes("teacher_profiles") ||
        msg.includes("column"))
    ) {
      if (createPayload.data.teacherProfile?.create?.assignedClasses) {
        delete createPayload.data.teacherProfile.create.assignedClasses;
      }
      user = await db.user.create(createPayload);

      // Try to attach assigned classes after the fact.
      try {
        const teacherProfileId = user.teacherProfile?.id;
        if (teacherProfileId) {
          await db.teacherProfile.update({
            where: { id: teacherProfileId },
            data: {
              assignedClasses: { connect: data.classIds.map((id) => ({ id })) },
            },
          });
        }
      } catch (e) {
        // non-fatal — if this fails, return the created user without assigned classes
      }
    } else if (
      data.gradeLevelId &&
      (msg.includes("gradelevel") ||
        msg.includes("grade_level") ||
        msg.includes("teacher_profiles") ||
        msg.includes("column"))
    ) {
      // previous fallback: remove nested grade connect and retry
      if (createPayload.data.teacherProfile?.create?.gradeLevel) {
        delete createPayload.data.teacherProfile.create.gradeLevel;
      }
      user = await db.user.create(createPayload);
    } else {
      throw err;
    }
  }

  // Invalidate dashboard cache so admin KPI counts update
  try {
    await cacheDel(`dashboard:${schoolId}`);
  } catch (e) {
    // non-fatal — don't block user creation if cache can't be cleared
  }

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
    avatar: string | null;
    isActive: boolean;
    smsOptIn: boolean;
    rollNumber: string;
    qualification: string;
    specialization: string;
    employeeId: string;
    department: string;
    occupation: string;
  }>,
) => {
  const user = await db.user.findFirst({ where: { id, schoolId } });
  if (!user) throw new AppError("User not found", 404);

  const updateData: any = { ...data };
  if (data.rollNumber !== undefined) {
    delete updateData.rollNumber;
    updateData.studentProfile = {
      update: {
        rollNumber: data.rollNumber,
      },
    };
  }

  if (
    data.qualification !== undefined ||
    data.specialization !== undefined ||
    data.employeeId !== undefined
  ) {
    delete updateData.qualification;
    delete updateData.specialization;
    delete updateData.employeeId;
    updateData.teacherProfile = {
      upsert: {
        create: {
          employeeId: data.employeeId ?? `TCH${Date.now()}`,
          qualification: data.qualification,
          specialization: data.specialization,
        },
        update: {
          ...(data.qualification !== undefined && {
            qualification: data.qualification,
          }),
          ...(data.specialization !== undefined && {
            specialization: data.specialization,
          }),
          ...(data.employeeId !== undefined && {
            employeeId: data.employeeId,
          }),
        },
      },
    };
  }

  if (data.department !== undefined) {
    delete updateData.department;
    updateData.adminProfile = {
      upsert: {
        create: { department: data.department },
        update: { department: data.department },
      },
    };
  }

  if (data.occupation !== undefined) {
    delete updateData.occupation;
    updateData.parentProfile = {
      upsert: {
        create: { occupation: data.occupation },
        update: { occupation: data.occupation },
      },
    };
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
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

// ── Delete user ──────────────────────────────────────────────────────────────
export const deleteUser = async (id: string, schoolId: string) => {
  const user = await db.user.findFirst({ where: { id, schoolId } });
  if (!user) throw new AppError("User not found", 404);

  await db.user.delete({ where: { id } });
  await cacheDel(`user:${id}`);
  return { success: true };
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
      studentProfile: {
        include: {
          class: { include: { gradeLevel: true } },
          gradeLevel: true,
        },
      },
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

  const className = user.studentProfile?.class?.name ?? null;
  const gradeLevelName =
    user.studentProfile?.class?.gradeLevel?.name ??
    user.studentProfile?.gradeLevel?.name ??
    null;

  const currentYear = new Date().getFullYear();
  const validThrough = `${currentYear} - ${currentYear + 1}`;

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
      className,
      gradeLevelName,
      gender: user.gender ?? null,
      dateOfBirth: user.dateOfBirth
        ? user.dateOfBirth.toISOString().split("T")[0]
        : null,
      phone: user.phone ?? null,
      email: user.email ?? null,
      rollNumber: user.studentProfile?.rollNumber ?? null,
      validThrough,
    },
  });

  return { pdf, fileName: `id-card-${idNumber}.pdf` };
};
