import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { cacheDel, cacheGet, cacheSet } from "../../config/redis";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";
import { getStudentPerformanceInsights } from "../academics/academics.service";

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
      const cacheKey = `dashboard:${schoolId}`;
      const cached = await cacheGet<object>(cacheKey);
      if (cached) {
        sendSuccess(res, cached);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

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

      // Fee collection breakdown vs. pending dues (requirement doc: "Term-by-term
      // fee collection breakdown vs. pending dues").
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

      // doc: "Pass/fail rate statistics" and "Best-performing and at-risk students
      // identification"). Only computable once the current term has published
      // grade reports, so this degrades gracefully rather than failing the whole
      // dashboard if there's nothing to summarize yet.
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
          academicPerformance = null; // no grade reports generated for the current term yet
        }
      }

      const dashboard = {
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
      const levels = await db.gradeLevel.findMany({
        where: { schoolId: req.user.schoolId },
        orderBy: { level: "asc" },
        include: { _count: { select: { students: true, classes: true } } },
      });
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
        .object({ name: z.string(), level: z.number().int().positive() })
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
