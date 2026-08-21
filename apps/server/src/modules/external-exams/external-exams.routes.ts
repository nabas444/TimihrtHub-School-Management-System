import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  Role,
  ExternalExamRegistrationStatus,
  MilestoneType,
} from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/v1/external-exam-records/mine
// Returns external exam records for the logged-in student or parent's children
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/records/mine",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const role = req.user.role;

      let studentProfileIds: string[] = [];

      if (role === Role.STUDENT) {
        const student = await db.studentProfile.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (student) studentProfileIds.push(student.id);
      } else if (role === Role.PARENT) {
        const links = await db.parentStudentLink.findMany({
          where: { parentProfile: { userId } },
          select: { studentProfileId: true },
        });
        studentProfileIds = links.map((l) => l.studentProfileId);
      } else {
        throw new AppError("Mine endpoint is for students and parents", 400);
      }

      if (studentProfileIds.length === 0) {
        return sendSuccess(res, []);
      }

      const records = await db.externalExamRecord.findMany({
        where: {
          studentProfileId: { in: studentProfileIds },
          checkpoint: { schoolId },
        },
        include: {
          checkpoint: {
            include: {
              gradeLevel: { select: { id: true, name: true, level: true } },
            },
          },
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
              class: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { checkpoint: { academicYear: "desc" } },
      });

      sendSuccess(res, records);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/v1/external-exam-checkpoints
// List external exam checkpoints with filter & stats
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/checkpoints",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const academicYear = req.query.academicYear as string | undefined;
      const gradeLevelId = req.query.gradeLevelId as string | undefined;
      const search = req.query.search as string | undefined;

      const where: any = { schoolId };
      if (academicYear) where.academicYear = academicYear;
      if (gradeLevelId) where.gradeLevelId = gradeLevelId;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { administeringBody: { contains: search, mode: "insensitive" } },
        ];
      }

      const checkpoints = await db.externalExamCheckpoint.findMany({
        where,
        orderBy: [{ academicYear: "desc" }, { createdAt: "desc" }],
        include: {
          gradeLevel: { select: { id: true, name: true, level: true, milestoneType: true } },
          _count: {
            select: { records: true },
          },
        },
      });

      sendSuccess(res, checkpoints);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/v1/external-exam-checkpoints
// Create a new checkpoint (ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/checkpoints",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;

      const data = z
        .object({
          gradeLevelId: z.string().min(1, "Grade level is required"),
          academicYear: z.string().min(1, "Academic year is required"),
          name: z.string().min(1, "Name is required"),
          administeringBody: z.string().optional().nullable(),
          examWindowStart: z.string().datetime().optional().nullable(),
          examWindowEnd: z.string().datetime().optional().nullable(),
          passCutoff: z.number().optional().nullable(),
          notes: z.string().optional().nullable(),
        })
        .parse(req.body);

      // Verify grade level exists in this school
      const gradeLevel = await db.gradeLevel.findFirst({
        where: { id: data.gradeLevelId, schoolId },
      });
      if (!gradeLevel) throw new AppError("Grade level not found", 404);

      // Check unique constraint
      const existing = await db.externalExamCheckpoint.findUnique({
        where: {
          schoolId_gradeLevelId_academicYear: {
            schoolId,
            gradeLevelId: data.gradeLevelId,
            academicYear: data.academicYear,
          },
        },
      });
      if (existing) {
        throw new AppError(
          `An external exam checkpoint already exists for ${gradeLevel.name} in academic year ${data.academicYear}`,
          400,
        );
      }

      const checkpoint = await db.externalExamCheckpoint.create({
        data: {
          schoolId,
          gradeLevelId: data.gradeLevelId,
          academicYear: data.academicYear,
          name: data.name,
          administeringBody: data.administeringBody,
          examWindowStart: data.examWindowStart ? new Date(data.examWindowStart) : null,
          examWindowEnd: data.examWindowEnd ? new Date(data.examWindowEnd) : null,
          passCutoff: data.passCutoff,
          notes: data.notes,
        },
        include: {
          gradeLevel: true,
        },
      });

      sendSuccess(res, checkpoint, "External exam checkpoint created successfully", 201);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/v1/external-exam-checkpoints/:id
