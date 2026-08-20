import { Role, NotificationType, ProgramType } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToUser, emitToSchool } from "../../config/socket";

// ════════════════════════════════════════════════════════════
// SUBJECTS
// ════════════════════════════════════════════════════════════

export const listSubjects = async (schoolId: string) =>
  (db.subject as any).findMany({
    where: { schoolId },
    include: {
      gradeLevel: {
        select: { id: true, name: true, level: true },
      },
      teachings: {
        include: {
          teacherProfile: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

export const createSubject = async (
  schoolId: string,
  data: {
    name: string;
    code: string;
    description?: string;
    creditHours?: number;
    isCore?: boolean;
    gradeLevelId?: string | null;
    gradeLevelIds?: string[];
  },
) => {
  const exists = await db.subject.findUnique({
    where: { schoolId_code: { schoolId, code: data.code } },
  });
  if (exists) throw new AppError("Subject code already exists", 409);

  let targetGradeLevelId: string | null = null;
  if (data.gradeLevelIds && data.gradeLevelIds.length === 1) {
    targetGradeLevelId = data.gradeLevelIds[0];
  } else if (data.gradeLevelId) {
    targetGradeLevelId = data.gradeLevelId;
  }

  if (targetGradeLevelId) {
    const gl = await db.gradeLevel.findFirst({
      where: { id: targetGradeLevelId, schoolId },
    });
    if (!gl) throw new AppError("Grade level not found", 404);
  }

  return (db.subject as any).create({
    data: {
      schoolId,
      gradeLevelId: targetGradeLevelId,
      name: data.name,
      code: data.code,
      description: data.description,
      creditHours: data.creditHours ?? 3,
      isCore: data.isCore ?? true,
    },
    include: {
      gradeLevel: {
        select: { id: true, name: true, level: true },
      },
    },
  });
};

export const updateSubject = async (
  schoolId: string,
  subjectId: string,
  data: {
    name?: string;
    code?: string;
    description?: string;
    creditHours?: number;
    isCore?: boolean;
    gradeLevelId?: string | null;
    gradeLevelIds?: string[];
  },
) => {
  const subject = await db.subject.findFirst({
    where: { id: subjectId, schoolId },
  });
  if (!subject) throw new AppError("Subject not found", 404);

  if (data.code && data.code !== subject.code) {
    const exists = await db.subject.findUnique({
      where: { schoolId_code: { schoolId, code: data.code } },
    });
    if (exists) throw new AppError("Subject code already exists", 409);
  }

  let targetGradeLevelId: string | null = subject.gradeLevelId;
  if (data.gradeLevelIds !== undefined) {
    targetGradeLevelId = data.gradeLevelIds.length === 1 ? data.gradeLevelIds[0] : null;
  } else if (data.gradeLevelId !== undefined) {
    targetGradeLevelId = data.gradeLevelId || null;
  }

  if (targetGradeLevelId) {
    const gl = await db.gradeLevel.findFirst({
      where: { id: targetGradeLevelId, schoolId },
    });
    if (!gl) throw new AppError("Grade level not found", 404);
  }

  return (db.subject as any).update({
    where: { id: subjectId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.creditHours !== undefined && { creditHours: data.creditHours }),
      ...(data.isCore !== undefined && { isCore: data.isCore }),
      gradeLevelId: targetGradeLevelId,
    },
    include: {
      gradeLevel: {
        select: { id: true, name: true, level: true },
      },
    },
  });
};

export const deleteSubject = async (schoolId: string, subjectId: string) => {
  const subject = await db.subject.findFirst({
    where: { id: subjectId, schoolId },
  });
  if (!subject) throw new AppError("Subject not found", 404);
  await db.subject.delete({ where: { id: subjectId } });
  return { id: subjectId };
};

export const listAssignments = async (
  schoolId: string,
  params: {
    search?: string;
    subjectId?: string;
    classId?: string;
    gradeLevelId?: string;
    termId?: string;
    type?: string;
    status?: string;
    sortBy?: string;
    createdById?: string;
    page: number;
    limit: number;
  },
) => {
  const { page, limit, search, subjectId, classId, gradeLevelId, termId, type, status, sortBy, createdById } = params;
  const skip = (page - 1) * limit;

  const now = new Date();
  const where: any = {
    schoolId,
    isPublished: true,
  };

  if (subjectId && subjectId !== "ALL") where.subjectId = subjectId;
  if (classId && classId !== "ALL") where.classId = classId;
  if (termId && termId !== "ALL") where.termId = termId;
  if (createdById) where.createdById = createdById;
  if (type && type !== "ALL") where.type = type;

  if (gradeLevelId && gradeLevelId !== "ALL") {
    where.subject = { gradeLevelId };
  }

  if (status === "OVERDUE") {
    where.dueDate = { lt: now };
  } else if (status === "ACTIVE" || status === "UPCOMING") {
    where.dueDate = { gte: now };
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { instructions: { contains: q, mode: "insensitive" } },
      { subject: { name: { contains: q, mode: "insensitive" } } },
      { subject: { code: { contains: q, mode: "insensitive" } } },
    ];
  }

  let orderBy: any = { dueDate: "asc" };
  if (sortBy === "due-desc") orderBy = { dueDate: "desc" };
  else if (sortBy === "title-asc") orderBy = { title: "asc" };
  else if (sortBy === "title-desc") orderBy = { title: "desc" };
  else if (sortBy === "created-desc") orderBy = { createdAt: "desc" };
  else if (sortBy === "marks-desc") orderBy = { totalMarks: "desc" };

  const [rawAssignments, total, schoolClasses] = await Promise.all([
    db.assignment.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            gradeLevel: { select: { id: true, name: true, level: true } },
          },
        },
        term: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
    }),
    db.assignment.count({ where }),
    db.class.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    }),
  ]);

  const classMap = new Map(schoolClasses.map((c) => [c.id, c.name]));
  const assignments = rawAssignments.map((a: any) => ({
    ...a,
    class: a.classId ? { id: a.classId, name: classMap.get(a.classId) || "Class" } : null,
  }));

  return { assignments, total };
};

