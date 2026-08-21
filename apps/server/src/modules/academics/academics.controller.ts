import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ProgramType } from "@prisma/client";
import * as AcademicsService from "./academics.service";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { AppError } from "../../middleware/errorHandler";
import { recordAuditEvent } from "../../utils/auditLog";

// ── Subjects ─────────────────────────────────────────────────────────────────
export const listSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    sendSuccess(res, await AcademicsService.listSubjects(req.user.schoolId));
  } catch (e) {
    next(e);
  }
};
export const createSubject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        name: z.string(),
        code: z.string(),
        description: z.string().optional(),
        creditHours: z.number().optional(),
        isCore: z.boolean().optional(),
        gradeLevelId: z.string().optional().nullable(),
        gradeLevelIds: z.array(z.string()).optional(),
      })
      .parse(req.body);
    sendCreated(
      res,
      await AcademicsService.createSubject(req.user.schoolId, data),
    );
  } catch (e) {
    next(e);
  }
};

export const updateSubject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        name: z.string().optional(),
        code: z.string().optional(),
        description: z.string().optional(),
        creditHours: z.number().optional(),
        isCore: z.boolean().optional(),
        gradeLevelId: z.string().optional().nullable(),
        gradeLevelIds: z.array(z.string()).optional(),
      })
      .parse(req.body);
    sendSuccess(
      res,
      await AcademicsService.updateSubject(req.user.schoolId, req.params.id, data),
      "Subject updated",
    );
  } catch (e) {
    next(e);
  }
};

export const deleteSubject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await AcademicsService.deleteSubject(req.user.schoolId, req.params.id);
    sendSuccess(res, null, "Subject deleted");
  } catch (e) {
    next(e);
  }
};

// ── Classes ───────────────────────────────────────────────────────────────────
export const listClasses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const programType = req.query.programType as ProgramType | undefined;
    sendSuccess(
      res,
      await AcademicsService.listClasses(req.user.schoolId, { programType })
    );
  } catch (e) {
    next(e);
  }
};
export const createClass = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        gradeLevelId: z.string().min(1, "Grade level is required"),
        name: z.string(),
        academicYear: z.string(),
        capacity: z.number().optional(),
        room: z.string().optional(),
        programType: z.nativeEnum(ProgramType).optional(),
        programTypeLabel: z.string().optional().nullable(),
      })
      .parse(req.body);
    sendCreated(
      res,
      await AcademicsService.createClass(req.user.schoolId, data),
    );
  } catch (e) {
    next(e);
  }
};

export const getClass = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const klass = await AcademicsService.getClassById(
      req.user.schoolId,
      req.params.id,
    );
    sendSuccess(res, klass);
  } catch (e) {
    next(e);
  }
};

export const updateClass = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        gradeLevelId: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        academicYear: z.string().optional(),
        capacity: z.number().optional(),
        room: z.string().optional(),
        programType: z.nativeEnum(ProgramType).optional(),
        programTypeLabel: z.string().optional().nullable(),
      })
      .parse(req.body);

    const klass = await AcademicsService.updateClass(
      req.user.schoolId,
      req.params.id,
      data,
    );
    sendSuccess(res, klass, "Class updated");
  } catch (e) {
    next(e);
  }
};

export const deleteClass = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AcademicsService.deleteClass(
      req.user.schoolId,
      req.params.id,
    );
    sendSuccess(res, result, "Class deleted");
  } catch (e) {
    next(e);
  }
};

// ── Terms ─────────────────────────────────────────────────────────────────────
export const listTerms = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    sendSuccess(res, await AcademicsService.listTerms(req.user.schoolId));
  } catch (e) {
    next(e);
  }
};
export const createTerm = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        name: z.string(),
        academicYear: z.string(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        isCurrent: z.boolean().optional(),
      })
      .parse(req.body);
    sendCreated(
      res,
      await AcademicsService.createTerm(req.user.schoolId, {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      }),
    );
  } catch (e) {
    next(e);
  }
};

