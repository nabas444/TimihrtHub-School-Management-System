import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { cacheDel, cacheGet, cacheSet } from "../../config/redis";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role, MilestoneType } from "@prisma/client";
import { getStudentPerformanceInsights } from "../academics/academics.service";
import { recordAuditEvent } from "../../utils/auditLog";

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isFinanceDashboard = [Role.FINANCE, Role.ADMIN, Role.SUPER_ADMIN];

// ── Get school profile ────────────────────────────────────────────────────────
router.get(
  "/profile",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const school = await db.school.findUnique({
        where: { id: req.user.schoolId },
        include: {
          settings: true,
          subscription: {
            select: {
              plan: true,
              status: true,
              currentPeriodEnd: true,
              trialEndsAt: true,
            },
          },
        },
      });
      if (!school) throw new AppError("School not found", 404);
      sendSuccess(res, school);
    } catch (e) {
      next(e);
    }
  },
);

// ── Update school profile ─────────────────────────────────────────────────────
router.patch(
  "/profile",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          name: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().email().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          website: z.string().url().optional(),
          timezone: z.string().optional(),
          academicYear: z.string().optional(),
          termSystem: z.string().optional(),
          gradingSystem: z.string().optional(),
          logo: z.string().optional(),
        })
        .parse(req.body);
      const school = await db.school.update({
        where: { id: req.user.schoolId },
        data,
        include: { settings: true },
      });
      await cacheDel(`school:active:${req.user.schoolId}`);
      sendSuccess(res, school, "School profile updated");
    } catch (e) {
      next(e);
    }
  },
);

// ── Update school settings ────────────────────────────────────────────────────
router.patch(
  "/settings",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          allowParentChat: z.boolean().optional(),
          allowStudentChat: z.boolean().optional(),
          attendanceStartTime: z.string().optional(),
          attendanceCutoffTime: z.string().optional(),
          lateThresholdMinutes: z.number().optional(),
          passMarkPercentage: z.number().optional(),
          enableAiFeatures: z.boolean().optional(),
          enableLibrary: z.boolean().optional(),
          enableTransport: z.boolean().optional(),
          primaryColor: z.string().optional(),
        })
        .parse(req.body);
      const settings = await db.schoolSettings.update({
        where: { schoolId: req.user.schoolId },
        data,
      });

      await recordAuditEvent({
        schoolId: req.user.schoolId,
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "SCHOOL_SETTINGS_UPDATED",
        targetType: "SchoolSettings",
        targetId: settings.id,
        metadata: data,
        req,
      });

      sendSuccess(res, settings, "Settings updated");
    } catch (e) {
      next(e);
    }
  },
);

