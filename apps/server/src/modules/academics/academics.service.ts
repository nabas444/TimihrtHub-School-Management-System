import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToUser, emitToSchool } from "../../config/socket";

// ════════════════════════════════════════════════════════════
// SUBJECTS
// ════════════════════════════════════════════════════════════

export const listSubjects = async (schoolId: string) =>
  db.subject.findMany({
    where: { schoolId },
    include: {
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
  },
) => {
  const exists = await db.subject.findUnique({
    where: { schoolId_code: { schoolId, code: data.code } },
  });
  if (exists) throw new AppError("Subject code already exists", 409);
  return db.subject.create({ data: { schoolId, ...data } });
};

// ════════════════════════════════════════════════════════════
// ASSIGNMENTS
// ════════════════════════════════════════════════════════════

export const listAssignments = async (
  schoolId: string,
  params: {
    subjectId?: string;
    classId?: string;
    termId?: string;
    createdById?: string;
    page: number;
    limit: number;
  },
) => {
  const { page, limit, ...filters } = params;
  const skip = (page - 1) * limit;
  const where = {
    schoolId,
    ...filters,
    isPublished: true,
  };

  const [assignments, total] = await Promise.all([
    db.assignment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { dueDate: "asc" },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
    }),
    db.assignment.count({ where }),
  ]);

  return { assignments, total };
};

export const getAssignment = async (id: string, schoolId: string) => {
  const assignment = await db.assignment.findFirst({
    where: { id, schoolId },
    include: {
      subject: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      submissions: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!assignment) throw new AppError("Assignment not found", 404);
  return assignment;
};

export const createAssignment = async (
  schoolId: string,
  createdById: string,
  data: {
    subjectId: string;
    classId?: string;
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
  const assignment = await db.assignment.create({
    data: { schoolId, createdById, ...data },
    include: { subject: { select: { name: true } } },
  });

  // Notify students in the class if published
  if (assignment.isPublished && data.classId) {
    const students = await db.user.findMany({
      where: {
        schoolId,
        role: "STUDENT",
        studentProfile: { classId: data.classId },
      },
      select: { id: true },
    });

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

  return assignment;
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
    classId?: string;
    subjectId?: string;
    termId?: string;
    page: number;
    limit: number;
  },
) => {
  const { page, limit, ...filters } = params;
  const skip = (page - 1) * limit;
  const where = { schoolId, ...filters };

  const [exams, total] = await Promise.all([
    db.exam.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledAt: "asc" },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        gradeLevel: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
    }),
    db.exam.count({ where }),
  ]);

  return { exams, total };
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

export const getStudentResults = async (
  studentId: string,
  schoolId: string,
  termId?: string,
) => {
  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: studentId },
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
      studentId,
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

  return { examResults, submissionResults };
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
) => {
  const student = await db.studentProfile.findFirst({
    where: { userId: studentId, user: { schoolId } },
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
export const listClasses = async (schoolId: string) =>
  db.class.findMany({
    where: { schoolId },
    include: {
      gradeLevel: { select: { name: true } },
      classTeacher: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      _count: { select: { students: true } },
    },
    orderBy: [{ gradeLevel: { level: "asc" } }, { name: "asc" }],
  });

export const createClass = async (
  schoolId: string,
  data: {
    gradeLevelId: string;
    name: string;
    academicYear: string;
    capacity?: number;
    room?: string;
  },
) => {
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