// ── Assignments ───────────────────────────────────────────────────────────────
export const listAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const {
      search,
      subjectId,
      classId,
      gradeLevelId,
      termId,
      type,
      status,
      sortBy,
    } = req.query as Record<string, string | undefined>;

    const { assignments, total } = await AcademicsService.listAssignments(
      req.user.schoolId,
      {
        search,
        subjectId,
        classId,
        gradeLevelId,
        termId,
        type,
        status,
        sortBy,
        page,
        limit,
      },
    );
    sendSuccess(
      res,
      assignments,
      "OK",
      200,
      paginationMeta(total, page, limit),
    );
  } catch (e) {
    next(e);
  }
};

export const getAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    sendSuccess(
      res,
      await AcademicsService.getAssignment(req.params.id, req.user.schoolId),
    );
  } catch (e) {
    next(e);
  }
};

export const createAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        subjectId: z.string(),
        classId: z.string().optional(),
        classIds: z.array(z.string()).optional(),
        teacherId: z.string().optional(),
        termId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        instructions: z.string().optional(),
        type: z.string().optional(),
        totalMarks: z.number().optional(),
        passingMarks: z.number().optional(),
        dueDate: z.string(),
        isPublished: z.boolean().optional(),
        allowLate: z.boolean().optional(),
        attachments: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const effectiveCreatorId =
      (req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN") &&
      data.teacherId
        ? data.teacherId
        : req.user.id;

    sendCreated(
      res,
      await AcademicsService.createAssignment(req.user.schoolId, effectiveCreatorId, {
        ...data,
        dueDate: new Date(data.dueDate),
      }),
    );
  } catch (e) {
    next(e);
  }
};

export const updateAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        instructions: z.string().optional(),
        dueDate: z.string().datetime().optional(),
        totalMarks: z.number().optional(),
        passingMarks: z.number().optional(),
        isPublished: z.boolean().optional(),
        allowLate: z.boolean().optional(),
        attachments: z.array(z.string()).optional(),
      })
      .parse(req.body);
    sendSuccess(
      res,
      await AcademicsService.updateAssignment(
        req.params.id,
        req.user.schoolId,
        { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
      ),
    );
  } catch (e) {
    next(e);
  }
};

export const deleteAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await AcademicsService.deleteAssignment(req.params.id, req.user.schoolId);
    sendSuccess(res, null, "Deleted");
  } catch (e) {
    next(e);
  }
};

export const submitAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        content: z.string().optional(),
        attachments: z.array(z.string()).optional(),
      })
      .parse(req.body);
    sendSuccess(
      res,
      await AcademicsService.submitAssignment(
        req.params.id,
        req.user.id,
        req.user.schoolId,
        data,
      ),
      "Submitted",
    );
  } catch (e) {
    next(e);
  }
};

export const gradeSubmission = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({ marksObtained: z.number(), feedback: z.string().optional() })
      .parse(req.body);
    sendSuccess(
      res,
      await AcademicsService.gradeSubmission(
        req.params.submissionId,
        req.user.id,
        req.user.schoolId,
        data,
      ),
      "Graded",
    );
  } catch (e) {
    next(e);
  }
};

// ── Exams ─────────────────────────────────────────────────────────────────────
export const listExams = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;
    const classId = req.query.classId as string | undefined;
    const gradeLevelId = req.query.gradeLevelId as string | undefined;
    const subjectId = req.query.subjectId as string | undefined;
    const termId = req.query.termId as string | undefined;
    const examType = req.query.examType as any;
    const status = req.query.status as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;

    const { exams, total } = await AcademicsService.listExams(
      req.user.schoolId,
      {
        search,
        classId,
        gradeLevelId,
        subjectId,
        termId,
        examType,
        status,
        sortBy,
        page,
        limit,
      },
    );
    sendSuccess(res, exams, "OK", 200, paginationMeta(total, page, limit));
  } catch (e) {
    next(e);
  }
};