// ── Admin KPI dashboard ───────────────────────────────────────────────────────
router.get(
  "/dashboard",
  authorize(...isFinanceDashboard),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const userRole = req.user.role;
      const userId = req.user.id;
      const cacheKey = `dashboard:${schoolId}:${userRole}:${userId}`;
      const cached = await cacheGet<object>(cacheKey);
      if (cached) {
        sendSuccess(res, cached);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // ── A. TEACHER DASHBOARD METRICS ─────────────────────────────────────────
      if (userRole === Role.TEACHER) {
        const teacherProfile = await db.teacherProfile.findUnique({
          where: { userId },
          include: {
            subjectTeachings: {
              include: {
                class: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true } },
              },
            },
            assignedClasses: { select: { id: true, name: true } },
            classTeacherOf: { select: { id: true, name: true } },
          },
        });

        const assignedClassIds = new Set<string>();
        const assignedSubjectNames = new Set<string>();

        (teacherProfile?.subjectTeachings ?? []).forEach((t) => {
          if (t.classId) assignedClassIds.add(t.classId);
          if (t.subject?.name) assignedSubjectNames.add(t.subject.name);
        });
        (teacherProfile?.assignedClasses ?? []).forEach((c) => {
          assignedClassIds.add(c.id);
        });
        if (teacherProfile?.classTeacherOfId) {
          assignedClassIds.add(teacherProfile.classTeacherOfId);
        }

        // Include timetable slots if any
        if (teacherProfile?.id) {
          const slots = await db.timetableSlot.findMany({
            where: { subjectTeaching: { teacherProfileId: teacherProfile.id } },
            select: { classId: true },
          });
          slots.forEach((s) => {
            if (s.classId) assignedClassIds.add(s.classId);
          });
        }

        const classIdList = Array.from(assignedClassIds);

        const [totalSchoolStudents, totalSchoolClasses, totalSchoolSubjects] =
          await Promise.all([
            db.user.count({
              where: { schoolId, role: Role.STUDENT, isActive: true },
            }),
            db.class.count({ where: { schoolId } }),
            db.subject.count({ where: { schoolId } }),
          ]);

        let totalMyStudents = 0;
        let myStudentUserIds: string[] = [];

        if (classIdList.length > 0) {
          const studentsInClasses = await db.studentProfile.findMany({
            where: {
              classId: { in: classIdList },
              user: { schoolId, isActive: true },
            },
            select: { id: true, userId: true },
          });
          if (studentsInClasses.length > 0) {
            totalMyStudents = studentsInClasses.length;
            myStudentUserIds = studentsInClasses.map((s) => s.userId);
          } else {
            totalMyStudents = totalSchoolStudents;
            const allSchoolStudents = await db.user.findMany({
              where: { schoolId, role: Role.STUDENT, isActive: true },
              select: { id: true },
            });
            myStudentUserIds = allSchoolStudents.map((s) => s.id);
          }
        } else {
          totalMyStudents = totalSchoolStudents;
          const allSchoolStudents = await db.user.findMany({
            where: { schoolId, role: Role.STUDENT, isActive: true },
            select: { id: true },
          });
          myStudentUserIds = allSchoolStudents.map((s) => s.id);
        }

        const classesCount =
          classIdList.length > 0 ? classIdList.length : totalSchoolClasses;
        const subjectsCount =
          assignedSubjectNames.size > 0
            ? assignedSubjectNames.size
            : totalSchoolSubjects;

        const [
          todayPresent,
          todayAbsent,
          monthlyAttendance,
          myAssignmentsCount,
          pendingGradingCount,
          recentBehaviour,
          upcomingExams,
          recentAnnouncements,
        ] = await Promise.all([
          myStudentUserIds.length > 0
            ? db.attendanceRecord.count({
                where: {
                  schoolId,
                  studentId: { in: myStudentUserIds },
                  date: today,
                  status: "PRESENT",
                },
              })
            : 0,
          myStudentUserIds.length > 0
            ? db.attendanceRecord.count({
                where: {
                  schoolId,
                  studentId: { in: myStudentUserIds },
                  date: today,
                  status: "ABSENT",
                },
              })
            : 0,
          myStudentUserIds.length > 0
            ? db.attendanceRecord.findMany({
                where: {
                  schoolId,
                  studentId: { in: myStudentUserIds },
                  date: { gte: thisMonth },
                },
                select: { status: true },
                take: 5000,
              })
            : [],
          db.assignment.count({
            where: {
              schoolId,
              createdById: userId,
              isPublished: true,
              dueDate: { gte: new Date() },
            },
          }),
          db.submission.count({
            where: {
              assignment: { schoolId, createdById: userId },
              status: "SUBMITTED",
            },
          }),
          myStudentUserIds.length > 0
            ? db.behaviourRecord.findMany({
                where: {
                  schoolId,
                  studentId: { in: myStudentUserIds },
                  createdAt: { gte: thisMonth },
                },
                select: { type: true },
                take: 100,
              })
            : [],
          classIdList.length > 0
            ? db.exam.findMany({
                where: {
                  schoolId,
                  classId: { in: classIdList },
                  scheduledAt: { gte: new Date() },
                  isPublished: true,
                },
                include: {
                  subject: { select: { name: true } },
                  class: { select: { name: true } },
                },
                take: 5,
                orderBy: { scheduledAt: "asc" },
              })
            : db.exam.findMany({
                where: {
                  schoolId,
                  scheduledAt: { gte: new Date() },
                  isPublished: true,
                },
                include: {
                  subject: { select: { name: true } },
                  class: { select: { name: true } },
                },
                take: 5,
                orderBy: { scheduledAt: "asc" },
              }),
          db.announcement.findMany({
            where: { schoolId, publishedAt: { lte: new Date() } },
            orderBy: { publishedAt: "desc" },
            take: 3,
          }),
        ]);

        const attendanceRate =
          monthlyAttendance.length > 0
            ? Math.round(
                (monthlyAttendance.filter((r) => r.status === "PRESENT").length /
                  monthlyAttendance.length) *
                  100,
              )
            : 0;

        const meritCount = recentBehaviour.filter(
          (r) => r.type === "MERIT" || r.type === "COMMENDATION",
        ).length;
        const demeritCount = recentBehaviour.filter(
          (r) => r.type === "DEMERIT" || r.type === "INCIDENT",
        ).length;

        const teacherDashboard = {
          isTeacher: true,
          users: {
            students: totalMyStudents,
            teachers: 1,
            parents: 0,
          },
          teacher: {
            totalStudents: totalMyStudents,
            classesCount: classIdList.length,
            subjectsCount: assignedSubjectNames.size,
            pendingGrading: pendingGradingCount,
            activeAssignments: myAssignmentsCount,
          },
          todayAttendance: {
            present: todayPresent,
            absent: todayAbsent,
            total: todayPresent + todayAbsent,
            rate:
              todayPresent + todayAbsent > 0
                ? Math.round((todayPresent / (todayPresent + todayAbsent)) * 100)
                : 0,
          },
          monthlyAttendanceRate: attendanceRate,
          pendingAssignments: myAssignmentsCount,
          overdueInvoices: 0,
          feeCollection: { totalBilled: 0, totalCollected: 0, totalPending: 0, collectionRate: 0 },
          behaviour: { merits: meritCount, demerits: demeritCount },
          upcomingExams,
          recentAnnouncements,
          academicPerformance: null,
        };

        await cacheSet(cacheKey, teacherDashboard, 300);
        sendSuccess(res, teacherDashboard);
        return;
      }

      // ── B. ADMIN / FINANCE DASHBOARD METRICS ─────────────────────────────────
      const [
        totalStudents,
        totalTeachers,
        totalParents,
        todayPresent,
        todayAbsent,
        pendingAssignments,
        overdueInvoices,
        recentBehaviour,
        upcomingExams,
        monthlyAttendance,
        recentAnnouncements,
        feeInvoiceTotals,
        currentTerm,
      ] = await Promise.all([
        db.user.count({ where: { schoolId, role: "STUDENT", isActive: true } }),
        db.user.count({ where: { schoolId, role: "TEACHER", isActive: true } }),
        db.user.count({ where: { schoolId, role: "PARENT", isActive: true } }),
        db.attendanceRecord.count({
          where: { schoolId, date: today, status: "PRESENT" },
        }),
        db.attendanceRecord.count({
          where: { schoolId, date: today, status: "ABSENT" },
        }),
        db.assignment.count({
          where: { schoolId, isPublished: true, dueDate: { gte: new Date() } },
        }),
        db.feeInvoice.count({
          where: { schoolId, status: { in: ["PENDING", "OVERDUE"] } },
        }),
        db.behaviourRecord.findMany({
          where: { schoolId, createdAt: { gte: thisMonth } },
          select: { type: true },
          take: 100,
        }),
        db.exam.findMany({
          where: {
            schoolId,
            scheduledAt: { gte: new Date() },
            isPublished: true,
          },
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
          },
          take: 5,
          orderBy: { scheduledAt: "asc" },
        }),
        db.attendanceRecord.findMany({
          where: { schoolId, date: { gte: thisMonth } },
          select: { status: true },
          take: 5000,
        }),
        db.announcement.findMany({
          where: { schoolId, publishedAt: { lte: new Date() } },
          orderBy: { publishedAt: "desc" },
          take: 3,
        }),
        db.feeInvoice.aggregate({
          where: { schoolId },
          _sum: { amount: true, paidAmount: true },
        }),
        db.academicTerm.findFirst({ where: { schoolId, isCurrent: true } }),
      ]);

      const attendanceRate =
        monthlyAttendance.length > 0
          ? Math.round(
              (monthlyAttendance.filter((r) => r.status === "PRESENT").length /
                monthlyAttendance.length) *
                100,
            )
          : 0;

      const meritCount = recentBehaviour.filter(
        (r) => r.type === "MERIT" || r.type === "COMMENDATION",
      ).length;
      const demeritCount = recentBehaviour.filter(
        (r) => r.type === "DEMERIT" || r.type === "INCIDENT",
      ).length;

      const totalBilled = feeInvoiceTotals._sum.amount ?? 0;
      const totalCollected = feeInvoiceTotals._sum.paidAmount ?? 0;
      const feeCollection = {
        totalBilled,
        totalCollected,
        totalPending: Math.max(totalBilled - totalCollected, 0),
        collectionRate:
          totalBilled > 0
            ? Math.round((totalCollected / totalBilled) * 1000) / 10
            : 0,
      };

      let academicPerformance: object | null = null;
      if (currentTerm) {
        try {
          const insights = await getStudentPerformanceInsights(
            schoolId,
            currentTerm.id,
            { topCount: 5, atRiskThresholdPercentage: 50 },
          );
          academicPerformance = {
            termId: currentTerm.id,
            termName: currentTerm.name,
            ...insights,
          };
        } catch {
          academicPerformance = null;
        }
      }

      const dashboard = {
        isTeacher: false,
        users: {
          students: totalStudents,
          teachers: totalTeachers,
          parents: totalParents,
        },
        todayAttendance: {
          present: todayPresent,
          absent: todayAbsent,
          total: todayPresent + todayAbsent,
          rate:
            todayPresent + todayAbsent > 0
              ? Math.round((todayPresent / (todayPresent + todayAbsent)) * 100)
              : 0,
        },
        monthlyAttendanceRate: attendanceRate,
        pendingAssignments,
        overdueInvoices,
        feeCollection,
        behaviour: { merits: meritCount, demerits: demeritCount },
        upcomingExams,
        recentAnnouncements,
        academicPerformance,
      };

      await cacheSet(cacheKey, dashboard, 300); // cache 5 mins
      sendSuccess(res, dashboard);
    } catch (e) {
      next(e);
    }
  },
);

