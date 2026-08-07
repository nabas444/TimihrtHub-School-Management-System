import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AttendanceStatus } from '@prisma/client';
import * as AttendanceService from './attendance.service';
import { sendSuccess } from '../../utils/response';
import { authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

// ── Controller ────────────────────────────────────────────────────────────────
const markAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      classId: z.string(), termId: z.string(), date: z.string().datetime(),
      records: z.array(z.object({ studentId: z.string(), status: z.nativeEnum(AttendanceStatus), note: z.string().optional() })).min(1),
    }).parse(req.body);
    const result = await AttendanceService.markAttendance(req.user.schoolId, req.user.id, { ...data, date: new Date(data.date) });
    sendSuccess(res, result, `Attendance marked for ${result.length} students`);
  } catch (e) { next(e); }
};

const getClassAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    sendSuccess(res, await AttendanceService.getClassAttendance(req.params.classId, req.user.schoolId, date));
  } catch (e) { next(e); }
};

const getMyAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const termId = req.query.termId as string | undefined;
    sendSuccess(res, await AttendanceService.getStudentAttendanceSummary(req.user.id, req.user.schoolId, termId));
  } catch (e) { next(e); }
};

const getStudentAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const termId = req.query.termId as string | undefined;
    sendSuccess(res, await AttendanceService.getStudentAttendanceSummary(req.params.studentId, req.user.schoolId, termId));
  } catch (e) { next(e); }
};

const getClassReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = z.object({ startDate: z.string(), endDate: z.string() }).parse(req.query);
    sendSuccess(res, await AttendanceService.getClassAttendanceReport(req.params.classId, req.user.schoolId, new Date(startDate), new Date(endDate)));
  } catch (e) { next(e); }
};

const getAttendanceTrend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId, days } = req.query;
    sendSuccess(res, await AttendanceService.getAttendanceTrend(req.user.schoolId, classId as string, days ? parseInt(days as string) : 30));
  } catch (e) { next(e); }
};

const downloadAttendanceSheet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = z.object({ startDate: z.string(), endDate: z.string() }).parse(req.query);
    const { pdf, fileName } = await AttendanceService.getAttendanceSheetPdf(
      req.params.classId, req.user.schoolId, new Date(startDate), new Date(endDate),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (e) { next(e); }
};

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

router.post('/', authorize(...isStaff), markAttendance);
router.get('/me', getMyAttendance);                                              // student: own
router.get('/trend', authorize(...isStaff), getAttendanceTrend);
router.get('/class/:classId', authorize(...isStaff), getClassAttendance);
router.get('/class/:classId/report', authorize(...isStaff), getClassReport);
router.get('/class/:classId/sheet', authorize(...isStaff), downloadAttendanceSheet);
router.get('/student/:studentId', authorize(...isStaff, Role.PARENT), getStudentAttendance);

export default router;