export const getAssignment = async (id: string, schoolId: string) => {
  const assignment = await db.assignment.findFirst({
    where: { id, schoolId },
    include: {
      subject: {
        include: {
          gradeLevel: true,
        },
      },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      submissions: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
          },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!assignment) throw new AppError("Assignment not found", 404);

  // Fetch class details if classId is present
  let classData = null;
  let enrolledStudents: any[] = [];
  if (assignment.classId) {
    const [klass, students] = await Promise.all([
      db.class.findUnique({
        where: { id: assignment.classId },
        select: {
          id: true,
          name: true,
          gradeLevel: { select: { id: true, name: true } },
        },
      }),
      db.user.findMany({
        where: {
          schoolId,
          role: "STUDENT",
          studentProfile: { classId: assignment.classId },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          email: true,
          studentProfile: { select: { admissionNumber: true, rollNumber: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);
    classData = klass;
    enrolledStudents = students;
  }

  // Build unified roster submission tracking
  const submissionMap = new Map(assignment.submissions.map((s: any) => [s.studentId, s]));
  const fullRoster = enrolledStudents.map((stu) => {
    const sub: any = submissionMap.get(stu.id);
    return {
      studentId: stu.id,
      student: stu,
      submissionId: sub?.id || null,
      status: sub ? sub.status : "NOT_SUBMITTED",
      submittedAt: sub?.submittedAt || null,
      marksObtained: sub?.marksObtained ?? null,
      feedback: sub?.feedback || null,
      content: sub?.content || null,
      attachments: sub?.attachments || [],
    };
  });

  return {
    ...assignment,
    class: classData,
    enrolledStudentsCount: enrolledStudents.length,
    fullRoster,
  };
};

export const createAssignment = async (
  schoolId: string,
  createdById: string,
  data: {
    subjectId: string;
    classId?: string;
    classIds?: string[];
    teacherId?: string;
    termId: string;
    title: string;
    description?: string;
    instructions?: string;
    type?: string;
    totalMarks?: number;
    passingMarks?: number;
    dueDate: Date;
    isPublished?: boolean;
    allowLate?: boolean;
    attachments?: string[];
  },
) => {
  const targetClassIds =
    data.classIds && data.classIds.length > 0
      ? data.classIds
      : data.classId
      ? [data.classId]
      : [undefined];

  const createdList = [];

  for (const cid of targetClassIds) {
    const { classIds, teacherId, ...cleanData } = data;
    const assignment = await db.assignment.create({
      data: {
        schoolId,
        createdById: data.teacherId || createdById,
        ...cleanData,
        classId: cid || null,
      },
      include: { subject: { select: { name: true } } },
    });
    createdList.push(assignment);

    // Notify students in the class if published
    if (assignment.isPublished && cid) {
      const students = await db.user.findMany({
        where: {
          schoolId,
          role: "STUDENT",
          studentProfile: { classId: cid },
        },
        select: { id: true },
      });

      if (students.length > 0) {
        await db.notification.createMany({
          data: students.map((s) => ({
            schoolId,
            userId: s.id,
            type: "ASSIGNMENT" as const,
            title: "New Assignment",
            body: `${assignment.subject.name}: ${assignment.title} — due ${assignment.dueDate.toLocaleDateString()}`,
            assignmentId: assignment.id,
          })),
        });

        students.forEach((s) =>
          emitToUser(s.id, "notification:new", {
            type: "ASSIGNMENT",
            title: "New Assignment",
            body: assignment.title,
          }),
        );
      }
    }
  }

  return createdList.length === 1 ? createdList[0] : createdList;
};

export const updateAssignment = async (
  id: string,
  schoolId: string,
  data: Partial<{
    title: string;
    description: string;
    instructions: string;
    dueDate: Date;
    totalMarks: number;
    passingMarks: number;
    isPublished: boolean;
    allowLate: boolean;
    attachments: string[];
  }>,
) => {
  const assignment = await db.assignment.findFirst({ where: { id, schoolId } });
  if (!assignment) throw new AppError("Assignment not found", 404);
  return db.assignment.update({
    where: { id },
    data,
    include: { subject: { select: { name: true } } },
  });
};

export const deleteAssignment = async (id: string, schoolId: string) => {
  const assignment = await db.assignment.findFirst({ where: { id, schoolId } });
  if (!assignment) throw new AppError("Assignment not found", 404);
  await db.assignment.delete({ where: { id } });
};

// ── Submissions ──────────────────────────────────────────────────────────────

export const submitAssignment = async (
  assignmentId: string,
  studentId: string,
  schoolId: string,
  data: { content?: string; attachments?: string[] },
) => {
  const assignment = await db.assignment.findFirst({
    where: { id: assignmentId, schoolId, isPublished: true },
  });
  if (!assignment) throw new AppError("Assignment not found", 404);

  const now = new Date();
  const isLate = now > assignment.dueDate;
  if (isLate && !assignment.allowLate)
    throw new AppError("Assignment deadline has passed", 400);

  const submission = await db.submission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    update: {
      ...data,
      status: isLate ? "LATE" : "SUBMITTED",
      submittedAt: now,
    },
    create: {
      assignmentId,
      studentId,
      ...data,
      status: isLate ? "LATE" : "SUBMITTED",
      submittedAt: now,
    },
  });

  // Notify teacher
  emitToUser(assignment.createdById, "notification:new", {
    type: "ASSIGNMENT",
    title: "New Submission",
    body: `A student submitted: ${assignment.title}`,
  });

  return submission;
};

export const gradeSubmission = async (
  submissionId: string,
  gradedById: string,
  schoolId: string,
  data: { marksObtained: number; feedback?: string },
) => {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });
  if (!submission || submission.assignment.schoolId !== schoolId)
    throw new AppError("Submission not found", 404);
  if (data.marksObtained > submission.assignment.totalMarks)
    throw new AppError(
      `Marks cannot exceed total (${submission.assignment.totalMarks})`,
      400,
    );

  const updated = await db.submission.update({
    where: { id: submissionId },
    data: { ...data, status: "GRADED", gradedById, gradedAt: new Date() },
  });

  // Notify student
  emitToUser(submission.studentId, "notification:new", {
    type: "GRADE",
    title: "Assignment Graded",
    body: `Your submission for "${submission.assignment.title}" has been graded: ${data.marksObtained}/${submission.assignment.totalMarks}`,
  });

  await db.notification.create({
    data: {
      schoolId,
      userId: submission.studentId,
      type: "GRADE",
      title: "Assignment Graded",
      body: `${submission.assignment.title}: ${data.marksObtained}/${submission.assignment.totalMarks}`,
    },
  });

  return updated;
};

// ════════════════════════════════════════════════════════════
// EXAMS
// ════════════════════════════════════════════════════════════

export const listExams = async (
  schoolId: string,
  params: {
    search?: string;
    classId?: string;
    gradeLevelId?: string;
    subjectId?: string;
    termId?: string;
    examType?: any;
    status?: string;
    sortBy?: string;
    page: number;
    limit: number;
  },
) => {
  const {
    page,
    limit,
    search,
    classId,
    gradeLevelId,
    subjectId,
    termId,
    examType,
    status,
    sortBy,
  } = params;
  const skip = (page - 1) * limit;

  const where: any = { schoolId };

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { venue: { contains: q, mode: "insensitive" } },
      { instructions: { contains: q, mode: "insensitive" } },
      { subject: { is: { name: { contains: q, mode: "insensitive" } } } },
      { subject: { is: { code: { contains: q, mode: "insensitive" } } } },
    ];
  }

  if (classId && classId !== "ALL") {
    where.classId = classId;
  }

  if (gradeLevelId && gradeLevelId !== "ALL") {
    where.OR = [
      ...(where.OR || []),
      { gradeLevelId },
      { class: { is: { gradeLevelId } } },
    ];
  }

  if (subjectId && subjectId !== "ALL") {
    where.subjectId = subjectId;
  }

  if (termId && termId !== "ALL") {
    where.termId = termId;
  }

  if (examType && examType !== "ALL") {
    where.examType = examType;
  }

  const now = new Date();
  if (status === "UPCOMING") {
    where.scheduledAt = { gte: now };
  } else if (status === "COMPLETED") {
    where.scheduledAt = { lt: now };
  } else if (status === "PUBLISHED") {
    where.isPublished = true;
  } else if (status === "DRAFT") {
    where.isPublished = false;
  }

  let orderBy: any = { scheduledAt: "asc" };
  if (sortBy === "date-desc") {
    orderBy = { scheduledAt: "desc" };
  } else if (sortBy === "title-asc") {
    orderBy = { title: "asc" };
  } else if (sortBy === "title-desc") {
    orderBy = { title: "desc" };
  } else if (sortBy === "marks-desc") {
    orderBy = { totalMarks: "desc" };
  } else if (sortBy === "created-desc") {
    orderBy = { createdAt: "desc" };
  }

  const [exams, total] = await Promise.all([
    db.exam.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, gradeLevel: { select: { id: true, name: true } } } },
        gradeLevel: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
    }),
    db.exam.count({ where }),
  ]);

  return { exams, total };
};

export const updateExam = async (
  id: string,
  schoolId: string,
  data: {
    subjectId?: string;
    classId?: string;
    gradeLevelId?: string;
    termId?: string;
    title?: string;
    examType?: any;
    totalMarks?: number;
    passingMarks?: number;
    duration?: number;
    scheduledAt?: Date;
    venue?: string;
    instructions?: string;
    isPublished?: boolean;
  },
) => {
  const existing = await db.exam.findFirst({ where: { id, schoolId } });
  if (!existing) throw new AppError("Exam not found", 404);

  const updated = await db.exam.update({
    where: { id },
    data,
    include: {
      subject: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true, gradeLevel: { select: { id: true, name: true } } } },
      gradeLevel: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
    },
  });
  return updated;
};

