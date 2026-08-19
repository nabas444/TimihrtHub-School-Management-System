import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";
import * as AttendanceService from "./attendance.service";
import * as StaffAttendanceService from "./staff-attendance.service";
import { sendSuccess } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";

// ── Student Attendance Controllers ───────────────────────────────────────────
const markAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z
      .object({
        classId: z.string(),
        termId: z.string(),
        date: z.string().datetime(),
        records: z
          .array(
            z.object({
              studentId: z.string(),
              status: z.nativeEnum(AttendanceStatus),
              note: z.string().optional(),
            }),
          )
          .min(1),
      })
      .parse(req.body);
    const result = await AttendanceService.markAttendance(
      req.user.schoolId,
      req.user.id,
      { ...data, date: new Date(data.date) },
    );
    sendSuccess(res, result, `Attendance marked for ${result.length} students`);
  } catch (e) {
    next(e);
  }
};

const getClassAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    sendSuccess(
      res,
      await AttendanceService.getClassAttendance(req.params.classId, req.user.schoolId, date),
    );
  } catch (e) {
    next(e);
  }
};

const getMyAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const termId = req.query.termId as string | undefined;
    sendSuccess(
      res,
      await AttendanceService.getStudentAttendanceSummary(req.user.id, req.user.schoolId, termId),
    );
  } catch (e) {
    next(e);
  }
};

const getStudentAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const termId = req.query.termId as string | undefined;
    sendSuccess(
      res,
      await AttendanceService.getStudentAttendanceSummary(
        req.params.studentId,
        req.user.schoolId,
        termId,
      ),
    );
  } catch (e) {
    next(e);
  }
};

const getClassReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = z
      .object({ startDate: z.string(), endDate: z.string() })
      .parse(req.query);
    sendSuccess(
      res,
      await AttendanceService.getClassAttendanceReport(
        req.params.classId,
        req.user.schoolId,
        new Date(startDate),
        new Date(endDate),
      ),
    );
  } catch (e) {
    next(e);
  }
};

const getAttendanceTrend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId, days } = req.query;
    sendSuccess(
      res,
      await AttendanceService.getAttendanceTrend(
        req.user.schoolId,
        classId as string,
        days ? parseInt(days as string) : 30,
      ),
    );
  } catch (e) {
    next(e);
  }
};

const downloadAttendanceSheet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = z
      .object({ startDate: z.string(), endDate: z.string() })
      .parse(req.query);
    const { pdf, fileName } = await AttendanceService.getAttendanceSheetPdf(
      req.params.classId,
      req.user.schoolId,
      new Date(startDate),
      new Date(endDate),
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (e) {
    next(e);
  }
};

// ── Staff Attendance & Punctuality Controllers ───────────────────────────────
const recordStaffAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z
      .object({
        staffId: z.string(),
        date: z.string(), // "YYYY-MM-DD"
        status: z.enum(["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE", "EXCUSED"]),
        checkInTime: z.string().optional(),
        checkOutTime: z.string().optional(),
        expectedTime: z.string().optional(),
        lateMinutes: z.number().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const result = await StaffAttendanceService.recordStaffAttendance(
      req.user.schoolId,
      req.user.id,
      data,
    );
    sendSuccess(res, result, "Staff attendance recorded");
  } catch (e) {
    next(e);
  }
};

const batchRecordStaffAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z
      .object({
        date: z.string(),
        records: z.array(
          z.object({
            staffId: z.string(),
            status: z.enum(["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE", "EXCUSED"]),
            checkInTime: z.string().optional(),
            checkOutTime: z.string().optional(),
            expectedTime: z.string().optional(),
            lateMinutes: z.number().optional(),
            notes: z.string().optional(),
          }),
        ),
      })
      .parse(req.body);

    const result = await StaffAttendanceService.batchRecordStaffAttendance(
      req.user.schoolId,
      req.user.id,
      data.date,
      data.records,
    );
    sendSuccess(res, result, `Attendance saved for ${result.length} staff members`);
  } catch (e) {
    next(e);
  }
};

const getDailyStaffAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;

    const result = await StaffAttendanceService.getDailyStaffAttendance(
      req.user.schoolId,
      date,
      { role, search, category },
    );
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
};

const getStaffPunctualityAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const startDate = (req.query.startDate as string) || thirtyDaysAgo;
    const endDate = (req.query.endDate as string) || today;
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;

    const result = await StaffAttendanceService.getStaffPunctualityAnalytics(
      req.user.schoolId,
      startDate,
      endDate,
      { role, search, category },
    );
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
};

const issueStaffPenalty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z
      .object({
        staffId: z.string(),
        type: z.enum([
          "SALARY_DEDUCTION",
          "WARNING_LETTER",
          "SUSPENSION",
          "DEMERIT_SCORE",
          "LEAVE_DEDUCTION",
          "CUSTOM",
        ]),
        reason: z.string().min(3),
        amount: z.number().optional(),
        currency: z.string().optional(),
        demeritPoints: z.number().optional(),
        actionNotes: z.string().optional(),
        effectiveDate: z.string().optional(),
      })
      .parse(req.body);

    const result = await StaffAttendanceService.issueStaffPenalty(
      req.user.schoolId,
      req.user.id,
      data,
    );
    sendSuccess(res, result, "Disciplinary penalty issued successfully", 201);
  } catch (e) {
    next(e);
  }
};

const getStaffPenalties = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const staffId = req.query.staffId as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await StaffAttendanceService.getStaffPenalties(req.user.schoolId, {
      staffId,
      status,
    });
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
};

const updateStaffPenaltyStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, actionNotes } = z
      .object({
        status: z.enum(["APPLIED", "DEDUCTED_FROM_PAYROLL", "WAIVED", "RESOLVED"]),
        actionNotes: z.string().optional(),
      })
      .parse(req.body);

    const result = await StaffAttendanceService.updateStaffPenaltyStatus(
      req.user.schoolId,
      req.params.id,
      status,
      actionNotes,
    );
    sendSuccess(res, result, "Penalty status updated");
  } catch (e) {
    next(e);
  }
};

const deleteStaffPenalty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await StaffAttendanceService.deleteStaffPenalty(
      req.user.schoolId,
      req.params.id,
    );
    sendSuccess(res, result, "Penalty record deleted");
  } catch (e) {
    next(e);
  }
};

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];
const isAdminRole = [Role.ADMIN, Role.SUPER_ADMIN];

// Student Attendance routes
router.post("/", authorize(...isStaff), markAttendance);
router.get("/me", getMyAttendance);
router.get("/trend", authorize(...isStaff), getAttendanceTrend);
router.get("/class/:classId", authorize(...isStaff), getClassAttendance);
router.get("/class/:classId/report", authorize(...isStaff), getClassReport);
router.get("/class/:classId/sheet", authorize(...isStaff), downloadAttendanceSheet);
router.get("/student/:studentId", authorize(...isStaff, Role.PARENT), getStudentAttendance);

// Staff Attendance & Punctuality routes (Admin & HR only)
router.post("/staff", authorize(...isAdminRole), recordStaffAttendance);
router.post("/staff/batch", authorize(...isAdminRole), batchRecordStaffAttendance);
router.get("/staff", authorize(...isAdminRole), getDailyStaffAttendance);
router.get("/staff/analytics", authorize(...isAdminRole), getStaffPunctualityAnalytics);

// Staff Disciplinary Penalties & Rules routes
router.post("/staff/penalties", authorize(...isAdminRole), issueStaffPenalty);
router.get("/staff/penalties", authorize(...isAdminRole), getStaffPenalties);
router.patch("/staff/penalties/:id/status", authorize(...isAdminRole), updateStaffPenaltyStatus);
router.delete("/staff/penalties/:id", authorize(...isAdminRole), deleteStaffPenalty);

export default router;