// Get single checkpoint with all candidate records & details
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/checkpoints/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const checkpoint = await db.externalExamCheckpoint.findFirst({
        where: { id, schoolId },
        include: {
          gradeLevel: true,
          records: {
            orderBy: [
              { studentProfile: { user: { lastName: "asc" } } },
              { studentProfile: { user: { firstName: "asc" } } },
            ],
            include: {
              studentProfile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      middleName: true,
                      lastName: true,
                      gender: true,
                      avatar: true,
                    },
                  },
                  class: { select: { id: true, name: true } },
                },
              },
              recordedBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      if (!checkpoint) throw new AppError("External exam checkpoint not found", 404);

      sendSuccess(res, checkpoint);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. PATCH /api/v1/external-exam-checkpoints/:id
// Update checkpoint details (ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/checkpoints/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const data = z
        .object({
          name: z.string().optional(),
          administeringBody: z.string().optional().nullable(),
          examWindowStart: z.string().datetime().optional().nullable(),
          examWindowEnd: z.string().datetime().optional().nullable(),
          passCutoff: z.number().optional().nullable(),
          notes: z.string().optional().nullable(),
        })
        .parse(req.body);

      const existing = await db.externalExamCheckpoint.findFirst({
        where: { id, schoolId },
      });
      if (!existing) throw new AppError("Checkpoint not found", 404);

      const updated = await db.externalExamCheckpoint.update({
        where: { id },
        data: {
          name: data.name,
          administeringBody: data.administeringBody,
          examWindowStart:
            data.examWindowStart !== undefined
              ? data.examWindowStart
                ? new Date(data.examWindowStart)
                : null
              : undefined,
          examWindowEnd:
            data.examWindowEnd !== undefined
              ? data.examWindowEnd
                ? new Date(data.examWindowEnd)
                : null
              : undefined,
          passCutoff: data.passCutoff,
          notes: data.notes,
        },
        include: { gradeLevel: true },
      });

      sendSuccess(res, updated, "Checkpoint updated successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. DELETE /api/v1/external-exam-checkpoints/:id
// Delete checkpoint & associated records (ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/checkpoints/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const existing = await db.externalExamCheckpoint.findFirst({
        where: { id, schoolId },
      });
      if (!existing) throw new AppError("Checkpoint not found", 404);

      await db.externalExamCheckpoint.delete({ where: { id } });
      sendSuccess(res, null, "Checkpoint deleted successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/v1/external-exam-checkpoints/:id/register-bulk
// Bulk register students in classes belonging to this checkpoint's grade level
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/checkpoints/:id/register-bulk",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const { excludeStudentProfileIds, classId } = z
        .object({
          excludeStudentProfileIds: z.array(z.string()).optional().default([]),
          classId: z.string().optional(),
        })
        .parse(req.body);

      const checkpoint = await db.externalExamCheckpoint.findFirst({
        where: { id, schoolId },
        include: { gradeLevel: true },
      });
      if (!checkpoint) throw new AppError("Checkpoint not found", 404);

      // Find all active students in the grade level (or specific class)
      let studentWhere: any = {
        user: { schoolId, isActive: true },
      };

      if (classId) {
        studentWhere.classId = classId;
      } else {
        studentWhere.OR = [
          { gradeLevelId: checkpoint.gradeLevelId },
          { class: { is: { gradeLevelId: checkpoint.gradeLevelId } } },
        ];
      }

      const students = await db.studentProfile.findMany({
        where: studentWhere,
        select: { id: true, admissionNumber: true, user: { select: { firstName: true, lastName: true } } },
      });

      const excludeSet = new Set(excludeStudentProfileIds);
      const eligibleStudents = students.filter((s) => !excludeSet.has(s.id));

      let registeredCount = 0;
      let skippedCount = 0;

      for (const student of eligibleStudents) {
        const existingRecord = await db.externalExamRecord.findUnique({
          where: {
            checkpointId_studentProfileId: {
              checkpointId: id,
              studentProfileId: student.id,
            },
          },
        });

        if (existingRecord) {
          skippedCount++;
        } else {
          await db.externalExamRecord.create({
            data: {
              checkpointId: id,
              studentProfileId: student.id,
              status: ExternalExamRegistrationStatus.REGISTERED,
            },
          });
          registeredCount++;
        }
      }

      sendSuccess(
        res,
        {
          totalEligible: eligibleStudents.length,
          registeredCount,
          skippedCount,
        },
        `Successfully registered ${registeredCount} students (${skippedCount} already registered)`,
        201,
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. PATCH /api/v1/external-exam-records/:id
// Update registration number, exam center, status, or notes
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/records/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const data = z
        .object({
          registrationNumber: z.string().optional().nullable(),
          examCenter: z.string().optional().nullable(),
          status: z.nativeEnum(ExternalExamRegistrationStatus).optional(),
          notes: z.string().optional().nullable(),
        })
        .parse(req.body);

      const record = await db.externalExamRecord.findFirst({
        where: { id, checkpoint: { schoolId } },
      });
      if (!record) throw new AppError("Record not found", 404);

      const updated = await db.externalExamRecord.update({
        where: { id },
        data,
        include: {
          studentProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
              class: { select: { id: true, name: true } },
            },
          },
        },
      });

      sendSuccess(res, updated, "Candidate record updated");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. PATCH /api/v1/external-exam-records/:id/result