export const deleteExam = async (id: string, schoolId: string) => {
  const existing = await db.exam.findFirst({ where: { id, schoolId } });
  if (!existing) throw new AppError("Exam not found", 404);

  await db.exam.delete({ where: { id } });
  return { success: true };
};

export const createExam = async (
  schoolId: string,
  data: {
    subjectId: string;
    classId?: string;
    gradeLevelId?: string;
    termId: string;
    title: string;
    examType?: any;
    totalMarks?: number;
    passingMarks?: number;
    duration: number;
    scheduledAt: Date;
    venue?: string;
    instructions?: string;
  },
) => {
  const exam = await db.exam.create({
    data: { schoolId, ...data, isPublished: false },
    include: { subject: { select: { name: true } } },
  });
  return exam;
};

export const publishExam = async (id: string, schoolId: string) => {
  const exam = await db.exam.findFirst({ where: { id, schoolId } });
  if (!exam) throw new AppError("Exam not found", 404);
  const updated = await db.exam.update({
    where: { id },
    data: { isPublished: true },
  });

  // Notify students
  if (exam.classId) {
    const students = await db.user.findMany({
      where: {
        schoolId,
        role: "STUDENT",
        studentProfile: { classId: exam.classId },
      },
      select: { id: true },
    });
    await db.notification.createMany({
      data: students.map((s) => ({
        schoolId,
        userId: s.id,
        type: "EXAM" as const,
        title: "Exam Scheduled",
        body: `${exam.title} on ${exam.scheduledAt.toLocaleDateString()} at ${exam.venue ?? "TBA"}`,
      })),
    });
    students.forEach((s) =>
      emitToUser(s.id, "notification:new", {
        type: "EXAM",
        title: "Exam Scheduled",
        body: exam.title,
      }),
    );
  }

  return updated;
};

export const recordExamResults = async (
  examId: string,
  schoolId: string,
  results: Array<{
    studentId: string;
    marksObtained: number;
    isAbsent?: boolean;
    remarks?: string;
  }>,
) => {
  const exam = await db.exam.findFirst({ where: { id: examId, schoolId } });
  if (!exam) throw new AppError("Exam not found", 404);

  const computeGrade = (marks: number, total: number): string => {
    const pct = (marks / total) * 100;
    if (pct >= 90) return "A+";
    if (pct >= 80) return "A";
    if (pct >= 70) return "B";
    if (pct >= 60) return "C";
    if (pct >= 50) return "D";
    return "F";
  };

  const ops = results.map((r) =>
    db.examResult.upsert({
      where: { examId_studentId: { examId, studentId: r.studentId } },
      update: {
        marksObtained: r.marksObtained,
        grade: computeGrade(r.marksObtained, exam.totalMarks),
        isAbsent: r.isAbsent ?? false,
        remarks: r.remarks,
      },
      create: {
        examId,
        studentId: r.studentId,
        marksObtained: r.marksObtained,
        grade: computeGrade(r.marksObtained, exam.totalMarks),
        isAbsent: r.isAbsent ?? false,
        remarks: r.remarks,
      },
    }),
  );

  const saved = await db.$transaction(ops);

  // Notify each student
  for (const r of results) {
    emitToUser(r.studentId, "notification:new", {
      type: "GRADE",
      title: "Exam Result Published",
      body: `${exam.title}: ${r.marksObtained}/${exam.totalMarks}`,
    });
  }

  return saved;
};

