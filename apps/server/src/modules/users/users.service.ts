import bcrypt from "bcryptjs";
import { Role, Gender, StudentStatus, ProgramType } from "@prisma/client";
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
    status?: string;
    classIds?: string[];
    classId?: string;
    gradeLevelId?: string;
    gender?: Gender;
    enrollmentStatus?: string;
    sortBy?: string;
    usesTransport?: string;
    busRouteId?: string;
    programType?: ProgramType;
  },
) => {
  const {
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
      { middleName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { studentProfile: { is: { admissionNumber: { contains: q, mode: "insensitive" } } } },
      { studentProfile: { is: { rollNumber: { contains: q, mode: "insensitive" } } } },
      { teacherProfile: { is: { employeeId: { contains: q, mode: "insensitive" } } } },
    ];
  }

  // Student profile filters
  const studentFilters: any = {};

  if (status && status !== "ALL") {
    studentFilters.status = status as StudentStatus;
  } else if (!status && role === Role.STUDENT) {
    // Default to ACTIVE students when not specified
    studentFilters.status = StudentStatus.ACTIVE;
  }

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

  // Transport filter
  if (usesTransport === "true" || usesTransport === "YES") {
    studentFilters.usesTransport = true;
  } else if (usesTransport === "false" || usesTransport === "NO") {
    studentFilters.usesTransport = false;
  } else if (usesTransport === "NOT_SET" || usesTransport === "null") {
    studentFilters.usesTransport = null;
  }

  if (busRouteId && busRouteId !== "ALL") {
    studentFilters.busRouteId = busRouteId;
  }

  // Program type filter (effective program type: class programType if class assigned, else student programType)
  if (programType && (programType as any) !== "ALL") {
    studentFilters.OR = [
      { class: { is: { programType } } },
      { classId: null, programType },
    ];
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
        middleName: true,
        lastName: true,
        phone: true,
        avatar: true,
        gender: true,
        dateOfBirth: true,
        address: true,
        nationality: true,
        city: true,
        state: true,
        pincode: true,
        birthPlace: true,
        emergencyContact: true,
        emergencyPhone: true,
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
            busRouteId: true,
            usesTransport: true,
            programType: true,
            programTypeLabel: true,
            status: true,
            bloodGroup: true,
            medicalNotes: true,
            middleName: true,
            fatherFirstName: true,
            fatherMiddleName: true,
            fatherLastName: true,
            motherFirstName: true,
            motherMiddleName: true,
            motherLastName: true,
            fatherMobile: true,
            fatherPhoto: true,
            motherMobile: true,
            motherPhoto: true,
            landline: true,
            nationality: true,
            city: true,
            state: true,
            pincode: true,
            birthPlace: true,
            reference: true,
            previousClassYear: true,
            busRoute: { select: { id: true, name: true } },
            religion: { select: { id: true, value: true } },
            category: { select: { id: true, value: true } },
            feeCategory: { select: { id: true, value: true } },
            source: { select: { id: true, value: true } },
            house: { select: { id: true, value: true, colorHex: true } },
            curriculum: { select: { id: true, value: true } },
            previousSchool: { select: { id: true, value: true } },
            class: {
              select: {
                id: true,
                name: true,
                programType: true,
                programTypeLabel: true,
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
            qualification: true,
            designation: true,
            isClassTeacher: true,
            religion: { select: { id: true, value: true } },
            house: { select: { id: true, value: true, colorHex: true } },
          },
        },
        parentProfile: {
          select: { id: true, occupation: true, relation: true, annualIncome: true, education: true },
        },
        adminProfile: {
          select: {
            id: true,
            department: true,
            designation: true,
            employeeId: true,
            isSuperAdmin: true,
            religion: { select: { id: true, value: true } },
          },
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
      middleName: true,
      lastName: true,
      phone: true,
      avatar: true,
      gender: true,
      dateOfBirth: true,
      address: true,
      nationality: true,
      city: true,
      state: true,
      pincode: true,
      birthPlace: true,
      emergencyContact: true,
      emergencyPhone: true,
      smsOptIn: true,
      isActive: true,
      isEmailVerified: true,
      lastLoginAt: true,
      createdAt: true,
      studentProfile: {
        include: {
          class: { select: { id: true, name: true, programType: true, programTypeLabel: true } },
          gradeLevel: { select: { id: true, name: true } },
          busRoute: { select: { id: true, name: true } },
          religion: { select: { id: true, value: true } },
          category: { select: { id: true, value: true } },
          feeCategory: { select: { id: true, value: true } },
          source: { select: { id: true, value: true } },
          house: { select: { id: true, value: true, colorHex: true } },
          curriculum: { select: { id: true, value: true } },
          previousSchool: { select: { id: true, value: true } },
          parentLinks: {
            include: {
              parentProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      middleName: true,
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
          assignedClasses: { select: { id: true, name: true } },
          religion: { select: { id: true, value: true } },
          house: { select: { id: true, value: true, colorHex: true } },
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
                    select: { id: true, firstName: true, middleName: true, lastName: true },
                  },
                  class: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      adminProfile: {
        include: {
          religion: { select: { id: true, value: true } },
        },
      },
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
    middleName?: string | null;
    lastName: string;
    phone?: string | null;
    gender?: Gender;
    dateOfBirth?: Date;
    address?: string | null;
    nationality?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    birthPlace?: string | null;
    emergencyContact?: string | null;
    emergencyPhone?: string | null;
    avatar?: string | null;

    // Student-specific
    admissionNumber?: string | null;
    rollNumber?: string | null;
    classId?: string | null;
    gradeLevelId?: string | null;
    classIds?: string[];
    busRouteId?: string | null;
    usesTransport?: boolean | null;
    programType?: ProgramType | null;
    programTypeLabel?: string | null;
    bloodGroup?: string | null;
    medicalNotes?: string | null;
    status?: StudentStatus;
    fatherFirstName?: string | null;
    fatherMiddleName?: string | null;
    fatherLastName?: string | null;
    motherFirstName?: string | null;
    motherMiddleName?: string | null;
    motherLastName?: string | null;
    fatherMobile?: string | null;
    fatherPhoto?: string | null;
    motherMobile?: string | null;
    motherPhoto?: string | null;
    landline?: string | null;
    religionId?: string | null;
    categoryId?: string | null;
    feeCategoryId?: string | null;
    sourceId?: string | null;
    houseId?: string | null;
    curriculumId?: string | null;
    previousSchoolId?: string | null;
    previousClassYear?: string | null;
    reference?: string | null;

    // Teacher-specific
    employeeId?: string | null;
    qualification?: string | null;
    specialization?: string | null;
    designation?: string | null;
    experienceYears?: number | null;

    // Parent-specific
    occupation?: string | null;
    relation?: string | null;
    annualIncome?: string | null;
    education?: string | null;
    studentIds?: string[];

    // Admin-specific
    department?: string | null;
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

  const createPayload: any = {
    data: {
      schoolId,
      role: data.role,
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      middleName: data.middleName ?? null,
      lastName: data.lastName,
      phone: data.phone ?? null,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      address: data.address ?? null,
      nationality: data.nationality ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      pincode: data.pincode ?? null,
      birthPlace: data.birthPlace ?? null,
      emergencyContact: data.emergencyContact ?? null,
      emergencyPhone: data.emergencyPhone ?? null,
      avatar: data.avatar ?? null,

      // Create role-specific profile inline
      ...(data.role === Role.STUDENT && {
        studentProfile: {
          create: {
            admissionNumber: data.admissionNumber || `STU${Date.now()}`,
            rollNumber: data.rollNumber ?? null,
            classId: data.classId ?? null,
            gradeLevelId: data.gradeLevelId ?? null,
            busRouteId: data.usesTransport ? data.busRouteId ?? null : null,
            usesTransport: data.usesTransport ?? null,
            programType: data.programType ?? null,
            programTypeLabel: data.programTypeLabel ?? null,
            status: data.status || StudentStatus.ACTIVE,
            bloodGroup: data.bloodGroup ?? null,
            medicalNotes: data.medicalNotes ?? null,
            middleName: data.middleName ?? null,
            fatherFirstName: data.fatherFirstName ?? null,
            fatherMiddleName: data.fatherMiddleName ?? null,
            fatherLastName: data.fatherLastName ?? null,
            motherFirstName: data.motherFirstName ?? null,
            motherMiddleName: data.motherMiddleName ?? null,
            motherLastName: data.motherLastName ?? null,
            fatherMobile: data.fatherMobile ?? null,
            fatherPhoto: data.fatherPhoto ?? null,
            motherMobile: data.motherMobile ?? null,
            motherPhoto: data.motherPhoto ?? null,
            landline: data.landline ?? null,
            nationality: data.nationality ?? null,
            city: data.city ?? null,
            state: data.state ?? null,
            pincode: data.pincode ?? null,
            birthPlace: data.birthPlace ?? null,
            religionId: data.religionId ?? null,
            categoryId: data.categoryId ?? null,
            feeCategoryId: data.feeCategoryId ?? null,
            sourceId: data.sourceId ?? null,
            houseId: data.houseId ?? null,
            curriculumId: data.curriculumId ?? null,
            previousSchoolId: data.previousSchoolId ?? null,
            previousClassYear: data.previousClassYear ?? null,
            reference: data.reference ?? null,
          },
        },
      }),
      ...(data.role === Role.TEACHER && {
        teacherProfile: {
          create: {
            employeeId: data.employeeId || `TCH${Date.now()}`,
            qualification: data.qualification ?? null,
            specialization: data.specialization ?? null,
            designation: data.designation ?? null,
            experienceYears: data.experienceYears ?? null,
            religionId: data.religionId ?? null,
            houseId: data.houseId ?? null,
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
            occupation: data.occupation ?? null,
            relation: data.relation ?? null,
            annualIncome: data.annualIncome ?? null,
            education: data.education ?? null,
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
          create: {
            department: data.department ?? null,
            designation: data.designation ?? null,
            employeeId: data.employeeId || `ADM${Date.now()}`,
            religionId: data.religionId ?? null,
          },
        },
      }),
    },
    select: {
      id: true,
      role: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      createdAt: true,
      studentProfile: { select: { id: true, admissionNumber: true, status: true } },
      teacherProfile: { select: { id: true, employeeId: true } },
    },
  };

  let user: any;
  try {
    user = await db.user.create(createPayload);
  } catch (err: any) {
    const msg = String(err?.message ?? "").toLowerCase();
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
        // non-fatal
      }
    } else {
      throw err;
    }
  }

  // Invalidate dashboard cache
  try {
    await cacheDel(`dashboard:${schoolId}`);
  } catch (e) {
    // non-fatal
  }

  return user;
};

// ── Update user ──────────────────────────────────────────────────────────────
export const updateUser = async (
  id: string,
  schoolId: string,
  data: Partial<{
    firstName: string;
    middleName: string | null;
    lastName: string;
    phone: string | null;
    gender: Gender;
    dateOfBirth: Date;
    address: string | null;
    nationality: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    birthPlace: string | null;
    emergencyContact: string | null;
    emergencyPhone: string | null;
    avatar: string | null;
    isActive: boolean;
    smsOptIn: boolean;

    // Student fields
    admissionNumber: string | null;
    rollNumber: string | null;
    classId: string | null;
    gradeLevelId: string | null;
    busRouteId: string | null;
    usesTransport: boolean | null;
    programType: ProgramType | null;
    programTypeLabel: string | null;
    status: StudentStatus;
    bloodGroup: string | null;
    medicalNotes: string | null;
    fatherFirstName: string | null;
    fatherMiddleName: string | null;
    fatherLastName: string | null;
    motherFirstName: string | null;
    motherMiddleName: string | null;
    fatherMobile: string | null;
    fatherPhoto: string | null;
    motherMobile: string | null;
    motherPhoto: string | null;
    landline: string | null;
    religionId: string | null;
    categoryId: string | null;
    feeCategoryId: string | null;
    sourceId: string | null;
    houseId: string | null;
    curriculumId: string | null;
    previousSchoolId: string | null;
    previousClassYear: string | null;
    reference: string | null;

    // Teacher fields
    qualification: string | null;
    specialization: string | null;
    employeeId: string | null;
    designation: string | null;
    experienceYears: number | null;

    // Parent fields
    occupation: string | null;
    relation: string | null;
    annualIncome: string | null;
    education: string | null;

    // Admin fields
    department: string | null;
  }>,
) => {
  const user = await db.user.findFirst({ where: { id, schoolId }, include: { studentProfile: true } });
  if (!user) throw new AppError("User not found", 404);

  const updateData: any = { ...data };

  // Sync isActive with StudentStatus if status is provided
  if (data.status !== undefined) {
    if (data.status === StudentStatus.ARCHIVE || data.status === StudentStatus.INACTIVE) {
      updateData.isActive = false;
    } else if (data.status === StudentStatus.ACTIVE) {
      updateData.isActive = true;
    }
  }

  // Build StudentProfile update
  const studentFields = [
    "admissionNumber",
    "rollNumber",
    "classId",
    "gradeLevelId",
    "busRouteId",
    "usesTransport",
    "programType",
    "programTypeLabel",
    "status",
    "bloodGroup",
    "medicalNotes",
    "fatherFirstName",
    "fatherMiddleName",
    "fatherLastName",
    "fatherMobile",
    "fatherPhoto",
    "motherFirstName",
    "motherMiddleName",
    "motherLastName",
    "motherMobile",
    "motherPhoto",
    "landline",
    "religionId",
    "categoryId",
    "feeCategoryId",
    "sourceId",
    "houseId",
    "curriculumId",
    "previousSchoolId",
    "previousClassYear",
    "reference",
  ];

  const studentProfileData: any = {};
  let hasStudentData = false;

  for (const field of studentFields) {
    if ((data as any)[field] !== undefined) {
      studentProfileData[field] = (data as any)[field];
      delete updateData[field];
      hasStudentData = true;
    }
  }

  // If usesTransport is explicitly false, clear busRouteId
  if (studentProfileData.usesTransport === false) {
    studentProfileData.busRouteId = null;
  }

  // Also sync common personal fields to studentProfile if it exists
  if (data.middleName !== undefined) studentProfileData.middleName = data.middleName;
  if (data.nationality !== undefined) studentProfileData.nationality = data.nationality;
  if (data.city !== undefined) studentProfileData.city = data.city;
  if (data.state !== undefined) studentProfileData.state = data.state;
  if (data.pincode !== undefined) studentProfileData.pincode = data.pincode;
  if (data.birthPlace !== undefined) studentProfileData.birthPlace = data.birthPlace;

  if (hasStudentData || (user.studentProfile && Object.keys(studentProfileData).length > 0)) {
    updateData.studentProfile = {
      upsert: {
        create: {
          admissionNumber: data.admissionNumber || `STU${Date.now()}`,
          ...studentProfileData,
        },
        update: studentProfileData,
      },
    };
  }

  // Teacher Profile
  const teacherFields = ["qualification", "specialization", "employeeId", "designation", "experienceYears"];
  const teacherProfileData: any = {};
  let hasTeacherData = false;
  for (const field of teacherFields) {
    if ((data as any)[field] !== undefined) {
      teacherProfileData[field] = (data as any)[field];
      delete updateData[field];
      hasTeacherData = true;
    }
  }
  if (user.role === Role.TEACHER) {
    if (data.religionId !== undefined) {
      teacherProfileData.religionId = data.religionId;
      delete updateData.religionId;
      hasTeacherData = true;
    }
    if (data.houseId !== undefined) {
      teacherProfileData.houseId = data.houseId;
      delete updateData.houseId;
      hasTeacherData = true;
    }
  }
  if (hasTeacherData) {
    updateData.teacherProfile = {
      upsert: {
        create: {
          employeeId: data.employeeId || `TCH${Date.now()}`,
          ...teacherProfileData,
        },
        update: teacherProfileData,
      },
    };
  }

  // Admin Profile
  const adminFields = ["department", "designation"];
  const adminProfileData: any = {};
  let hasAdminData = false;
  for (const field of adminFields) {
    if ((data as any)[field] !== undefined) {
      adminProfileData[field] = (data as any)[field];
      delete updateData[field];
      hasAdminData = true;
    }
  }
  if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    if (data.employeeId !== undefined) {
      adminProfileData.employeeId = data.employeeId;
      delete updateData.employeeId;
      hasAdminData = true;
    }
    if (data.religionId !== undefined) {
      adminProfileData.religionId = data.religionId;
      delete updateData.religionId;
      hasAdminData = true;
    }
  }
  if (hasAdminData) {
    updateData.adminProfile = {
      upsert: {
        create: {
          employeeId: data.employeeId || `ADM${Date.now()}`,
          ...adminProfileData,
        },
        update: adminProfileData,
      },
    };
  }

  // Parent Profile
  const parentFields = ["occupation", "relation", "annualIncome", "education"];
  const parentProfileData: any = {};
  let hasParentData = false;
  for (const field of parentFields) {
    if ((data as any)[field] !== undefined) {
      parentProfileData[field] = (data as any)[field];
      delete updateData[field];
      hasParentData = true;
    }
  }
  if (hasParentData) {
    updateData.parentProfile = {
      upsert: {
        create: parentProfileData,
        update: parentProfileData,
      },
    };
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      phone: true,
      gender: true,
      dateOfBirth: true,
      address: true,
      nationality: true,
      city: true,
      state: true,
      pincode: true,
      birthPlace: true,
      emergencyContact: true,
      emergencyPhone: true,
      avatar: true,
      isActive: true,
      smsOptIn: true,
      studentProfile: {
        select: {
          id: true,
          admissionNumber: true,
          rollNumber: true,
          status: true,
        },
      },
    },
  });

  await cacheDel(`user:${id}`);
  return updated;
};

// ── Toggle user active status ────────────────────────────────────────────────
export const toggleUserStatus = async (id: string, schoolId: string) => {
  const user = await db.user.findFirst({
    where: { id, schoolId },
    include: { studentProfile: true },
  });
  if (!user) throw new AppError("User not found", 404);

  const nextActive = !user.isActive;

  const updateData: any = { isActive: nextActive };
  if (user.studentProfile) {
    updateData.studentProfile = {
      update: {
        status: nextActive ? StudentStatus.ACTIVE : StudentStatus.INACTIVE,
      },
    };
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
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
              status: StudentStatus.ACTIVE,
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
        where: {
          schoolId,
          role: Role.STUDENT,
          isActive: true,
          studentProfile: { is: { status: StudentStatus.ACTIVE } },
        },
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

// ── ID card ──────────────────────────────────────────────────────────────────
export const getIdCardPdf = async (userId: string, schoolId: string) => {
  const user = await db.user.findFirst({
    where: { id: userId, schoolId },
    include: {
      studentProfile: {
        include: {
          class: { include: { gradeLevel: true } },
          gradeLevel: true,
          house: true,
        },
      },
      teacherProfile: {
        include: {
          house: true,
        },
      },
      adminProfile: true,
      school: {
        select: { name: true, address: true, phone: true, email: true },
      },
    },
  });
  if (!user) throw new AppError("User not found", 404);

  const idNumber =
    user.studentProfile?.admissionNumber ??
    user.teacherProfile?.employeeId ??
    user.adminProfile?.employeeId ??
    user.id.slice(0, 8).toUpperCase();
  const roleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase();

  const className = user.studentProfile?.class?.name ?? null;
  const gradeLevelName =
    user.studentProfile?.class?.gradeLevel?.name ??
    user.studentProfile?.gradeLevel?.name ??
    null;

  const currentYear = new Date().getFullYear();
  const validThrough = `${currentYear} - ${currentYear + 1}`;

  const house = user.studentProfile?.house ?? user.teacherProfile?.house ?? null;
  const houseColor = house?.colorHex ?? undefined;

  const { generateIdCardPdf } = await import("../../utils/pdf");
  const pdf = await generateIdCardPdf({
    school: {
      name: user.school.name,
      address: user.school.address,
      phone: user.school.phone,
      email: user.school.email,
    },
    person: {
      name: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" "),
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
      bloodGroup: user.studentProfile?.bloodGroup ?? null,
      emergencyPhone: user.emergencyPhone ?? null,
      validThrough,
      houseName: house?.value ?? null,
      houseColor,
    },
    layout: "HORIZONTAL",
    colorMode: houseColor ? "STRIP" : "BACKGROUND",
    printBack: true,
  });

  return { pdf, fileName: `id-card-${idNumber}.pdf` };
};