// ── Grade levels ──────────────────────────────────────────────────────────────
router.get(
  "/grade-levels",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;

      let levels = await db.gradeLevel.findMany({
        where: { schoolId },
        include: { _count: { select: { students: true, classes: true } } },
        orderBy: { level: "asc" },
      });

      // Auto-initialize standard Grade 1 to Grade 12 if none exist for this school
      if (levels.length === 0) {
        await Promise.all(
          Array.from({ length: 12 }, (_, i) => i + 1).map((lvl) =>
            db.gradeLevel.create({
              data: {
                schoolId,
                name: `Grade ${lvl}`,
                level: lvl,
                milestoneType: MilestoneType.NONE,
              },
            }),
          ),
        );
        levels = await db.gradeLevel.findMany({
          where: { schoolId },
          include: { _count: { select: { students: true, classes: true } } },
          orderBy: { level: "asc" },
        });
      }

      sendSuccess(res, levels);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/grade-levels",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          name: z.string(),
          level: z.number().int(),
          milestoneType: z.nativeEnum(MilestoneType).optional().default(MilestoneType.NONE),
        })
        .parse(req.body);
      const gl = await db.gradeLevel.create({
        data: { schoolId: req.user.schoolId, ...data },
      });
      sendSuccess(res, gl, "Grade level created", 201);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/grade-levels/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = z
        .object({
          name: z.string().optional(),
          level: z.number().int().optional(),
          milestoneType: z.nativeEnum(MilestoneType).optional(),
        })
        .parse(req.body);

      const existing = await db.gradeLevel.findFirst({
        where: { id, schoolId: req.user.schoolId },
      });
      if (!existing) throw new AppError("Grade level not found", 404);

      const updated = await db.gradeLevel.update({
        where: { id },
        data,
      });
      sendSuccess(res, updated, "Grade level updated");
    } catch (e) {
      next(e);
    }
  },
);