export const getParentChildren = async (parentUserId: string, schoolId: string) => {
  const parentProfile = await db.parentProfile.findUnique({
    where: { userId: parentUserId },
    include: {
      studentLinks: {
        include: {
          studentProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true,
                  gender: true,
                  dateOfBirth: true,
                },
              },
              class: {
                select: {
                  id: true,
                  name: true,
                  academicYear: true,
                  gradeLevel: { select: { id: true, name: true, level: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parentProfile) return [];

  return parentProfile.studentLinks.map((link) => ({
    linkId: link.id,
    relation: link.relation,
    isPrimary: link.isPrimary,
    studentProfileId: link.studentProfile.id,
    userId: link.studentProfile.user.id,
    firstName: link.studentProfile.user.firstName,
    lastName: link.studentProfile.user.lastName,
    fullName: `${link.studentProfile.user.firstName} ${link.studentProfile.user.lastName}`,
    email: link.studentProfile.user.email,
    avatar: link.studentProfile.user.avatar,
    gender: link.studentProfile.user.gender,
    dateOfBirth: link.studentProfile.user.dateOfBirth,
    rollNumber: link.studentProfile.rollNumber,
    admissionNumber: link.studentProfile.admissionNumber,
    class: link.studentProfile.class,
  }));
};

export const getStudentResults = async (
  studentId: string,
  schoolId: string,
  termId?: string,
  requestingUser?: { id: string; role: Role },
) => {
  let targetUserId = studentId;

  // If requesting user is PARENT, check that parent is linked to this student
  if (requestingUser && requestingUser.role === Role.PARENT) {
    const parentProfile = await db.parentProfile.findUnique({
      where: { userId: requestingUser.id },
    });
    if (!parentProfile) throw new AppError("Parent profile not found", 404);

    // If studentId wasn't passed or is parent's own ID, default to first linked child
    if (!targetUserId || targetUserId === requestingUser.id) {
      const firstLink = await db.parentStudentLink.findFirst({
        where: { parentProfileId: parentProfile.id },
        include: { studentProfile: { include: { user: true } } },
      });
      if (!firstLink) throw new AppError("No linked students found for this parent account", 404);
      targetUserId = firstLink.studentProfile.user.id;
    } else {
      // Verify link
      const link = await db.parentStudentLink.findFirst({
        where: {
          parentProfileId: parentProfile.id,
          OR: [
            { studentProfile: { userId: targetUserId } },
            { studentProfileId: targetUserId },
          ],
        },
        include: { studentProfile: { select: { userId: true } } },
      });
      if (!link) throw new AppError("Access denied: You can only view your own children's results", 403);
      targetUserId = link.studentProfile.userId;
    }
  }

  const studentProfile = await db.studentProfile.findFirst({
    where: {
      OR: [{ userId: targetUserId }, { id: targetUserId }],
      user: { schoolId },
    },
  });
  if (!studentProfile) throw new AppError("Student profile not found", 404);

  const examResults = await db.examResult.findMany({
    where: {
      studentId: studentProfile.id,
      exam: { schoolId, ...(termId && { termId }) },
    },
    include: {
      exam: { include: { subject: { select: { name: true, code: true } } } },
    },
    orderBy: { exam: { scheduledAt: "desc" } },
  });

  const submissionResults = await db.submission.findMany({
    where: {
      studentId: studentProfile.userId,
      status: "GRADED",
      assignment: { schoolId, ...(termId && { termId }) },
    },
    include: {
      assignment: {
        include: { subject: { select: { name: true, code: true } } },
      },
    },
    orderBy: { gradedAt: "desc" },
  });

  return {
    examResults,
    submissionResults,
    studentProfileId: studentProfile.id,
    studentUserId: studentProfile.userId,
  };
};

// ════════════════════════════════════════════════════════════
// GRADE REPORTS
// ════════════════════════════════════════════════════════════

export const generateGradeReport = async (
  studentId: string,
  termId: string,
  schoolId: string,
) => {
  const student = await db.studentProfile.findUnique({
    where: { userId: studentId },
  });
  if (!student) throw new AppError("Student not found", 404);

  // Aggregate exam results for this term
  const examResults = await db.examResult.findMany({
    where: { studentId: student.id, exam: { termId, schoolId } },
    include: { exam: true },
  });

  if (examResults.length === 0)
    throw new AppError("No results found for this term", 404);

  // A student must be assigned to a class before a report can be generated —
  // previously this silently fell back to classId: '', which created a
  // GradeReport that could never appear in any class's ranking (bug found
  // during Phase 1 verification; fixed here instead of masking it).
  if (!student.classId)
    throw new AppError(
      "Student is not assigned to a class — assign a class before generating a report",
      400,
    );

  const totalMarks = examResults.reduce((s, r) => s + r.marksObtained, 0);
  const maxMarks = examResults.reduce((s, r) => s + r.exam.totalMarks, 0);
  const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;

  // GPA (4.0 scale)
  const gpa =
    percentage >= 90
      ? 4.0
      : percentage >= 80
        ? 3.7
        : percentage >= 70
          ? 3.3
          : percentage >= 60
            ? 2.7
            : percentage >= 50
              ? 2.0
              : 0.0;

  const report = await db.gradeReport.upsert({
    where: { studentId_termId: { studentId: student.id, termId } },
    update: { gpa, totalMarks, percentage, classId: student.classId },
    create: {
      studentId: student.id,
      termId,
      classId: student.classId,
      gpa,
      totalMarks,
      percentage,
    },
  });

  return { ...report, breakdown: examResults };
};

export const publishGradeReport = async (
  studentId: string,
  termId: string,
  schoolId: string,
) => {
  const student = await db.studentProfile.findUnique({
    where: { userId: studentId },
  });
  if (!student) throw new AppError("Student not found", 404);

  const report = await db.gradeReport.update({
    where: { studentId_termId: { studentId: student.id, termId } },
    data: { isPublished: true, publishedAt: new Date() },
  });

  // Notify student and parents
  emitToUser(studentId, "notification:new", {
    type: "GRADE",
    title: "Report Card Available",
    body: "Your term report card is now available.",
  });

  const parentLinks = await db.parentStudentLink.findMany({
    where: { studentProfileId: student.id },
    include: { parentProfile: { include: { user: true } } },
  });

  parentLinks.forEach((link) => {
    emitToUser(link.parentProfile.user.id, "notification:new", {
      type: "GRADE",
      title: "Child Report Card Available",
      body: `Report card for your child is now available.`,
    });
  });

  return report;
};

// ── Class ranking (requirement doc: "dynamic GPA/grade calculation and
// student class ranking generator") ─────────────────────────────────────────
// GradeReport.rank has existed in the schema but nothing populated it until now.
// This ranks every student who has a GradeReport for a given class + term,
// ordered by percentage (ties broken by GPA), and writes the rank back.
export const computeClassRankings = async (
  classId: string,
  termId: string,
  schoolId: string,
) => {
  const cls = await db.class.findFirst({ where: { id: classId, schoolId } });
  if (!cls) throw new AppError("Class not found", 404);

  const reports = await db.gradeReport.findMany({
    where: { classId, termId },
    orderBy: [{ percentage: "desc" }, { gpa: "desc" }],
  });

  if (reports.length === 0)
    throw new AppError(
      "No grade reports found for this class and term — generate reports first",
      404,
    );

  // Standard competition ranking (1224): equal scores share the same rank,
  // and the next distinct score skips ranks accordingly.
  const updates = reports.map((report, index) => {
    const prev = reports[index - 1];
    const tied =
      prev && prev.percentage === report.percentage && prev.gpa === report.gpa;
    const rank = tied ? (prev as any)._resolvedRank : index + 1;
    (report as any)._resolvedRank = rank;
    return db.gradeReport.update({ where: { id: report.id }, data: { rank } });
  });

  const updated = await Promise.all(updates);
  return updated.map((r) => ({
    studentId: r.studentId,
    rank: r.rank,
    percentage: r.percentage,
    gpa: r.gpa,
  }));
};

// ── Best-performing / at-risk student identification (requirement doc:
// Smart Administrative Insights dashboard) ──────────────────────────────────
export const getStudentPerformanceInsights = async (
  schoolId: string,
  termId: string,
  opts: { atRiskThresholdPercentage?: number; topCount?: number } = {},
) => {
  const atRiskThreshold = opts.atRiskThresholdPercentage ?? 50;
  const topCount = opts.topCount ?? 10;

  const reports = await db.gradeReport.findMany({
    where: { termId, student: { class: { schoolId } } },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
        },
      },
    },
    orderBy: { percentage: "desc" },
  });

  const topPerformers = reports.slice(0, topCount).map(toStudentSummary);
  const atRisk = reports
    .filter((r) => (r.percentage ?? 100) < atRiskThreshold)
    .sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0))
    .map(toStudentSummary);

  const passCount = reports.filter(
    (r) => (r.percentage ?? 0) >= atRiskThreshold,
  ).length;
  const passFailRate =
    reports.length > 0
      ? {
          passed: passCount,
          failed: reports.length - passCount,
          passRate: Math.round((passCount / reports.length) * 1000) / 10,
        }
      : { passed: 0, failed: 0, passRate: 0 };

  return {
    topPerformers,
    atRisk,
    passFailRate,
    totalStudentsGraded: reports.length,
  };
};

function toStudentSummary(r: any) {
  return {
    studentId: r.studentId,
    name: `${r.student.user.firstName} ${r.student.user.lastName}`,
    className: r.student.class?.name ?? null,
    percentage: r.percentage,
    gpa: r.gpa,
    rank: r.rank,
  };
}

// ── Printable documents (requirement doc: "Auto-generate official, printable
// end-of-term student report cards (PDF export)") ────────────────────────────
export const getReportCardPdf = async (
  studentId: string,
  termId: string,
  schoolId: string,
  requestingUser?: { id: string; role: Role },
) => {
  let targetId = studentId;
  if (requestingUser && requestingUser.role === Role.PARENT) {
    const parentProfile = await db.parentProfile.findUnique({
      where: { userId: requestingUser.id },
    });
    if (!parentProfile) throw new AppError("Parent profile not found", 404);

    if (!targetId || targetId === requestingUser.id) {
      const firstLink = await db.parentStudentLink.findFirst({
        where: { parentProfileId: parentProfile.id },
        include: { studentProfile: true },
      });
      if (!firstLink) throw new AppError("No linked student found", 404);
      targetId = firstLink.studentProfile.userId;
    } else {
      const link = await db.parentStudentLink.findFirst({
        where: {
          parentProfileId: parentProfile.id,
          OR: [
            { studentProfile: { userId: targetId } },
            { studentProfileId: targetId },
          ],
        },
        include: { studentProfile: true },
      });
      if (!link) throw new AppError("Access denied: You can only download your child's report card", 403);
      targetId = link.studentProfile.userId;
    }
  }

  const student = await db.studentProfile.findFirst({
    where: {
      OR: [{ userId: targetId }, { id: targetId }],
      user: { schoolId },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
      class: true,
    },
  });
  if (!student) throw new AppError("Student not found", 404);

  const term = await db.academicTerm.findFirst({
    where: { id: termId, schoolId },
  });
  if (!term) throw new AppError("Term not found", 404);

  const report = await db.gradeReport.findUnique({
    where: { studentId_termId: { studentId: student.id, termId } },
  });
  if (!report)
    throw new AppError(
      "No grade report has been generated for this student/term yet — call reports/generate first",
      404,
    );

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new AppError("School not found", 404);

  const examResults = await db.examResult.findMany({
    where: { studentId: student.id, exam: { termId, schoolId } },
    include: { exam: { include: { subject: { select: { name: true } } } } },
  });

  const classSize = student.classId
    ? await db.studentProfile.count({ where: { classId: student.classId } })
    : null;

  const { generateReportCardPdf } = await import("../../utils/pdf");
  const pdf = await generateReportCardPdf({
    school: {
      name: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
    },
    student: {
      name: `${student.user.firstName} ${student.user.lastName}`,
      admissionNumber: student.admissionNumber,
      className: student.class?.name ?? "—",
    },
    term: { name: term.name, academicYear: term.academicYear },
    subjects: examResults.map((r) => ({
      subjectName: r.exam.subject.name,
      marksObtained: r.marksObtained,
      totalMarks: r.exam.totalMarks,
      grade: r.grade,
    })),
    totalMarks: report.totalMarks ?? 0,
    maxMarks: examResults.reduce((s, r) => s + r.exam.totalMarks, 0),
    percentage: report.percentage ?? 0,
    gpa: report.gpa,
    rank: report.rank,
    classSize,
    teacherComment: report.teacherComment,
  });

  return {
    pdf,
    fileName: `report-card-${student.admissionNumber}-${term.name}.pdf`,
  };
};

export const getMarkSheetPdf = async (examId: string, schoolId: string) => {
  const exam = await db.exam.findFirst({
    where: { id: examId, schoolId },
    include: { subject: true, class: true },
  });
  if (!exam) throw new AppError("Exam not found", 404);

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new AppError("School not found", 404);

  const results = await db.examResult.findMany({
    where: { examId },
    include: {
      student: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: { student: { rollNumber: "asc" } },
  });

  const { generateMarkSheetPdf } = await import("../../utils/pdf");
  const pdf = await generateMarkSheetPdf({
    school: {
      name: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
    },
    examTitle: exam.title,
    subjectName: exam.subject.name,
    className: exam.class?.name ?? "—",
    totalMarks: exam.totalMarks,
    rows: results.map((r) => ({
      rollNumber: r.student.rollNumber,
      name: `${r.student.user.firstName} ${r.student.user.lastName}`,
      marksObtained: r.marksObtained,
      grade: r.grade,
      isAbsent: r.isAbsent,
    })),
  });

  return {
    pdf,
    fileName: `marksheet-${exam.subject.code}-${exam.title.replace(/\s+/g, "-")}.pdf`,
  };
};

// ── Subjects/Classes management ──────────────────────────────────────────────
export const listClasses = async (
  schoolId: string,
  params?: { programType?: ProgramType },
) => {
  const where: any = { schoolId };
  if (params?.programType && (params.programType as any) !== "ALL") {
    where.programType = params.programType;
  }

  return db.class.findMany({
    where,
    include: {
      gradeLevel: { select: { name: true } },
      classTeacher: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      _count: { select: { students: true } },
    },
    orderBy: [{ gradeLevel: { level: "asc" } }, { name: "asc" }],
  });
};

export const createClass = async (
  schoolId: string,
  data: {
    gradeLevelId: string;
    name: string;
    academicYear: string;
    capacity?: number;
    room?: string;
    programType?: ProgramType;
    programTypeLabel?: string | null;
  },
) => {
  if (!data.gradeLevelId?.trim()) {
    throw new AppError("Grade level is required", 400);
  }

  const gradeLevel = await db.gradeLevel.findUnique({
    where: { id: data.gradeLevelId },
    select: { schoolId: true },
  });

  if (!gradeLevel || gradeLevel.schoolId !== schoolId) {
    throw new AppError("Grade level not found", 404);
  }

  return db.class.create({ data: { schoolId, ...data } });
};

export const listTerms = async (schoolId: string) =>
  db.academicTerm.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
  });