export const createExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        subjectId: z.string(),
        classId: z.string().optional(),
        gradeLevelId: z.string().optional(),
        termId: z.string(),
        title: z.string(),
        examType: z.string().optional(),
        totalMarks: z.number().optional(),
        passingMarks: z.number().optional(),
        duration: z.number(),
        scheduledAt: z.string().datetime(),
        venue: z.string().optional(),
        instructions: z.string().optional(),
      })
      .parse(req.body);
    sendCreated(
      res,
      await AcademicsService.createExam(req.user.schoolId, {
        ...data,
        scheduledAt: new Date(data.scheduledAt),
      }),
    );
  } catch (e) {
    next(e);
  }
};

export const updateExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        subjectId: z.string().optional(),
        classId: z.string().optional(),
        gradeLevelId: z.string().optional(),
        termId: z.string().optional(),
        title: z.string().optional(),
        examType: z.string().optional(),
        totalMarks: z.number().optional(),
        passingMarks: z.number().optional(),
        duration: z.number().optional(),
        scheduledAt: z.string().datetime().optional(),
        venue: z.string().optional(),
        instructions: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
      .parse(req.body);

    const payload: any = { ...data };
    if (data.scheduledAt) {
      payload.scheduledAt = new Date(data.scheduledAt);
    }

    sendSuccess(
      res,
      await AcademicsService.updateExam(
        req.params.id,
        req.user.schoolId,
        payload,
      ),
      "Exam updated",
    );
  } catch (e) {
    next(e);
  }
};

export const deleteExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    sendSuccess(
      res,
      await AcademicsService.deleteExam(req.params.id, req.user.schoolId),
      "Exam deleted",
    );
  } catch (e) {
    next(e);
  }
};

export const publishExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    sendSuccess(
      res,
      await AcademicsService.publishExam(req.params.id, req.user.schoolId),
      "Exam published",
    );
  } catch (e) {
    next(e);
  }
};

export const recordResults = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { results } = z
      .object({
        results: z.array(
          z.object({
            studentId: z.string(),
            marksObtained: z.number(),
            isAbsent: z.boolean().optional(),
            remarks: z.string().optional(),
          }),
        ),
      })
      .parse(req.body);
    const saved = await AcademicsService.recordExamResults(
      req.params.id,
      req.user.schoolId,
      results,
    );

    await recordAuditEvent({
      schoolId: req.user.schoolId,
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "GRADE_RESULT_UPDATED",
      targetType: "ExamResult",
      targetId: req.params.id,
      metadata: { examId: req.params.id, count: results.length },
      req,
    });

    sendSuccess(
      res,
      saved,
      "Results recorded",
    );
  } catch (e) {
    next(e);
  }
};

export const getStudentResults = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const studentId = req.params.studentId ?? (req.query.studentId as string) ?? req.user.id;
    const termId = req.query.termId as string | undefined;
    sendSuccess(
      res,
      await AcademicsService.getStudentResults(
        studentId,
        req.user.schoolId,
        termId,
        req.user,
      ),
    );
  } catch (e) {
    next(e);
  }
};

// ── Grade Reports ─────────────────────────────────────────────────────────────
export const generateReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { studentId, termId } = z
      .object({ studentId: z.string(), termId: z.string() })
      .parse(req.body);
    sendSuccess(
      res,
      await AcademicsService.generateGradeReport(
        studentId,
        termId,
        req.user.schoolId,
      ),
    );
  } catch (e) {
    next(e);
  }
};

export const publishReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { studentId, termId } = z
      .object({ studentId: z.string(), termId: z.string() })
      .parse(req.body);
    sendSuccess(
      res,
      await AcademicsService.publishGradeReport(
        studentId,
        termId,
        req.user.schoolId,
      ),
      "Report published",
    );
  } catch (e) {
    next(e);
  }
};

export const computeRankings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { classId, termId } = z
      .object({ classId: z.string(), termId: z.string() })
      .parse(req.body);
    sendSuccess(
      res,
      await AcademicsService.computeClassRankings(
        classId,
        termId,
        req.user.schoolId,
      ),
      "Class rankings computed",
    );
  } catch (e) {
    next(e);
  }
};