// Record official result for a single candidate
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/records/:id/result",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const data = z
        .object({
          score: z.number().optional().nullable(),
          grade: z.string().optional().nullable(),
          isPassing: z.boolean().optional().nullable(),
          resultDocumentUrl: z.string().optional().nullable(),
          resultPublishedAt: z.string().datetime().optional().nullable(),
          notes: z.string().optional().nullable(),
          registrationNumber: z.string().optional().nullable(),
          examCenter: z.string().optional().nullable(),
        })
        .parse(req.body);

      const record = await db.externalExamRecord.findFirst({
        where: { id, checkpoint: { schoolId } },
      });
      if (!record) throw new AppError("Candidate record not found", 404);

      const updated = await db.externalExamRecord.update({
        where: { id },
        data: {
          score: data.score,
          grade: data.grade,
          isPassing: data.isPassing,
          resultDocumentUrl: data.resultDocumentUrl,
          resultPublishedAt: data.resultPublishedAt
            ? new Date(data.resultPublishedAt)
            : new Date(),
          recordedById: req.user.id,
          status: ExternalExamRegistrationStatus.RESULT_RECORDED,
          notes: data.notes !== undefined ? data.notes : record.notes,
          registrationNumber:
            data.registrationNumber !== undefined
              ? data.registrationNumber
              : record.registrationNumber,
          examCenter:
            data.examCenter !== undefined ? data.examCenter : record.examCenter,
        },
        include: {
          studentProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
              class: { select: { id: true, name: true } },
            },
          },
          recordedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      sendSuccess(res, updated, "Result recorded successfully");
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. POST /api/v1/external-exam-checkpoints/:id/results/bulk
// Bulk record/update results for multiple candidates
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/checkpoints/:id/results/bulk",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const { results } = z
        .object({
          results: z.array(
            z.object({
              recordId: z.string().optional(),
              studentProfileId: z.string().optional(),
              registrationNumber: z.string().optional().nullable(),
              examCenter: z.string().optional().nullable(),
              score: z.number().optional().nullable(),
              grade: z.string().optional().nullable(),
              isPassing: z.boolean().optional().nullable(),
              resultDocumentUrl: z.string().optional().nullable(),
              notes: z.string().optional().nullable(),
              status: z.nativeEnum(ExternalExamRegistrationStatus).optional(),
            }),
          ),
        })
        .parse(req.body);

      const checkpoint = await db.externalExamCheckpoint.findFirst({
        where: { id, schoolId },
      });
      if (!checkpoint) throw new AppError("Checkpoint not found", 404);

      let updatedCount = 0;
      const errors: string[] = [];

      for (const item of results) {
        try {
          let record: any = null;
          if (item.recordId) {
            record = await db.externalExamRecord.findFirst({
              where: { id: item.recordId, checkpointId: id },
            });
          } else if (item.studentProfileId) {
            record = await db.externalExamRecord.findUnique({
              where: {
                checkpointId_studentProfileId: {
                  checkpointId: id,
                  studentProfileId: item.studentProfileId,
                },
              },
            });
          }

          if (record) {
            const hasResult =
              item.score !== undefined ||
              item.grade !== undefined ||
              item.isPassing !== undefined;

            await db.externalExamRecord.update({
              where: { id: record.id },
              data: {
                registrationNumber:
                  item.registrationNumber !== undefined
                    ? item.registrationNumber
                    : record.registrationNumber,
                examCenter:
                  item.examCenter !== undefined ? item.examCenter : record.examCenter,
                score: item.score !== undefined ? item.score : record.score,
                grade: item.grade !== undefined ? item.grade : record.grade,
                isPassing:
                  item.isPassing !== undefined ? item.isPassing : record.isPassing,
                resultDocumentUrl:
                  item.resultDocumentUrl !== undefined
                    ? item.resultDocumentUrl
                    : record.resultDocumentUrl,
                status:
                  item.status ||
                  (hasResult
                    ? ExternalExamRegistrationStatus.RESULT_RECORDED
                    : record.status),
                notes: item.notes !== undefined ? item.notes : record.notes,
                recordedById: req.user.id,
                resultPublishedAt: hasResult ? new Date() : record.resultPublishedAt,
              },
            });
            updatedCount++;
          } else if (item.studentProfileId) {
            // Create record if not found
            await db.externalExamRecord.create({
              data: {
                checkpointId: id,
                studentProfileId: item.studentProfileId,
                registrationNumber: item.registrationNumber,
                examCenter: item.examCenter,
                score: item.score,
                grade: item.grade,
                isPassing: item.isPassing,
                resultDocumentUrl: item.resultDocumentUrl,
                status:
                  item.status ||
                  (item.score !== undefined || item.isPassing !== undefined
                    ? ExternalExamRegistrationStatus.RESULT_RECORDED
                    : ExternalExamRegistrationStatus.REGISTERED),
                notes: item.notes,
                recordedById: req.user.id,
                resultPublishedAt: item.score !== undefined ? new Date() : null,
              },
            });
            updatedCount++;
          }
        } catch (e: any) {
          errors.push(
            `Error updating student ${item.studentProfileId || item.recordId}: ${e.message}`,
          );
        }
      }

      sendSuccess(
        res,
        {
          totalProcessed: results.length,
          updatedCount,
          errorCount: errors.length,
          errors,
        },
        `Processed ${updatedCount} candidate records`,
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET /api/v1/external-exam-checkpoints/:id/cohort-report
// Aggregate cohort performance & pass rate analytics
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/checkpoints/:id/cohort-report",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const checkpoint = await db.externalExamCheckpoint.findFirst({
        where: { id, schoolId },
        include: {
          gradeLevel: true,
          records: {
            include: {
              studentProfile: {
                include: {
                  user: { select: { gender: true } },
                  class: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });

      if (!checkpoint) throw new AppError("Checkpoint not found", 404);

      const records = checkpoint.records;
      const totalRegistered = records.length;

      let satCount = 0;
      let absentCount = 0;
      let resultPendingCount = 0;
      let resultRecordedCount = 0;
      let passingCount = 0;
      let failingCount = 0;

      const scores: number[] = [];
      const gradeDistribution: Record<string, number> = {};

      const maleStats = { registered: 0, sat: 0, passing: 0, failing: 0 };
      const femaleStats = { registered: 0, sat: 0, passing: 0, failing: 0 };

      for (const r of records) {
        const isSat =
          r.status === ExternalExamRegistrationStatus.SAT ||
          r.status === ExternalExamRegistrationStatus.RESULT_RECORDED ||
          r.score !== null;

        if (isSat) satCount++;
        if (r.status === ExternalExamRegistrationStatus.ABSENT) absentCount++;
        if (r.status === ExternalExamRegistrationStatus.RESULT_PENDING) resultPendingCount++;
        if (r.status === ExternalExamRegistrationStatus.RESULT_RECORDED) resultRecordedCount++;

        if (r.isPassing === true) passingCount++;
        if (r.isPassing === false) failingCount++;

        if (r.score !== null && r.score !== undefined) {
          scores.push(r.score);
        }

        if (r.grade) {
          const g = r.grade.toUpperCase();
          gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
        }

        const gender = r.studentProfile?.user?.gender;
        if (gender === "MALE") {
          maleStats.registered++;
          if (isSat) maleStats.sat++;
          if (r.isPassing === true) maleStats.passing++;
          if (r.isPassing === false) maleStats.failing++;
        } else if (gender === "FEMALE") {
          femaleStats.registered++;
          if (isSat) femaleStats.sat++;
          if (r.isPassing === true) femaleStats.passing++;
          if (r.isPassing === false) femaleStats.failing++;
        }
      }

      const passRate =
        satCount > 0
          ? Math.round((passingCount / satCount) * 1000) / 10
          : 0;

      const averageScore =
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
          : null;

      const highestScore = scores.length > 0 ? Math.max(...scores) : null;
      const lowestScore = scores.length > 0 ? Math.min(...scores) : null;

      const report = {
        checkpoint: {
          id: checkpoint.id,
          name: checkpoint.name,
          administeringBody: checkpoint.administeringBody,
          academicYear: checkpoint.academicYear,
          gradeLevelName: checkpoint.gradeLevel.name,
          passCutoff: checkpoint.passCutoff,
        },
        summary: {
          totalRegistered,
          sat: satCount,
          absent: absentCount,
          resultPending: resultPendingCount,
          resultRecorded: resultRecordedCount,
          passing: passingCount,
          failing: failingCount,
          passRate,
          averageScore,
          highestScore,
          lowestScore,
        },
        gradeDistribution,
        genderBreakdown: {
          male: {
            ...maleStats,
            passRate:
              maleStats.sat > 0
                ? Math.round((maleStats.passing / maleStats.sat) * 1000) / 10
                : 0,
          },
          female: {
            ...femaleStats,
            passRate:
              femaleStats.sat > 0
                ? Math.round((femaleStats.passing / femaleStats.sat) * 1000) / 10
                : 0,
          },
        },
      };

      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