export const createTerm = async (
  schoolId: string,
  data: {
    name: string;
    academicYear: string;
    startDate: Date;
    endDate: Date;
    isCurrent?: boolean;
  },
) => {
  if (data.isCurrent) {
    await db.academicTerm.updateMany({
      where: { schoolId, isCurrent: true },
      data: { isCurrent: false },
    });
  }
  return db.academicTerm.create({ data: { schoolId, ...data } });
};

// ── Class management (newly added) ───────────────────────────────────────────
export const getClassById = async (schoolId: string, classId: string) => {
  const klass = await db.class.findFirst({
    where: { id: classId, schoolId },
    include: {
      gradeLevel: { select: { id: true, name: true, level: true } },
      classTeacher: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      students: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (!klass) throw new AppError("Class not found", 404);
  return klass;
};

export const updateClass = async (
  schoolId: string,
  classId: string,
  data: {
    gradeLevelId?: string;
    name?: string;
    academicYear?: string;
    capacity?: number;
    room?: string;
    programType?: ProgramType;
    programTypeLabel?: string | null;
  },
) => {
  const klass = await db.class.findFirst({ where: { id: classId, schoolId } });
  if (!klass) throw new AppError("Class not found", 404);

  if (data.gradeLevelId) {
    const gradeLevel = await db.gradeLevel.findUnique({
      where: { id: data.gradeLevelId },
      select: { schoolId: true },
    });

    if (!gradeLevel || gradeLevel.schoolId !== schoolId) {
      throw new AppError("Grade level not found", 404);
    }
  }

  return db.class.update({
    where: { id: classId },
    data,
    include: {
      gradeLevel: { select: { id: true, name: true, level: true } },
      classTeacher: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      _count: { select: { students: true } },
    },
  });
};

export const deleteClass = async (schoolId: string, classId: string) => {
  const klass = await db.class.findFirst({ where: { id: classId, schoolId } });
  if (!klass) throw new AppError("Class not found", 404);

  await db.class.delete({ where: { id: classId } });
  return { success: true };
};

// ════════════════════════════════════════════════════════════
// TEACHER ASSIGNMENTS & GRADE ROSTER (Continuous Assessment & Final Exam)
// ════════════════════════════════════════════════════════════

export const getTeacherTeachingAssignments = async (
  schoolId: string,
  userId: string,
  role: Role,
) => {
  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
    const [allClasses, allSubjects, allTerms] = await Promise.all([
      db.class.findMany({
        where: { schoolId },
        include: {
          gradeLevel: { select: { id: true, name: true, level: true } },
          _count: { select: { students: true } },
        },
        orderBy: [{ gradeLevel: { level: "asc" } }, { name: "asc" }],
      }),
      db.subject.findMany({
        where: { schoolId },
        include: { gradeLevel: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      }),
      db.academicTerm.findMany({
        where: { schoolId },
        orderBy: { startDate: "desc" },
      }),
    ]);
    return { classes: allClasses, subjects: allSubjects, terms: allTerms, isFullAccess: true };
  }

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId },
    include: {
      subjectTeachings: {
        include: {
          class: {
            include: {
              gradeLevel: { select: { id: true, name: true, level: true } },
              _count: { select: { students: true } },
            },
          },
          subject: {
            include: { gradeLevel: { select: { id: true, name: true } } },
          },
        },
      },
      assignedClasses: {
        include: {
          gradeLevel: { select: { id: true, name: true, level: true } },
          _count: { select: { students: true } },
        },
      },
      classTeacherOf: {
        include: {
          gradeLevel: { select: { id: true, name: true, level: true } },
          _count: { select: { students: true } },
        },
      },
    },
  });

  const terms = await db.academicTerm.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
  });

  const assignedClassesMap = new Map<string, any>();
  const assignedSubjectsMap = new Map<string, any>();

  (teacherProfile?.subjectTeachings ?? []).forEach((t) => {
    if (t.class) assignedClassesMap.set(t.class.id, t.class);
    if (t.subject) assignedSubjectsMap.set(t.subject.id, t.subject);
  });

  (teacherProfile?.assignedClasses ?? []).forEach((c) => {
    assignedClassesMap.set(c.id, c);
  });

  if (teacherProfile?.classTeacherOf) {
    assignedClassesMap.set(teacherProfile.classTeacherOf.id, teacherProfile.classTeacherOf);
  }

  let assignedClasses = Array.from(assignedClassesMap.values());
  let assignedSubjects = Array.from(assignedSubjectsMap.values());

  // Fallback: If no explicit SubjectTeaching linked yet, fetch all school classes & subjects
  if (assignedClasses.length === 0) {
    assignedClasses = await db.class.findMany({
      where: { schoolId },
      include: {
        gradeLevel: { select: { id: true, name: true, level: true } },
        _count: { select: { students: true } },
      },
      orderBy: [{ gradeLevel: { level: "asc" } }, { name: "asc" }],
    });
  }

  if (assignedSubjects.length === 0) {
    assignedSubjects = await db.subject.findMany({
      where: { schoolId },
      include: { gradeLevel: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
  }

  return {
    classes: assignedClasses,
    subjects: assignedSubjects,
    terms,
    isFullAccess: false,
  };
};

export const getClassGradeRoster = async (
  schoolId: string,
  params: {
    classId: string;
    subjectId?: string;
    termId: string;
  },
) => {
  const { classId, subjectId, termId } = params;

  const [school, klass, term, subject] = await Promise.all([
    db.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        logo: true,
        address: true,
        city: true,
        country: true,
        phone: true,
        email: true,
        academicYear: true,
      },
    }),
    db.class.findFirst({
      where: { id: classId, schoolId },
      include: {
        gradeLevel: { select: { id: true, name: true, level: true } },
        classTeacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                gender: true,
                dateOfBirth: true,
              },
            },
          },
          orderBy: { rollNumber: "asc" },
        },
      },
    }),
    db.academicTerm.findFirst({
      where: { id: termId, schoolId },
    }),
    subjectId
      ? db.subject.findFirst({
          where: { id: subjectId, schoolId },
          include: { gradeLevel: true },
        })
      : null,
  ]);

  if (!klass) throw new AppError("Class not found", 404);
  if (!term) throw new AppError("Academic term not found", 404);

  // Find or create Continuous Assessment and Final Exam for this subject & class & term
  let caExam: any = null;
  let finalExam: any = null;

  if (subjectId) {
    [caExam, finalExam] = await Promise.all([
      db.exam.findFirst({
        where: {
          schoolId,
          classId,
          subjectId,
          termId,
          examType: { in: ["MID_TERM", "QUIZ", "STANDARDIZED"] },
        },
      }),
      db.exam.findFirst({
        where: {
          schoolId,
          classId,
          subjectId,
          termId,
          examType: "FINAL",
        },
      }),
    ]);

    // Auto-create standard CA and Final Exam slots if they don't exist yet
    if (!caExam) {
      caExam = await db.exam.create({
        data: {
          schoolId,
          classId,
          subjectId,
          termId,
          title: "Continuous Assessment (Tests, Quizzes & Assignments)",
          examType: "MID_TERM",
          totalMarks: 60,
          passingMarks: 30,
          duration: 90,
          scheduledAt: new Date(),
          isPublished: true,
        },
      });
    }

    if (!finalExam) {
      finalExam = await db.exam.create({
        data: {
          schoolId,
          classId,
          subjectId,
          termId,
          title: "Final Examination",
          examType: "FINAL",
          totalMarks: 40,
          passingMarks: 20,
          duration: 120,
          scheduledAt: new Date(),
          isPublished: true,
        },
      });
    }
  }

  // Fetch results for both exams
  const examIds = [caExam?.id, finalExam?.id].filter(Boolean) as string[];
  const existingResults = examIds.length > 0
    ? await db.examResult.findMany({
        where: { examId: { in: examIds } },
      })
    : [];

  const resultsByStudentAndExam = new Map<string, any>();
  existingResults.forEach((r) => {
    resultsByStudentAndExam.set(`${r.studentId}_${r.examId}`, r);
  });

  // Calculate age helper
  const calculateAge = (dob: Date | null | undefined): number | null => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  // Build the student roster rows
  const studentsRoster = (klass.students ?? []).map((student, idx) => {
    const caResult = caExam ? resultsByStudentAndExam.get(`${student.id}_${caExam.id}`) : null;
    const finalResult = finalExam ? resultsByStudentAndExam.get(`${student.id}_${finalExam.id}`) : null;

    const caScore = caResult ? caResult.marksObtained : null;
    const finalScore = finalResult ? finalResult.marksObtained : null;

    const hasCA = caScore !== null && !caResult?.isAbsent;
    const hasFinal = finalScore !== null && !finalResult?.isAbsent;

    const totalScore = (hasCA || hasFinal) ? (caScore ?? 0) + (finalScore ?? 0) : null;
    const maxTotal = (caExam?.totalMarks ?? 60) + (finalExam?.totalMarks ?? 40);

    const percentage = totalScore !== null ? Math.round((totalScore / maxTotal) * 100) : null;

    let grade = "—";
    let gpa = 0.0;
    let remarks = "—";

    if (percentage !== null) {
      if (percentage >= 90) { grade = "A+"; gpa = 4.0; remarks = "Distinction"; }
      else if (percentage >= 80) { grade = "A"; gpa = 3.7; remarks = "Excellent"; }
      else if (percentage >= 70) { grade = "B"; gpa = 3.3; remarks = "Very Good"; }
      else if (percentage >= 60) { grade = "C"; gpa = 2.7; remarks = "Good / Satisfactory"; }
      else if (percentage >= 50) { grade = "D"; gpa = 2.0; remarks = "Pass"; }
      else { grade = "F"; gpa = 0.0; remarks = "Needs Improvement / Fail"; }
    }

    if (caResult?.remarks) remarks = caResult.remarks;
    if (finalResult?.remarks) remarks = finalResult.remarks;

    return {
      studentProfileId: student.id,
      userId: student.user.id,
      rollNumber: student.rollNumber || String(idx + 1).padStart(2, "0"),
      admissionNumber: student.admissionNumber,
      fullName: `${student.user.firstName} ${student.user.lastName}`,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      avatar: student.user.avatar,
      gender: student.user.gender || "—",
      age: calculateAge(student.user.dateOfBirth),
      dateOfBirth: student.user.dateOfBirth,
      continuousAssessment: caScore,
      finalExam: finalScore,
      totalScore,
      percentage,
      grade,
      gpa,
      remarks,
      isMissing: caScore === null || finalScore === null,
      isAbsent: caResult?.isAbsent || finalResult?.isAbsent || false,
    };
  });

  return {
    school,
    class: {
      id: klass.id,
      name: klass.name,
      gradeLevel: klass.gradeLevel,
      academicYear: klass.academicYear,
      classTeacher: klass.classTeacher?.[0]?.user,
    },
    subject: subject ? { id: subject.id, name: subject.name, code: subject.code } : null,
    term: { id: term.id, name: term.name, academicYear: term.academicYear, isCurrent: term.isCurrent },
    distribution: {
      continuousAssessmentMax: caExam?.totalMarks ?? 60,
      finalExamMax: finalExam?.totalMarks ?? 40,
      totalMax: 100,
    },
    students: studentsRoster,
  };
};