export const getPerformanceInsights = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const termId = req.query.termId as string;
    if (!termId) throw new AppError("termId query parameter is required", 400);
    const atRiskThresholdPercentage = req.query.atRiskThreshold
      ? Number(req.query.atRiskThreshold)
      : undefined;
    const topCount = req.query.topCount
      ? Number(req.query.topCount)
      : undefined;
    sendSuccess(
      res,
      await AcademicsService.getStudentPerformanceInsights(
        req.user.schoolId,
        termId,
        { atRiskThresholdPercentage, topCount },
      ),
    );
  } catch (e) {
    next(e);
  }
};

// ── Printable documents ───────────────────────────────────────────────────────
export const downloadReportCard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const studentId = req.params.studentId ?? (req.query.studentId as string) ?? req.user.id;
    const { termId } = z.object({ termId: z.string() }).parse(req.query);
    const { pdf, fileName } = await AcademicsService.getReportCardPdf(
      studentId,
      termId,
      req.user.schoolId,
      req.user,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (e) {
    next(e);
  }
};

export const getParentChildren = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const children = await AcademicsService.getParentChildren(
      req.user.id,
      req.user.schoolId,
    );
    sendSuccess(res, children);
  } catch (e) {
    next(e);
  }
};

export const downloadMarkSheet = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { pdf, fileName } = await AcademicsService.getMarkSheetPdf(
      req.params.id,
      req.user.schoolId,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (e) {
    next(e);
  }
};

// ── Grade Roster & Teacher Assignments ────────────────────────────────────────

export const getTeacherAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await AcademicsService.getTeacherTeachingAssignments(
      req.user.schoolId,
      req.user.id,
      req.user.role,
    );
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
};

export const getClassGradeRoster = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { classId, subjectId, termId } = req.query as Record<string, string>;
    if (!classId) throw new AppError("classId query parameter is required", 400);
    if (!termId) throw new AppError("termId query parameter is required", 400);

    const roster = await AcademicsService.getClassGradeRoster(req.user.schoolId, {
      classId,
      subjectId,
      termId,
    });
    sendSuccess(res, roster);
  } catch (e) {
    next(e);
  }
};

export const saveClassGradeRoster = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        classId: z.string(),
        subjectId: z.string(),
        termId: z.string(),
        records: z.array(
          z.object({
            studentProfileId: z.string(),
            continuousAssessment: z.number().nullable().optional(),
            finalExam: z.number().nullable().optional(),
            remarks: z.string().optional(),
            isAbsent: z.boolean().optional(),
          }),
        ),
      })
      .parse(req.body);

    const result = await AcademicsService.saveClassGradeRoster(
      req.user.schoolId,
      req.user.id,
      data as any,
    );
    sendSuccess(res, result, "Student marks saved successfully");
  } catch (e) {
    next(e);
  }
};

export const submitClassRosterToAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = z
      .object({
        classId: z.string(),
        subjectId: z.string(),
        termId: z.string(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const result = await AcademicsService.submitClassRosterToAdmin(
      req.user.schoolId,
      req.user.id,
      data,
    );
    sendSuccess(res, result, "Grade roster submitted to administration");
  } catch (e) {
    next(e);
  }
};

export const getMasterClassRoster = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { classId, termId } = req.query as Record<string, string>;
    if (!classId) throw new AppError("classId query parameter is required", 400);
    if (!termId) throw new AppError("termId query parameter is required", 400);

    const masterRoster = await AcademicsService.getMasterClassRoster(
      req.user.schoolId,
      { classId, termId },
    );
    sendSuccess(res, masterRoster);
  } catch (e) {
    next(e);
  }
};

export const distributeClassGradeReports = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { classId, termId } = z
      .object({ classId: z.string(), termId: z.string() })
      .parse(req.body);

    const result = await AcademicsService.bulkGenerateAndPublishClassReports(
      req.user.schoolId,
      classId,
      termId,
    );
    sendSuccess(res, result, result.message);
  } catch (e) {
    next(e);
  }
};

