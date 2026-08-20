import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  Role,
  DayOfWeek,
  AttendanceStatus,
  TutorialEnrollmentStatus,
} from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { authorize } from "../../middleware/auth";
import { sendSuccess, sendCreated } from "../../utils/response";

const router = Router();

const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subjectId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  gradeLevelId: z.string().optional().nullable(),
  teacherProfileId: z.string().optional().nullable(),
  dayOfWeek: z.nativeEnum(DayOfWeek).optional().nullable(),
  specificDate: z.string().optional().nullable(),
  startTime: z.string().min(1, "Start time is required (e.g. 16:00)"),
  endTime: z.string().min(1, "End time is required (e.g. 17:30)"),
  location: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  isRecurring: z.boolean().optional().default(true),
  academicYear: z.string().min(1, "Academic year is required"),
});

const updateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  subjectId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  gradeLevelId: z.string().optional().nullable(),
  teacherProfileId: z.string().optional().nullable(),
  dayOfWeek: z.nativeEnum(DayOfWeek).optional().nullable(),
  specificDate: z.string().optional().nullable(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  isRecurring: z.boolean().optional(),
  academicYear: z.string().optional(),
});

const enrollSchema = z.object({
  studentProfileId: z.string().optional(), // if omitted, self-enrolls requesting student
});

const updateEnrollmentSchema = z.object({
  status: z.nativeEnum(TutorialEnrollmentStatus),
});