export const saveClassGradeRoster = async (
  schoolId: string,
  userId: string,
  data: {
    classId: string;
    subjectId: string;
    termId: string;
    records: Array<{
      studentProfileId: string;
      continuousAssessment: number | null;
      finalExam: number | null;
      remarks?: string;
      isAbsent?: boolean;
    }>;
  },
) => {
  const { classId, subjectId, termId, records } = data;

  // Ensure CA and Final exam records exist
  let caExam = await db.exam.findFirst({
    where: {
      schoolId,
      classId,
      subjectId,
      termId,
      examType: { in: ["MID_TERM", "QUIZ", "STANDARDIZED"] },
    },
  });

  if (!caExam) {
    caExam = await db.exam.create({
      data: {
        schoolId,
        classId,
        subjectId,
        termId,
        title: "Continuous Assessment (Tests, Quizzes & Assignments)",
        examType: "MID_TERM",
        totalMarks: 60,
        passingMarks: 30,
        duration: 90,
        scheduledAt: new Date(),
        isPublished: true,
      },
    });
  }

  let finalExam = await db.exam.findFirst({
    where: {
      schoolId,
      classId,
      subjectId,
      termId,
      examType: "FINAL",
    },
  });

  if (!finalExam) {
    finalExam = await db.exam.create({
      data: {
        schoolId,
        classId,
        subjectId,
        termId,
        title: "Final Examination",
        examType: "FINAL",
        totalMarks: 40,
        passingMarks: 20,
        duration: 120,
        scheduledAt: new Date(),
        isPublished: true,
      },
    });
  }

  const computeGradeLetter = (marks: number, total: number): string => {
    const pct = total > 0 ? (marks / total) * 100 : 0;
    if (pct >= 90) return "A+";
    if (pct >= 80) return "A";
    if (pct >= 70) return "B";
    if (pct >= 60) return "C";
    if (pct >= 50) return "D";
    return "F";
  };

  const operations: any[] = [];

  for (const r of records) {
    if (r.continuousAssessment !== null && r.continuousAssessment !== undefined) {
      operations.push(
        db.examResult.upsert({
          where: {
            examId_studentId: {
              examId: caExam.id,
              studentId: r.studentProfileId,
            },
          },
          update: {
            marksObtained: Number(r.continuousAssessment),
            grade: computeGradeLetter(Number(r.continuousAssessment), caExam.totalMarks),
            remarks: r.remarks,
            isAbsent: r.isAbsent ?? false,
          },
          create: {
            examId: caExam.id,
            studentId: r.studentProfileId,
            marksObtained: Number(r.continuousAssessment),
            grade: computeGradeLetter(Number(r.continuousAssessment), caExam.totalMarks),
            remarks: r.remarks,
            isAbsent: r.isAbsent ?? false,
          },
        }),
      );
    }

    if (r.finalExam !== null && r.finalExam !== undefined) {
      operations.push(
        db.examResult.upsert({
          where: {
            examId_studentId: {
              examId: finalExam.id,
              studentId: r.studentProfileId,
            },
          },
          update: {
            marksObtained: Number(r.finalExam),
            grade: computeGradeLetter(Number(r.finalExam), finalExam.totalMarks),
            remarks: r.remarks,
            isAbsent: r.isAbsent ?? false,
          },
          create: {
            examId: finalExam.id,
            studentId: r.studentProfileId,
            marksObtained: Number(r.finalExam),
            grade: computeGradeLetter(Number(r.finalExam), finalExam.totalMarks),
            remarks: r.remarks,
            isAbsent: r.isAbsent ?? false,
          },
        }),
      );
    }
  }

  if (operations.length > 0) {
    await db.$transaction(operations);
  }

  return { savedCount: records.length };
};

