import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { emitToUser } from "../../config/socket";
import {
  generateCumulativeReportCardPdf,
  CumulativeReportCardData,
} from "../../utils/pdf";

const router = Router();
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /api/v1/academic-year-summaries/generate
// Computes cumulative summaries across terms for all students in a class
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/generate",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId, academicYear } = z
        .object({
          classId: z.string().min(1, "classId is required"),
          academicYear: z.string().min(1, "academicYear is required"),
        })
        .parse(req.body);

      const schoolId = req.user.schoolId;

      // Verify class exists in school
      const cls = await db.class.findFirst({
        where: { id: classId, schoolId },
        include: { gradeLevel: true },
      });
      if (!cls) throw new AppError("Class not found", 404);

      // If user is a teacher, verify they are authorized (e.g. class teacher or assigned)
      if (req.user.role === Role.TEACHER) {
        const teacherProfile = await db.teacherProfile.findUnique({
          where: { userId: req.user.id },
          include: { assignedClasses: true },
        });
        const isClassTeacher = teacherProfile?.classTeacherOfId === classId;
        const isAssigned = teacherProfile?.assignedClasses.some(
          (c) => c.id === classId,
        );
        if (!isClassTeacher && !isAssigned) {
          throw new AppError(
            "Forbidden: You are not assigned to or class teacher of this class",
            403,
          );
        }
      }

      // Fetch SchoolSettings for passMarkPercentage
      const schoolSettings = await db.schoolSettings.findUnique({
        where: { schoolId },
      });
      const passThreshold = schoolSettings?.passMarkPercentage ?? 50;

      // Fetch all students in this class
      const students = await db.studentProfile.findMany({
        where: { classId, user: { schoolId, isActive: true } },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
      });

      if (students.length === 0) {
        throw new AppError("No students found in this class", 404);
      }

      // Fetch all terms in this academic year for this school
      const terms = await db.academicTerm.findMany({
        where: { schoolId, academicYear },
        orderBy: { startDate: "asc" },
      });
      const termIds = terms.map((t) => t.id);

      // Fetch all grade reports for these students in this academic year
      const gradeReports = await db.gradeReport.findMany({
        where: {
          classId,
          termId: { in: termIds },
          studentId: { in: students.map((s) => s.id) },
        },
        include: { term: true },
      });

      // Group grade reports by studentProfileId
      const reportsByStudent: Record<string, typeof gradeReports> = {};
      for (const gr of gradeReports) {
        if (!reportsByStudent[gr.studentId]) {
          reportsByStudent[gr.studentId] = [];
        }
        reportsByStudent[gr.studentId].push(gr);
      }

      // Compute preliminary stats for each student
      const studentStats = students.map((student) => {
        const studentReports = reportsByStudent[student.id] || [];

        // Build term breakdown snapshot
        const termBreakdown = terms.map((t) => {
          const matchingReport = studentReports.find((r) => r.termId === t.id);
          return {
            termId: t.id,
            termName: t.name,
            gpa: matchingReport?.gpa ?? null,
            percentage: matchingReport?.percentage ?? null,
            rank: matchingReport?.rank ?? null,
            totalMarks: matchingReport?.totalMarks ?? null,
          };
        });

        // Compute overall average percentage across recorded terms
        const validPercentages = studentReports
          .map((r) => r.percentage)
          .filter((p): p is number => p != null && !isNaN(p));

        let overallAverage: number | null = null;
        if (validPercentages.length > 0) {
          const sum = validPercentages.reduce((a, b) => a + b, 0);
          overallAverage = Math.round((sum / validPercentages.length) * 100) / 100;
        }

        const isPassing =
          overallAverage != null ? overallAverage >= passThreshold : false;

        return {
          studentProfileId: student.id,
          studentName: [student.user.firstName, student.user.middleName, student.user.lastName]
            .filter(Boolean)
            .join(" "),
          classId,
          academicYear,
          overallAverage,
          isPassing,
          termBreakdown,
        };
      });

      // Rank students in the class by overallAverage (descending)
      // Standard competition ranking (1224)
      const sortedStats = [...studentStats].sort((a, b) => {
        const avgA = a.overallAverage ?? -1;
        const avgB = b.overallAverage ?? -1;
        return avgB - avgA;
      });

      const rankedStats = sortedStats.map((item, index) => {
        if (item.overallAverage == null) {
          return { ...item, overallRank: null };
        }
        const prev = sortedStats[index - 1];
        const isTied =
          prev &&
          prev.overallAverage === item.overallAverage &&
          (prev as any)._rank != null;
        const rank = isTied ? (prev as any)._rank : index + 1;
        (item as any)._rank = rank;
        return { ...item, overallRank: rank };
      });

      // Upsert AcademicYearSummary for each student
      const upsertPromises = rankedStats.map((stat) =>
        db.academicYearSummary.upsert({
          where: {
            studentProfileId_academicYear: {
              studentProfileId: stat.studentProfileId,
              academicYear: stat.academicYear,
            },
          },
          update: {
            classId: stat.classId,
            overallAverage: stat.overallAverage,
            overallRank: stat.overallRank,
            termBreakdown: stat.termBreakdown,
            isPassing: stat.isPassing,
            generatedAt: new Date(),
          },
          create: {
            studentProfileId: stat.studentProfileId,
            academicYear: stat.academicYear,
            classId: stat.classId,
            overallAverage: stat.overallAverage,
            overallRank: stat.overallRank,
            termBreakdown: stat.termBreakdown,
            isPassing: stat.isPassing,
          },
        }),
      );

      const summaries = await Promise.all(upsertPromises);

      sendSuccess(
        res,
        {
          total: summaries.length,
          passThreshold,
          academicYear,
          classId,
          className: cls.name,
          summaries,
        },
        "Academic year summaries generated successfully",
        201,
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. PATCH /api/v1/academic-year-summaries/:id/publish
// Sets isPublished / publishedAt, restricted to ADMIN or class teacher
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/:id/publish",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { isPublished = true } = z
        .object({ isPublished: z.boolean().optional().default(true) })
        .parse(req.body);

      const summary = await db.academicYearSummary.findUnique({
        where: { id },
        include: {
          studentProfile: {
            include: {
              user: true,
              parentLinks: {
                include: { parentProfile: { include: { user: true } } },
              },
            },
          },
        },
      });

      if (!summary) throw new AppError("Academic year summary not found", 404);
      if (summary.studentProfile.user.schoolId !== req.user.schoolId) {
        throw new AppError("Forbidden", 403);
      }

      // If teacher, check class authorization
      if (req.user.role === Role.TEACHER) {
        const teacherProfile = await db.teacherProfile.findUnique({
          where: { userId: req.user.id },
        });
        if (teacherProfile?.classTeacherOfId !== summary.classId) {
          throw new AppError(
            "Forbidden: Only the class teacher or an administrator can publish this report card",
            403,
          );
        }
      }

      const updated = await db.academicYearSummary.update({
        where: { id },
        data: {
          isPublished,
          publishedAt: isPublished ? new Date() : null,
        },
      });

      // Send notifications when published
      if (isPublished) {
        const studentUserId = summary.studentProfile.user.id;
        emitToUser(studentUserId, "notification:new", {
          type: "GRADE",
          title: "Annual Report Card Published",
          body: `Your official annual report card for ${summary.academicYear} is now available to view and download.`,
        });

        summary.studentProfile.parentLinks.forEach((link) => {
          if (link.parentProfile?.user?.id) {
            emitToUser(link.parentProfile.user.id, "notification:new", {
              type: "GRADE",
              title: "Child Annual Report Card Published",
              body: `The official annual report card for ${summary.studentProfile.user.firstName} (${summary.academicYear}) is now available.`,
            });
          }
        });
      }

      sendSuccess(res, updated, `Report card summary ${isPublished ? "published" : "unpublished"} successfully`);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/v1/academic-year-summaries/class/:classId
// Admin / Teacher roster of all students in a class with summaries
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/class/:classId",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const schoolId = req.user.schoolId;

      const school = await db.school.findUnique({
        where: { id: schoolId },
        select: { academicYear: true },
      });
      const academicYear = (req.query.academicYear as string) || school?.academicYear || "2024/2025";

      const cls = await db.class.findFirst({
        where: { id: classId, schoolId },
        include: {
          gradeLevel: true,
          classTeacher: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!cls) throw new AppError("Class not found", 404);

      const students = await db.studentProfile.findMany({
        where: { classId, user: { schoolId, isActive: true } },
        orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              avatar: true,
              gender: true,
            },
          },
          academicYearSummaries: {
            where: { academicYear },
            take: 1,
          },
        },
      });

      const roster = students.map((s) => {
        const summary = s.academicYearSummaries[0] || null;
        return {
          studentProfileId: s.id,
          userId: s.user.id,
          admissionNumber: s.admissionNumber,
          rollNumber: s.rollNumber,
          name: [s.user.firstName, s.user.middleName, s.user.lastName]
            .filter(Boolean)
            .join(" "),
          gender: s.user.gender,
          avatar: s.user.avatar,
          status: s.status,
          summary: summary
            ? {
                id: summary.id,
                overallAverage: summary.overallAverage,
                overallRank: summary.overallRank,
                isPassing: summary.isPassing,
                isPublished: summary.isPublished,
                publishedAt: summary.publishedAt,
                termBreakdown: summary.termBreakdown,
                generatedAt: summary.generatedAt,
              }
            : null,
        };
      });

      sendSuccess(res, {
        class: {
          id: cls.id,
          name: cls.name,
          gradeLevelName: cls.gradeLevel?.name ?? null,
          classTeacher: cls.classTeacher?.[0]
            ? {
                id: cls.classTeacher[0].id,
                name: [
                  cls.classTeacher[0].user.firstName,
                  cls.classTeacher[0].user.middleName,
                  cls.classTeacher[0].user.lastName,
                ]
                  .filter(Boolean)
                  .join(" "),
              }
            : null,
        },
        academicYear,
        totalStudents: roster.length,
        generatedCount: roster.filter((r) => r.summary !== null).length,
        publishedCount: roster.filter((r) => r.summary?.isPublished).length,
        students: roster,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/v1/report-cards/mine
// Returns published report card for logged-in student or parent's child
// ─────────────────────────────────────────────────────────────────────────────
router.get("/mine", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const role = req.user.role;

    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        logo: true,
        address: true,
        phone: true,
        email: true,
        academicYear: true,
      },
    });
    if (!school) throw new AppError("School not found", 404);

    const academicYear =
      (req.query.academicYear as string) || school.academicYear || "2024/2025";
    const childId = req.query.childId as string | undefined;

    let studentProfileId: string | null = null;

    if (role === Role.STUDENT) {
      const sp = await db.studentProfile.findUnique({
        where: { userId },
      });
      studentProfileId = sp?.id || null;
    } else if (role === Role.PARENT) {
      if (childId) {
        const link = await db.parentStudentLink.findFirst({
          where: {
            parentProfile: { userId },
            OR: [{ studentProfileId: childId }, { studentProfile: { userId: childId } }],
          },
        });
        studentProfileId = link?.studentProfileId || null;
      } else {
        const link = await db.parentStudentLink.findFirst({
          where: { parentProfile: { userId } },
        });
        studentProfileId = link?.studentProfileId || null;
      }
    }

    if (!studentProfileId) {
      return sendSuccess(res, {
        generated: false,
        message: "No linked student profile found",
      });
    }

    const student = await db.studentProfile.findFirst({
      where: { id: studentProfileId, user: { schoolId } },
      include: {
        user: true,
        class: {
          include: {
            gradeLevel: true,
            classTeacher: { include: { user: true } },
          },
        },
        gradeLevel: true,
        academicYearSummaries: {
          where: { academicYear },
          take: 1,
        },
      },
    });

    if (!student) {
      return sendSuccess(res, {
        generated: false,
        message: "Student profile not found",
      });
    }

    const summary = student.academicYearSummaries[0] || null;

    if (!summary || !summary.isPublished) {
      return sendSuccess(res, {
        generated: false,
        isPublished: false,
        student: {
          id: student.id,
          name: [student.user.firstName, student.user.middleName, student.user.lastName]
            .filter(Boolean)
            .join(" "),
          className: student.class?.name || "—",
        },
        message: "Official annual report card has not been published yet for this year.",
      });
    }

    const classTeacherUser = student.class?.classTeacher?.[0]?.user;
    const homeroomTeacherName = classTeacherUser
      ? [
          classTeacherUser.firstName,
          classTeacherUser.middleName,
          classTeacherUser.lastName,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

    sendSuccess(res, {
      generated: true,
      isPublished: true,
      school: {
        name: school.name,
        logo: school.logo,
        address: school.address,
        phone: school.phone,
        email: school.email,
      },
      student: {
        id: student.id,
        userId: student.user.id,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        name: [student.user.firstName, student.user.middleName, student.user.lastName]
          .filter(Boolean)
          .join(" "),
        className: student.class?.name ?? "—",
        gradeLevelName: student.class?.gradeLevel?.name ?? student.gradeLevel?.name ?? null,
        gender: student.user.gender,
        avatar: student.user.avatar,
      },
      academicYear,
      summary: {
        id: summary.id,
        overallAverage: summary.overallAverage,
        overallRank: summary.overallRank,
        termBreakdown: summary.termBreakdown,
        isPassing: summary.isPassing,
        isPublished: summary.isPublished,
        publishedAt: summary.publishedAt,
        generatedAt: summary.generatedAt,
      },
      homeroomTeacherName,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/v1/report-cards/:studentProfileId
// Returns report card details for student, parent, teacher, admin
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/:studentProfileId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentProfileId } = req.params;
      const schoolId = req.user.schoolId;

      const school = await db.school.findUnique({
        where: { id: schoolId },
        select: {
          name: true,
          logo: true,
          address: true,
          phone: true,
          email: true,
          academicYear: true,
        },
      });
      if (!school) throw new AppError("School not found", 404);

      const academicYear =
        (req.query.academicYear as string) || school.academicYear || "2024/2025";

      // Fetch student profile
      const student = await db.studentProfile.findFirst({
        where: {
          id: studentProfileId,
          user: { schoolId },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              avatar: true,
              gender: true,
            },
          },
          class: {
            include: {
              gradeLevel: true,
              classTeacher: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      middleName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          gradeLevel: true,
          academicYearSummaries: {
            where: { academicYear },
            take: 1,
          },
        },
      });

      if (!student) throw new AppError("Student not found", 404);

      const summary = student.academicYearSummaries[0] || null;

      // Access control guards:
      // If STUDENT: must be own student profile and must be published
      if (req.user.role === Role.STUDENT) {
        if (student.user.id !== req.user.id) {
          throw new AppError("Forbidden: You can only view your own report card", 403);
        }
        if (!summary || !summary.isPublished) {
          return sendSuccess(res, {
            generated: false,
            isPublished: false,
            message: "Report card is not published yet for this academic year.",
          });
        }
      }

      // If PARENT: must be linked child and must be published
      if (req.user.role === Role.PARENT) {
        const link = await db.parentStudentLink.findFirst({
          where: {
            studentProfileId: student.id,
            parentProfile: { userId: req.user.id },
          },
        });
        if (!link) {
          throw new AppError("Forbidden: You are not linked to this student", 403);
        }
        if (!summary || !summary.isPublished) {
          return sendSuccess(res, {
            generated: false,
            isPublished: false,
            message: "Report card is not published yet for this academic year.",
          });
        }
      }

      if (!summary) {
        return sendSuccess(res, {
          generated: false,
          student: {
            id: student.id,
            userId: student.user.id,
            admissionNumber: student.admissionNumber,
            rollNumber: student.rollNumber,
            name: [student.user.firstName, student.user.middleName, student.user.lastName]
              .filter(Boolean)
              .join(" "),
            className: student.class?.name ?? "—",
          },
          message: "Report card has not been generated yet for this academic year.",
        });
      }

      // Class teacher name for signature
      const classTeacherUser = student.class?.classTeacher?.[0]?.user;
      const homeroomTeacherName = classTeacherUser
        ? [
            classTeacherUser.firstName,
            classTeacherUser.middleName,
            classTeacherUser.lastName,
          ]
            .filter(Boolean)
            .join(" ")
        : null;

      sendSuccess(res, {
        generated: true,
        school: {
          name: school.name,
          logo: school.logo,
          address: school.address,
          phone: school.phone,
          email: school.email,
        },
        student: {
          id: student.id,
          userId: student.user.id,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber,
          name: [student.user.firstName, student.user.middleName, student.user.lastName]
            .filter(Boolean)
            .join(" "),
          className: student.class?.name ?? "—",
          gradeLevelName: student.class?.gradeLevel?.name ?? student.gradeLevel?.name ?? null,
          gender: student.user.gender,
          avatar: student.user.avatar,
          status: student.status,
        },
        academicYear,
        summary: {
          id: summary.id,
          overallAverage: summary.overallAverage,
          overallRank: summary.overallRank,
          termBreakdown: summary.termBreakdown,
          isPassing: summary.isPassing,
          isPublished: summary.isPublished,
          publishedAt: summary.publishedAt,
          generatedAt: summary.generatedAt,
        },
        homeroomTeacherName,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST & GET /api/v1/report-cards/:studentProfileId/pdf
// Generates official PDF report card (ONE_SIDED or TWO_SIDED)
// ─────────────────────────────────────────────────────────────────────────────
const handleGenerateReportCardPdf = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { studentProfileId } = req.params;
    const schoolId = req.user.schoolId;

    const school = await db.school.findUnique({
      where: { id: schoolId },
      include: { settings: true },
    });
    if (!school) throw new AppError("School not found", 404);

    const academicYear =
      (req.query.academicYear as string) ||
      (req.body?.academicYear as string) ||
      school.academicYear ||
      "2024/2025";
    const layout =
      ((req.query.layout as string) || (req.body?.layout as string) || "ONE_SIDED").toUpperCase() ===
      "TWO_SIDED"
        ? "TWO_SIDED"
        : "ONE_SIDED";

    // Fetch student profile
    const student = await db.studentProfile.findFirst({
      where: {
        id: studentProfileId,
        user: { schoolId },
      },
      include: {
        user: true,
        class: {
          include: {
            gradeLevel: true,
            classTeacher: {
              include: { user: true },
            },
          },
        },
        gradeLevel: true,
        academicYearSummaries: {
          where: { academicYear },
          take: 1,
        },
      },
    });

    if (!student) throw new AppError("Student not found", 404);

    const summary = student.academicYearSummaries[0] || null;

    // Access control:
    if (req.user.role === Role.STUDENT) {
      if (student.user.id !== req.user.id) {
        throw new AppError("Forbidden: You can only download your own report card", 403);
      }
      if (!summary || !summary.isPublished) {
        throw new AppError("Report card is not published yet for download", 403);
      }
    }

    if (req.user.role === Role.PARENT) {
      const link = await db.parentStudentLink.findFirst({
        where: {
          studentProfileId: student.id,
          parentProfile: { userId: req.user.id },
        },
      });
      if (!link) {
        throw new AppError("Forbidden: You are not linked to this student", 403);
      }
      if (!summary || !summary.isPublished) {
        throw new AppError("Report card is not published yet for download", 403);
      }
    }

    if (!summary) {
      throw new AppError(
        "Academic year summary has not been generated yet for this student and year",
        400,
      );
    }

    // Class size for ranking context
    const classCount = student.classId
      ? await db.studentProfile.count({
          where: { classId: student.classId, user: { isActive: true } },
        })
      : null;

    const studentName = [
      student.user.firstName,
      student.user.middleName,
      student.user.lastName,
    ]
      .filter(Boolean)
      .join(" ");

    const classTeacherUser = student.class?.classTeacher?.[0]?.user;
    const homeroomTeacherName = classTeacherUser
      ? [
          classTeacherUser.firstName,
          classTeacherUser.middleName,
          classTeacherUser.lastName,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

    // Supplementary back side details if TWO_SIDED
    let backSideDetails: CumulativeReportCardData["backSideDetails"] = undefined;

    if (layout === "TWO_SIDED") {
      // Find latest term in this year
      const latestTerm = await db.academicTerm.findFirst({
        where: { schoolId, academicYear },
        orderBy: { endDate: "desc" },
      });

      let subjects: { subjectName: string; marksObtained: number; totalMarks: number; grade?: string | null }[] = [];
      let teacherComments: string | null = null;

      if (latestTerm) {
        const examResults = await db.examResult.findMany({
          where: {
            studentId: student.id,
            exam: { termId: latestTerm.id, schoolId },
          },
          include: { exam: { include: { subject: true } } },
        });

        subjects = examResults.map((er) => ({
          subjectName: er.exam.subject?.name || "Subject",
          marksObtained: er.marksObtained,
          totalMarks: er.exam.totalMarks,
          grade: er.grade,
        }));

        const latestGradeReport = await db.gradeReport.findUnique({
          where: {
            studentId_termId: {
              studentId: student.id,
              termId: latestTerm.id,
            },
          },
        });
        teacherComments = latestGradeReport?.teacherComment || latestGradeReport?.remarks || null;
      }

      // Attendance summary
      const attendanceRecords = await db.attendanceRecord.findMany({
        where: {
          studentId: student.user.id,
          schoolId,
        },
      });

      let attendanceSummary = null;
      if (attendanceRecords.length > 0) {
        const totalDays = attendanceRecords.length;
        const presentDays = attendanceRecords.filter((a) => a.status === "PRESENT").length;
        const absentDays = attendanceRecords.filter((a) => a.status === "ABSENT").length;
        const lateDays = attendanceRecords.filter((a) => a.status === "LATE").length;
        const attendancePercentage = Math.round((presentDays / totalDays) * 100);

        attendanceSummary = {
          totalDays,
          presentDays,
          absentDays,
          lateDays,
          attendancePercentage,
        };
      }

      backSideDetails = {
        recentTermName: latestTerm?.name || "Latest Term",
        subjects,
        teacherComments,
        attendanceSummary,
      };
    }

    const pdfData: CumulativeReportCardData = {
      school: {
        name: school.name,
        address: school.address,
        phone: school.phone,
        email: school.email,
      },
      student: {
        name: studentName,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        className: student.class?.name || "—",
        gradeLevelName: student.class?.gradeLevel?.name || student.gradeLevel?.name || null,
        gender: student.user.gender,
      },
      academicYear,
      summary: {
        overallAverage: summary.overallAverage,
        overallRank: summary.overallRank,
        classSize: classCount,
        isPassing: summary.isPassing,
        passMarkPercentage: school.settings?.passMarkPercentage ?? 50,
        termBreakdown: Array.isArray(summary.termBreakdown)
          ? (summary.termBreakdown as any[])
          : [],
      },
      homeroomTeacherName,
      principalName: "School Administration",
      issueDate: summary.publishedAt
        ? new Date(summary.publishedAt).toLocaleDateString("en-GB")
        : new Date().toLocaleDateString("en-GB"),
      layout,
      backSideDetails,
    };

    const pdfBuffer = await generateCumulativeReportCardPdf(pdfData);

    const safeStudentName = studentName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const filename = `report-card-${safeStudentName}-${academicYear.replace("/", "-")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

router.post("/:studentProfileId/pdf", handleGenerateReportCardPdf);
router.get("/:studentProfileId/pdf", handleGenerateReportCardPdf);

export default router;