const recordAttendanceSchema = z.object({
  date: z.string().min(1, "Date is required (YYYY-MM-DD)"),
  records: z.array(
    z.object({
      studentProfileId: z.string().min(1),
      status: z.nativeEnum(AttendanceStatus),
    })
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/v1/tutorial-sessions/mine
// Student / Parent view: Sessions student is enrolled in or eligible for
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/mine",
  authorize(Role.STUDENT, Role.PARENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const role = req.user.role;

      let studentProfiles: any[] = [];

      if (role === Role.STUDENT) {
        const profile = await db.studentProfile.findUnique({
          where: { userId },
          include: { class: true, gradeLevel: true },
        });
        if (profile) studentProfiles = [profile];
      } else if (role === Role.PARENT) {
        const parent = await db.parentProfile.findUnique({
          where: { userId },
          include: {
            studentLinks: {
              include: {
                studentProfile: {
                  include: { class: true, gradeLevel: true },
                },
              },
            },
          },
        });
        if (parent) {
          studentProfiles = parent.studentLinks.map((l) => l.studentProfile);
        }
      }

      if (studentProfiles.length === 0) {
        return sendSuccess(res, { enrolled: [], available: [] });
      }

      const studentProfileIds = studentProfiles.map((p) => p.id);
      const classIds = studentProfiles.map((p) => p.classId).filter(Boolean);
      const gradeLevelIds = studentProfiles
        .map((p) => p.gradeLevelId)
        .filter(Boolean);

      // Enrolled sessions
      const enrollments = await db.tutorialEnrollment.findMany({
        where: {
          studentProfileId: { in: studentProfileIds },
          tutorialSession: { schoolId },
        },
        include: {
          tutorialSession: {
            include: {
              subject: true,
              class: true,
              gradeLevel: true,
              teacherProfile: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      middleName: true,
                      lastName: true,
                      avatar: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  enrollments: {
                    where: { status: TutorialEnrollmentStatus.ENROLLED },
                  },
                },
              },
            },
          },
          studentProfile: {
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
        orderBy: { enrolledAt: "desc" },
      });

      const enrolledSessionIds = enrollments.map((e) => e.tutorialSessionId);

      // Available sessions (not yet enrolled in, matching student's class / grade level or open)
      const availableSessions = await db.tutorialSession.findMany({
        where: {
          schoolId,
          id: { notIn: enrolledSessionIds },
          OR: [
            { classId: null, gradeLevelId: null },
            ...(classIds.length > 0 ? [{ classId: { in: classIds as string[] } }] : []),
            ...(gradeLevelIds.length > 0
              ? [{ gradeLevelId: { in: gradeLevelIds as string[] } }]
              : []),
          ],
        },
        include: {
          subject: true,
          class: true,
          gradeLevel: true,
          teacherProfile: {
            include: {
              user: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              enrollments: {
                where: { status: TutorialEnrollmentStatus.ENROLLED },
              },
            },
          },
        },
        orderBy: [{ isRecurring: "desc" }, { createdAt: "desc" }],
      });

      sendSuccess(res, {
        enrolled: enrollments,
        available: availableSessions.map((s) => ({
          ...s,
          enrolledCount: s._count.enrollments,
          isFull: s.capacity ? s._count.enrollments >= s.capacity : false,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/v1/tutorial-sessions
// List tutorial sessions (Teacher / Admin)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const role = req.user.role;
      const userId = req.user.id;

      const { subjectId, classId, gradeLevelId, academicYear, search } =
        req.query;

      const where: any = { schoolId };

      if (subjectId) where.subjectId = subjectId as string;
      if (classId) where.classId = classId as string;
      if (gradeLevelId) where.gradeLevelId = gradeLevelId as string;
      if (academicYear) where.academicYear = academicYear as string;

      if (search) {
        where.OR = [
          { title: { contains: search as string, mode: "insensitive" } },
          { location: { contains: search as string, mode: "insensitive" } },
          { subject: { name: { contains: search as string, mode: "insensitive" } } },
        ];
      }

      // If teacher, optionally show all sessions or prioritize their own
      if (role === Role.TEACHER && req.query.onlyMine === "true") {
        const teacher = await db.teacherProfile.findUnique({
          where: { userId },
        });
        if (teacher) {
          where.teacherProfileId = teacher.id;
        }
      }

      const sessions = await db.tutorialSession.findMany({
        where,
        include: {
          subject: true,
          class: true,
          gradeLevel: true,
          teacherProfile: {
            include: {
              user: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              enrollments: true,
            },
          },
          enrollments: {
            select: {
              status: true,
            },
          },
        },
        orderBy: [{ isRecurring: "desc" }, { createdAt: "desc" }],
      });

      const formatted = sessions.map((s) => {
        const enrolledCount = s.enrollments.filter(
          (e) => e.status === TutorialEnrollmentStatus.ENROLLED
        ).length;
        const waitlistedCount = s.enrollments.filter(
          (e) => e.status === TutorialEnrollmentStatus.WAITLISTED
        ).length;

        return {
          ...s,
          enrolledCount,
          waitlistedCount,
          isFull: s.capacity ? enrolledCount >= s.capacity : false,
        };
      });

      sendSuccess(res, { sessions: formatted });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/v1/tutorial-sessions
// Create tutorial session (Teacher creates their own, Admin creates any)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const role = req.user.role;
      const userId = req.user.id;

      const body = createSessionSchema.parse(req.body);

      let teacherProfileId = body.teacherProfileId;

      if (role === Role.TEACHER) {
        const teacher = await db.teacherProfile.findUnique({
          where: { userId },
        });
        if (!teacher) {
          throw new AppError("Teacher profile not found", 400);
        }
        teacherProfileId = teacher.id;
      } else if (!teacherProfileId) {
        throw new AppError("Teacher assignment is required", 400);
      }

      const session = await db.tutorialSession.create({
        data: {
          schoolId,
          title: body.title,
          subjectId: body.subjectId ?? null,
          classId: body.classId ?? null,
          gradeLevelId: body.gradeLevelId ?? null,
          teacherProfileId: teacherProfileId!,
          dayOfWeek: body.dayOfWeek ?? null,
          specificDate: body.specificDate ? new Date(body.specificDate) : null,
          startTime: body.startTime,
          endTime: body.endTime,
          location: body.location ?? null,
          capacity: body.capacity ?? null,
          isRecurring:
            body.isRecurring !== undefined ? body.isRecurring : true,
          academicYear: body.academicYear,
        },
        include: {
          subject: true,
          class: true,
          gradeLevel: true,
          teacherProfile: {
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
      });

      sendCreated(res, {
        message: "Tutorial session created successfully",
        session,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/v1/tutorial-sessions/:id
// Get single tutorial session with roster & attendance summary
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const session = await db.tutorialSession.findFirst({
        where: { id, schoolId },
        include: {
          subject: true,
          class: true,
          gradeLevel: true,
          teacherProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  avatar: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          enrollments: {
            include: {
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
                  gradeLevel: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: [{ status: "asc" }, { enrolledAt: "asc" }],
          },
        },
      });

      if (!session) throw new AppError("Tutorial session not found", 404);

      const enrolled = session.enrollments.filter(
        (e) => e.status === TutorialEnrollmentStatus.ENROLLED
      );
      const waitlisted = session.enrollments.filter(
        (e) => e.status === TutorialEnrollmentStatus.WAITLISTED
      );
      const dropped = session.enrollments.filter(
        (e) => e.status === TutorialEnrollmentStatus.DROPPED
      );

      sendSuccess(res, {
        session: {
          ...session,
          enrolledCount: enrolled.length,
          waitlistedCount: waitlisted.length,
          droppedCount: dropped.length,
          isFull: session.capacity ? enrolled.length >= session.capacity : false,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. PATCH /api/v1/tutorial-sessions/:id
// Update session details (Teacher owner or Admin)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const role = req.user.role;
      const userId = req.user.id;

      const session = await db.tutorialSession.findFirst({
        where: { id, schoolId },
        include: { teacherProfile: true },
      });
      if (!session) throw new AppError("Tutorial session not found", 404);

      if (
        role === Role.TEACHER &&
        session.teacherProfile?.userId !== userId
      ) {
        throw new AppError(
          "You can only edit tutorial sessions you teach",
          403
        );
      }

      const body = updateSessionSchema.parse(req.body);

      const updated = await db.tutorialSession.update({
        where: { id },
        data: {
          title: body.title !== undefined ? body.title : session.title,
          subjectId:
            body.subjectId !== undefined ? body.subjectId : session.subjectId,
          classId: body.classId !== undefined ? body.classId : session.classId,
          gradeLevelId:
            body.gradeLevelId !== undefined
              ? body.gradeLevelId
              : session.gradeLevelId,
          teacherProfileId:
            body.teacherProfileId !== undefined
              ? body.teacherProfileId || session.teacherProfileId
              : session.teacherProfileId,
          dayOfWeek:
            body.dayOfWeek !== undefined ? body.dayOfWeek : session.dayOfWeek,
          specificDate:
            body.specificDate !== undefined
              ? body.specificDate
                ? new Date(body.specificDate)
                : null
              : session.specificDate,
          startTime:
            body.startTime !== undefined ? body.startTime : session.startTime,
          endTime:
            body.endTime !== undefined ? body.endTime : session.endTime,
          location:
            body.location !== undefined ? body.location : session.location,
          capacity:
            body.capacity !== undefined ? body.capacity : session.capacity,
          isRecurring:
            body.isRecurring !== undefined
              ? body.isRecurring
              : session.isRecurring,
          academicYear:
            body.academicYear !== undefined
              ? body.academicYear
              : session.academicYear,
        },
        include: {
          subject: true,
          class: true,
          gradeLevel: true,
          teacherProfile: {
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
      });

      sendSuccess(res, {
        message: "Tutorial session updated successfully",
        session: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. DELETE /api/v1/tutorial-sessions/:id
// Delete session
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const role = req.user.role;
      const userId = req.user.id;

      const session = await db.tutorialSession.findFirst({
        where: { id, schoolId },
        include: { teacherProfile: true },
      });
      if (!session) throw new AppError("Tutorial session not found", 404);

      if (
        role === Role.TEACHER &&
        session.teacherProfile?.userId !== userId
      ) {
        throw new AppError(
          "You can only delete tutorial sessions you teach",
          403
        );
      }

      await db.tutorialSession.delete({ where: { id } });

      sendSuccess(res, { message: "Tutorial session deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/v1/tutorial-sessions/:id/enroll
// Self-enroll or staff enrolling student (auto-waitlists if full!)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:id/enroll",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const role = req.user.role;
      const userId = req.user.id;

      const session = await db.tutorialSession.findFirst({
        where: { id, schoolId },
        include: {
          enrollments: {
            where: { status: TutorialEnrollmentStatus.ENROLLED },
          },
        },
      });
      if (!session) throw new AppError("Tutorial session not found", 404);

      const body = enrollSchema.parse(req.body);

      let targetStudentProfileId: string;

      if (role === Role.STUDENT) {
        const studentProfile = await db.studentProfile.findUnique({
          where: { userId },
        });
        if (!studentProfile) throw new AppError("Student profile not found", 400);
        targetStudentProfileId = studentProfile.id;
      } else if (body.studentProfileId) {
        // Staff enrolling student
        const studentProfile = await db.studentProfile.findFirst({
          where: { id: body.studentProfileId, user: { schoolId } },
        });
        if (!studentProfile) throw new AppError("Student profile not found", 404);
        targetStudentProfileId = studentProfile.id;
      } else {
        throw new AppError("Student profile ID is required", 400);
      }

      // Check if already enrolled or waitlisted
      const existing = await db.tutorialEnrollment.findUnique({
        where: {
          tutorialSessionId_studentProfileId: {
            tutorialSessionId: id,
            studentProfileId: targetStudentProfileId,
          },
        },
      });

      if (existing) {
        if (existing.status === TutorialEnrollmentStatus.ENROLLED) {
          throw new AppError("Student is already enrolled in this session", 409);
        }
        if (existing.status === TutorialEnrollmentStatus.WAITLISTED) {
          throw new AppError(
            "Student is currently on the waitlist for this session",
            409
          );
        }
        // If was dropped, re-enroll
        const currentEnrolledCount = session.enrollments.length;
        const willBeWaitlisted =
          session.capacity !== null &&
          session.capacity !== undefined &&
          currentEnrolledCount >= session.capacity;

        const updated = await db.tutorialEnrollment.update({
          where: { id: existing.id },
          data: {
            status: willBeWaitlisted
              ? TutorialEnrollmentStatus.WAITLISTED
              : TutorialEnrollmentStatus.ENROLLED,
            enrolledAt: new Date(),
          },
        });

        return sendSuccess(res, {
          message: willBeWaitlisted
            ? "Session is at full capacity. You have been placed on the waitlist."
            : "Successfully enrolled in tutorial session",
          enrollment: updated,
        });
      }

      const currentEnrolledCount = session.enrollments.length;
      const willBeWaitlisted =
        session.capacity !== null &&
        session.capacity !== undefined &&
        currentEnrolledCount >= session.capacity;

      const targetStatus = willBeWaitlisted
        ? TutorialEnrollmentStatus.WAITLISTED
        : TutorialEnrollmentStatus.ENROLLED;

      const enrollment = await db.tutorialEnrollment.create({
        data: {
          tutorialSessionId: id,
          studentProfileId: targetStudentProfileId,
          status: targetStatus,
        },
        include: {
          studentProfile: {
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
      });

      sendCreated(res, {
        message: willBeWaitlisted
          ? "Session is at full capacity. Student added to waitlist."
          : "Enrolled in tutorial session successfully",
        enrollment,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. PATCH /api/v1/tutorial-sessions/enrollments/:enrollmentId
// Promote from waitlist / change status
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/enrollments/:enrollmentId",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { enrollmentId } = req.params;
      const schoolId = req.user.schoolId;

      const enrollment = await db.tutorialEnrollment.findFirst({
        where: { id: enrollmentId, tutorialSession: { schoolId } },
      });
      if (!enrollment) throw new AppError("Enrollment not found", 404);

      const body = updateEnrollmentSchema.parse(req.body);

      const updated = await db.tutorialEnrollment.update({
        where: { id: enrollmentId },
        data: { status: body.status },
        include: {
          studentProfile: {
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
      });

      sendSuccess(res, {
        message: `Enrollment status updated to ${body.status}`,
        enrollment: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. DELETE /api/v1/tutorial-sessions/enrollments/:enrollmentId
// Drop / Unenroll student
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/enrollments/:enrollmentId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { enrollmentId } = req.params;
      const schoolId = req.user.schoolId;
      const role = req.user.role;
      const userId = req.user.id;

      const enrollment = await db.tutorialEnrollment.findFirst({
        where: { id: enrollmentId, tutorialSession: { schoolId } },
        include: { studentProfile: true },
      });
      if (!enrollment) throw new AppError("Enrollment not found", 404);

      // Student can only unenroll themselves; Staff can unenroll anyone
      if (role === Role.STUDENT && enrollment.studentProfile.userId !== userId) {
        throw new AppError("You can only cancel your own enrollment", 403);
      }

      await db.tutorialEnrollment.delete({ where: { id: enrollmentId } });

      sendSuccess(res, { message: "Unenrolled from tutorial session successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. POST /api/v1/tutorial-sessions/:id/attendance
// Mark tutorial attendance (fully separate from regular class attendance)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/:id/attendance",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const markedById = req.user.id;

      const session = await db.tutorialSession.findFirst({
        where: { id, schoolId },
      });
      if (!session) throw new AppError("Tutorial session not found", 404);

      const body = recordAttendanceSchema.parse(req.body);
      const logDate = new Date(body.date);

      const results = await Promise.all(
        body.records.map((rec) =>
          db.tutorialAttendanceRecord.upsert({
            where: {
              tutorialSessionId_studentProfileId_date: {
                tutorialSessionId: id,
                studentProfileId: rec.studentProfileId,
                date: logDate,
              },
            },
            create: {
              tutorialSessionId: id,
              studentProfileId: rec.studentProfileId,
              date: logDate,
              status: rec.status,
              markedById,
            },
            update: {
              status: rec.status,
              markedById,
            },
          })
        )
      );

      sendSuccess(res, {
        message: `Saved attendance records for ${results.length} student(s) on ${body.date}`,
        count: results.length,
        records: results,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET /api/v1/tutorial-sessions/:id/attendance
// Get tutorial attendance for a given session & date
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/:id/attendance",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const { date } = req.query;

      const session = await db.tutorialSession.findFirst({
        where: { id, schoolId },
      });
      if (!session) throw new AppError("Tutorial session not found", 404);

      const where: any = { tutorialSessionId: id };
      if (date) {
        where.date = new Date(date as string);
      }

      const records = await db.tutorialAttendanceRecord.findMany({
        where,
        include: {
          tutorialSession: { select: { title: true } },
        },
        orderBy: { date: "desc" },
      });

      sendSuccess(res, { records });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