export const submitClassRosterToAdmin = async (
  schoolId: string,
  teacherUserId: string,
  data: {
    classId: string;
    subjectId: string;
    termId: string;
    notes?: string;
  },
) => {
  const [teacher, cls, subj, term, admins] = await Promise.all([
    db.user.findUnique({
      where: { id: teacherUserId },
      select: { firstName: true, lastName: true },
    }),
    db.class.findUnique({ where: { id: data.classId }, select: { name: true } }),
    db.subject.findUnique({ where: { id: data.subjectId }, select: { name: true } }),
    db.academicTerm.findUnique({ where: { id: data.termId }, select: { name: true } }),
    db.user.findMany({
      where: { schoolId, role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, isActive: true },
      select: { id: true },
    }),
  ]);

  const teacherName = `${teacher?.firstName ?? "Teacher"} ${teacher?.lastName ?? ""}`;
  const title = `Grade Roster Submitted: ${cls?.name} — ${subj?.name}`;
  const body = `${teacherName} has submitted the grade roster for ${cls?.name} (${subj?.name}) for ${term?.name}. ${data.notes ? `Note: "${data.notes}"` : ""}`;

  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        schoolId,
        userId: a.id,
        type: NotificationType.GRADE,
        title,
        body,
      })),
    });

    admins.forEach((a) => {
      emitToUser(a.id, "notification:new", {
        type: "GRADE",
        title,
        body,
      });
    });
  }

  return { submitted: true, notifiedCount: admins.length };
};