// Suggest Ethiopian milestone defaults (Grade 6 & 8 -> EXTERNAL_EXAM, Grade 12 -> EXTERNAL_EXAM, KG -> CEREMONY)
router.get(
  "/grade-levels/suggested-milestones",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const levels = await db.gradeLevel.findMany({
        where: { schoolId },
        orderBy: { level: "asc" },
      });

      const suggestions = levels.map((lvl) => {
        const nameLower = lvl.name.toLowerCase();
        let suggestedType: MilestoneType = MilestoneType.NONE;
        let suggestionReason = "Standard academic year";

        if (
          nameLower.includes("grade 6") ||
          lvl.level === 6 ||
          nameLower.includes("primary 6")
        ) {
          suggestedType = MilestoneType.EXTERNAL_EXAM;
          suggestionReason = "Grade 6 Regional Ministry Exam";
        } else if (
          nameLower.includes("grade 8") ||
          lvl.level === 8 ||
          nameLower.includes("middle 8")
        ) {
          suggestedType = MilestoneType.EXTERNAL_EXAM;
          suggestionReason = "Grade 8 Regional Ministry Exam";
        } else if (
          nameLower.includes("grade 12") ||
          lvl.level === 12 ||
          nameLower.includes("form 4")
        ) {
          suggestedType = MilestoneType.EXTERNAL_EXAM;
          suggestionReason = "Grade 12 National ESSLCE / University Entrance Exam";
        } else if (
          nameLower.includes("kindergarten") ||
          nameLower.includes("kg 3") ||
          nameLower.includes("kg 2") ||
          nameLower.includes("kg") ||
          nameLower.includes("prep") ||
          nameLower.includes("nursery") ||
          lvl.level === 0
        ) {
          suggestedType = MilestoneType.CEREMONY;
          suggestionReason = "Kindergarten Completion Ceremony";
        }

        return {
          id: lvl.id,
          name: lvl.name,
          level: lvl.level,
          currentMilestoneType: lvl.milestoneType,
          suggestedMilestoneType: suggestedType,
          suggestionReason,
        };
      });

      sendSuccess(res, suggestions);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/grade-levels/apply-suggested-milestones",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user.schoolId;
      const { mappings } = z
        .object({
          mappings: z.array(
            z.object({
              id: z.string(),
              milestoneType: z.nativeEnum(MilestoneType),
            }),
          ),
        })
        .parse(req.body);

      const updates = await Promise.all(
        mappings.map((m) =>
          db.gradeLevel.updateMany({
            where: { id: m.id, schoolId },
            data: { milestoneType: m.milestoneType },
          }),
        ),
      );

      sendSuccess(res, { updatedCount: updates.length }, "Milestones updated successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/grade-levels/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;

      const gl = await db.gradeLevel.findFirst({
        where: { id, schoolId },
        include: {
          _count: { select: { students: true, classes: true } },
        },
      });
      if (!gl) throw new AppError("Grade level not found", 404);

      if (gl._count.students > 0 || gl._count.classes > 0) {
        throw new AppError(
          "Cannot delete grade level that currently has classes or students assigned",
          400,
        );
      }

      await db.gradeLevel.delete({ where: { id } });
      sendSuccess(res, null, "Grade level deleted");
    } catch (e) {
      next(e);
    }
  },
);

// ── Events ────────────────────────────────────────────────────────────────────
router.get(
  "/events",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await db.schoolEvent.findMany({
        where: { schoolId: req.user.schoolId, startDate: { gte: new Date() } },
        orderBy: { startDate: "asc" },
        take: 20,
      });
      sendSuccess(res, events);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/events",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          title: z.string(),
          description: z.string().optional(),
          startDate: z.string().datetime(),
          endDate: z.string().datetime().optional(),
          location: z.string().optional(),
          type: z.string().optional(),
        })
        .parse(req.body);
      const event = await db.schoolEvent.create({
        data: {
          schoolId: req.user.schoolId,
          ...data,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
      });
      sendSuccess(res, event, "Event created", 201);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