export const getMasterClassRoster = async (
  schoolId: string,
  params: {
    classId: string;
    termId: string;
  },
) => {
  const { classId, termId } = params;

  // 1. Fetch school, class (with gradeLevel, classTeacher, students with user), term
  const [school, klass, term] = await Promise.all([
    db.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        logo: true,
        address: true,
        city: true,
        country: true,
        phone: true,
        email: true,
        academicYear: true,
      },
    }),
    db.class.findFirst({
      where: { id: classId, schoolId },
      include: {
        gradeLevel: { select: { id: true, name: true, level: true } },
        classTeacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                gender: true,
                dateOfBirth: true,
              },
            },
          },
          orderBy: { rollNumber: "asc" },
        },
      },
    }),
    db.academicTerm.findFirst({
      where: { id: termId, schoolId },
    }),
  ]);

  if (!klass) throw new AppError("Class not found", 404);
  if (!term) throw new AppError("Academic term not found", 404);

  // 2. Fetch all subjects taught to this class (via SubjectTeaching OR grade level subjects OR subjects with exams in this class)
  const [subjectTeachings, gradeLevelSubjects, classExams] = await Promise.all([
    db.subjectTeaching.findMany({
      where: { classId },
      include: {
        subject: { select: { id: true, name: true, code: true, creditHours: true } },
        teacherProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    }),
    klass.gradeLevelId
      ? db.subject.findMany({
          where: { gradeLevelId: klass.gradeLevelId, schoolId },
          select: { id: true, name: true, code: true, creditHours: true },
          orderBy: { name: "asc" },
        })
      : [],
    db.exam.findMany({
      where: { classId, termId, schoolId },
      include: {
        subject: { select: { id: true, name: true, code: true, creditHours: true } },
        results: true,
      },
    }),
  ]);

  // Consolidate unique subjects list
  const subjectsMap = new Map<string, any>();

  // Add from SubjectTeaching
  subjectTeachings.forEach((st) => {
    if (st.subject) {
      subjectsMap.set(st.subject.id, {
        id: st.subject.id,
        name: st.subject.name,
        code: st.subject.code,
        creditHours: st.subject.creditHours ?? 3,
        teacher: st.teacherProfile?.user ? `${st.teacherProfile.user.firstName} ${st.teacherProfile.user.lastName}` : null,
      });
    }
  });

  // Add from GradeLevel subjects
  gradeLevelSubjects.forEach((sub) => {
    if (!subjectsMap.has(sub.id)) {
      subjectsMap.set(sub.id, {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        creditHours: sub.creditHours ?? 3,
        teacher: null,
      });
    }
  });

  // Add from class exams if any
  classExams.forEach((ex) => {
    if (ex.subject && !subjectsMap.has(ex.subject.id)) {
      subjectsMap.set(ex.subject.id, {
        id: ex.subject.id,
        name: ex.subject.name,
        code: ex.subject.code,
        creditHours: ex.subject.creditHours ?? 3,
        teacher: null,
      });
    }
  });

  // Fallback: If no subjects found yet, get all school subjects
  if (subjectsMap.size === 0) {
    const allSchoolSubjects = await db.subject.findMany({
      where: { schoolId },
      select: { id: true, name: true, code: true, creditHours: true },
      take: 10,
    });
    allSchoolSubjects.forEach((sub) => {
      subjectsMap.set(sub.id, {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        creditHours: sub.creditHours ?? 3,
        teacher: null,
      });
    });
  }

  const subjectsList = Array.from(subjectsMap.values());

  // Map of studentId_subjectId -> { caScore, finalScore, totalScore, grade, isMissing }
  const studentSubjectScores = new Map<
    string,
    {
      caScore: number | null;
      finalScore: number | null;
      totalScore: number | null;
      grade: string;
      isMissing: boolean;
    }
  >();

  classExams.forEach((exam) => {
    exam.results.forEach((res) => {
      const key = `${res.studentId}_${exam.subjectId}`;
      if (!studentSubjectScores.has(key)) {
        studentSubjectScores.set(key, {
          caScore: null,
          finalScore: null,
          totalScore: null,
          grade: "—",
          isMissing: true,
        });
      }
      const item = studentSubjectScores.get(key)!;
      if (exam.examType === "FINAL") {
        item.finalScore = res.marksObtained;
      } else {
        item.caScore = res.marksObtained;
      }
    });
  });

  // Calculate total for each studentSubjectScores
  subjectsList.forEach((sub) => {
    (klass.students ?? []).forEach((student) => {
      const key = `${student.id}_${sub.id}`;
      const item = studentSubjectScores.get(key);
      const ca = item?.caScore ?? null;
      const fin = item?.finalScore ?? null;
      const hasAny = ca !== null || fin !== null;
      const total = hasAny ? (ca ?? 0) + (fin ?? 0) : null;
      const isMissing = ca === null || fin === null;

      let grade = "—";
      if (total !== null) {
        if (total >= 90) grade = "A+";
        else if (total >= 80) grade = "A";
        else if (total >= 70) grade = "B";
        else if (total >= 60) grade = "C";
        else if (total >= 50) grade = "D";
        else grade = "F";
      }

      studentSubjectScores.set(key, {
        caScore: ca,
        finalScore: fin,
        totalScore: total,
        grade,
        isMissing: total === null || isMissing,
      });
    });
  });

  const calculateAge = (dob: Date | null | undefined): number | null => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  // 4. Build student rows with all subject scores, grand total, class average, GPA, and rank
  const studentRows = (klass.students ?? []).map((student, idx) => {
    const subjectMarks: Record<
      string,
      {
        total: number | null;
        ca: number | null;
        final: number | null;
        grade: string;
        isMissing: boolean;
      }
    > = {};
    let totalMarksEarned = 0;
    let subjectsWithScoresCount = 0;
    let missingSubjectsCount = 0;

    subjectsList.forEach((sub) => {
      const scoreData = studentSubjectScores.get(`${student.id}_${sub.id}`) || {
        caScore: null,
        finalScore: null,
        totalScore: null,
        grade: "—",
        isMissing: true,
      };

      subjectMarks[sub.id] = {
        total: scoreData.totalScore,
        ca: scoreData.caScore,
        final: scoreData.finalScore,
        grade: scoreData.grade,
        isMissing: scoreData.isMissing,
      };

      if (scoreData.totalScore !== null) {
        totalMarksEarned += scoreData.totalScore;
        subjectsWithScoresCount++;
      }
      if (scoreData.isMissing) {
        missingSubjectsCount++;
      }
    });

    const maxPossibleMarks = subjectsList.length * 100;
    const averagePercentage =
      subjectsList.length > 0 && subjectsWithScoresCount > 0
        ? Math.round((totalMarksEarned / (subjectsList.length * 100)) * 1000) / 10
        : null;

    let overallGrade = "—";
    let gpa = 0.0;
    let remarks = "Pending Evaluation";

    if (averagePercentage !== null) {
      if (averagePercentage >= 90) {
        overallGrade = "A+";
        gpa = 4.0;
        remarks = "High Distinction / Honors";
      } else if (averagePercentage >= 80) {
        overallGrade = "A";
        gpa = 3.7;
        remarks = "Excellent / Distinction";
      } else if (averagePercentage >= 70) {
        overallGrade = "B";
        gpa = 3.3;
        remarks = "Very Good";
      } else if (averagePercentage >= 60) {
        overallGrade = "C";
        gpa = 2.7;
        remarks = "Satisfactory / Pass";
      } else if (averagePercentage >= 50) {
        overallGrade = "D";
        gpa = 2.0;
        remarks = "Marginal Pass";
      } else {
        overallGrade = "F";
        gpa = 0.0;
        remarks = "Needs Improvement / Fail";
      }
    }

    return {
      studentId: student.id,
      userId: student.user.id,
      rollNumber: student.rollNumber || (idx + 1).toString().padStart(2, "0"),
      admissionNumber: student.admissionNumber,
      name: `${student.user.firstName} ${student.user.lastName}`,
      gender: student.user.gender ? student.user.gender[0].toUpperCase() : "—",
      age: calculateAge(student.user.dateOfBirth),
      subjectMarks,
      totalMarksEarned,
      maxPossibleMarks,
      averagePercentage,
      gpa,
      overallGrade,
      remarks,
      missingSubjectsCount,
      rank: 0,
    };
  });

  // 5. Calculate class ranks (sorted descending by totalMarksEarned)
  const sortedForRanking = [...studentRows].sort(
    (a, b) => (b.totalMarksEarned ?? 0) - (a.totalMarksEarned ?? 0),
  );
  let currentRank = 1;
  sortedForRanking.forEach((st, i) => {
    if (i > 0 && st.totalMarksEarned < sortedForRanking[i - 1].totalMarksEarned) {
      currentRank = i + 1;
    }
    st.rank = st.totalMarksEarned > 0 ? currentRank : 0;
  });

  const rankMap = new Map<string, number>();
  sortedForRanking.forEach((s) => rankMap.set(s.studentId, s.rank));
  studentRows.forEach((s) => {
    s.rank = rankMap.get(s.studentId) || 0;
  });

  // 6. Summary Statistics across the class
  const studentsWithMarks = studentRows.filter((s) => s.averagePercentage !== null);
  const classAvg =
    studentsWithMarks.length > 0
      ? Math.round(
          (studentsWithMarks.reduce((sum, s) => sum + (s.averagePercentage || 0), 0) /
            studentsWithMarks.length) *
            10,
        ) / 10
      : 0;

  const passedStudents = studentsWithMarks.filter((s) => (s.averagePercentage || 0) >= 50);
  const passRate =
    studentsWithMarks.length > 0
      ? Math.round((passedStudents.length / studentsWithMarks.length) * 100)
      : 0;

  const topStudent =
    sortedForRanking.length > 0 && sortedForRanking[0].totalMarksEarned > 0
      ? sortedForRanking[0]
      : null;

  return {
    school,
    class: {
      id: klass.id,
      name: klass.name,
      academicYear: klass.academicYear,
      room: klass.room,
      capacity: klass.capacity,
      gradeLevel: klass.gradeLevel,
      classTeacher: klass.classTeacher?.[0]?.user
        ? `${klass.classTeacher[0].user.firstName} ${klass.classTeacher[0].user.lastName}`
        : "Unassigned",
    },
    term: {
      id: term.id,
      name: term.name,
      academicYear: term.academicYear,
      isCurrent: term.isCurrent,
    },
    subjects: subjectsList,
    students: studentRows,
    stats: {
      totalStudents: studentRows.length,
      classAverage: classAvg,
      passRate,
      topStudentName: topStudent ? topStudent.name : "—",
      topStudentScore: topStudent
        ? `${topStudent.totalMarksEarned} / ${topStudent.maxPossibleMarks}`
        : "—",
      subjectsCount: subjectsList.length,
    },
  };
};

export const bulkGenerateAndPublishClassReports = async (
  schoolId: string,
  classId: string,
  termId: string,
) => {
  const klass = await db.class.findFirst({
    where: { id: classId, schoolId },
    include: { students: true },
  });
  if (!klass) throw new AppError("Class not found", 404);

  const results = [];
  for (const student of klass.students) {
    try {
      const rep = await generateGradeReport(student.userId, termId, schoolId);
      await publishGradeReport(student.userId, termId, schoolId);
      results.push(rep);
    } catch (err) {
      // Continue with other students if one has not been graded yet
    }
  }

  // Compute rankings for the class
  await computeClassRankings(classId, termId, schoolId);

  return {
    success: true,
    totalReportsGenerated: results.length,
    message: `Generated and distributed ${results.length} official student report cards.`,
  };
};

