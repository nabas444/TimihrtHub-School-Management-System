import { Router, Request, Response, NextFunction } from "express";
import { db } from "../../config/database";
import { sendSuccess } from "../../utils/response";
import { evaluateDeadline, formatInSchoolTimezone } from "../../utils/deadlines";
import { Role } from "@prisma/client";
import { runDeadlineEngineCycle } from "../../jobs/deadlineEngine";

const router = Router();

// ── GET /deadlines/summary ───────────────────────────────────────────────────
router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const role = req.user.role;

    const school = await db.school.findUnique({
      where: { id: schoolId },
      include: { settings: true },
    });

    const timezone = school?.timezone || "Africa/Addis_Ababa";
    const windowMinutes = school?.settings?.lateThresholdMinutes ?? 15;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMinutesToday = now.getHours() * 60 + now.getMinutes();

    const dayMap = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ] as const;
    const currentDayOfWeek = dayMap[now.getDay()];

    // ── ADMIN VIEW ─────────────────────────────────────────────────────────────
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      // 1. Dynamic Per-Period Timetable Attendance for Today
      const classes = await db.class.findMany({
        where: { schoolId },
        include: {
          classTeacher: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
        },
      });

      const classMap = new Map(classes.map((c) => [c.id, c.name]));

      const todaySlots = await db.timetableSlot.findMany({
        where: {
          class: { schoolId },
          dayOfWeek: currentDayOfWeek,
        },
        include: {
          class: { select: { id: true, name: true } },
          subjectTeaching: {
            include: {
              subject: { select: { name: true } },
              teacherProfile: {
                include: {
                  user: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
          },
        },
        orderBy: { startTime: "asc" },
      });

      const todayAttendanceRecords = await db.attendanceRecord.groupBy({
        by: ["classId"],
        where: { schoolId, date: { gte: todayStart } },
        _count: { id: true },
      });

      const markedClassIds = new Set(todayAttendanceRecords.map((r) => r.classId));

      let attendanceCompliance: any[] = [];

      if (todaySlots.length > 0) {
        attendanceCompliance = todaySlots.map((slot) => {
          const isMarked = markedClassIds.has(slot.classId);
          const teacher = slot.subjectTeaching.teacherProfile.user;
          const [startH, startM] = slot.startTime.split(":").map(Number);
          const slotStartMinutes = startH * 60 + startM;
          const slotCutoffMinutes = slotStartMinutes + windowMinutes;

          const cutoffH = Math.floor(slotCutoffMinutes / 60);
          const cutoffM = slotCutoffMinutes % 60;
          const cutoffTimeStr = `${String(cutoffH).padStart(2, "0")}:${String(cutoffM).padStart(2, "0")}`;
          const isPastCutoff = currentMinutesToday > slotCutoffMinutes;
          const isWindowActive =
            currentMinutesToday >= slotStartMinutes && currentMinutesToday <= slotCutoffMinutes;

          return {
            id: slot.id,
            classId: slot.classId,
            className: slot.class.name,
            subjectName: slot.subjectTeaching.subject.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            cutoffTime: cutoffTimeStr,
            windowMinutes,
            teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unassigned",
            teacherId: teacher?.id,
            isMarked,
            status: isMarked
              ? "COMPLETED"
              : isPastCutoff
              ? "OVERDUE"
              : isWindowActive
              ? "APPROACHING"
              : "SCHEDULED",
          };
        });
      } else {
        // Fallback to homeroom classes
        attendanceCompliance = classes.map((c) => {
          const isMarked = markedClassIds.has(c.id);
          const primaryTeacher = c.classTeacher[0]?.user;
          const isPastCutoff = currentMinutesToday > 9 * 60;
          return {
            id: c.id,
            classId: c.id,
            className: c.name,
            subjectName: "Homeroom Daily",
            startTime: "08:00",
            cutoffTime: "08:15",
            windowMinutes,
            teacherName: primaryTeacher
              ? `${primaryTeacher.firstName} ${primaryTeacher.lastName}`
              : "Unassigned",
            teacherId: primaryTeacher?.id,
            isMarked,
            status: isMarked ? "COMPLETED" : isPastCutoff ? "OVERDUE" : "APPROACHING",
          };
        });
      }

      const markedCount = attendanceCompliance.filter((i) => i.isMarked).length;
      const overdueCount = attendanceCompliance.filter((i) => i.status === "OVERDUE").length;

      // 2. Overdue & active assignments
      const assignments = await db.assignment.findMany({
        where: { schoolId, isPublished: true },
        include: {
          subject: { select: { name: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          submissions: { select: { id: true, status: true } },
        },
        orderBy: { dueDate: "asc" },
      });

      const evaluatedAssignments = assignments.map((a) => {
        const evaluation = evaluateDeadline(a.dueDate, timezone);
        return {
          id: a.id,
          title: a.title,
          subjectName: a.subject.name,
          className: (a.classId ? classMap.get(a.classId) : null) || "All Classes",
          teacherName: `${a.createdBy.firstName} ${a.createdBy.lastName}`,
          dueDate: a.dueDate,
          formattedDueDate: evaluation.formattedDueDate,
          status: evaluation.status,
          humanCountdown: evaluation.humanCountdown,
          totalSubmissions: a.submissions.length,
        };
      });

      // 3. Exam results submission status
      const recentExams = await db.exam.findMany({
        where: { schoolId, scheduledAt: { lt: now } },
        include: {
          subject: { select: { name: true } },
          class: { select: { name: true } },
          results: { select: { id: true } },
        },
        orderBy: { scheduledAt: "desc" },
        take: 20,
      });

      const examCompliance = recentExams.map((e) => {
        const isSubmitted = e.results.length > 0;
        const resultDueDate = new Date(e.scheduledAt);
        resultDueDate.setHours(resultDueDate.getHours() + 48);
        const evaluation = evaluateDeadline(resultDueDate, timezone, isSubmitted ? new Date() : null);

        return {
          examId: e.id,
          title: e.title,
          subjectName: e.subject.name,
          className: e.class?.name || "All Classes",
          scheduledAt: e.scheduledAt,
          isSubmitted,
          resultsCount: e.results.length,
          status: evaluation.status,
          humanCountdown: evaluation.humanCountdown,
        };
      });

      return sendSuccess(res, {
        role,
        timezone,
        windowMinutes,
        summary: {
          attendance: {
            totalPeriods: attendanceCompliance.length,
            markedPeriods: markedCount,
            unmarkedPeriods: attendanceCompliance.length - markedCount,
            overdueCount,
            windowMinutes,
            items: attendanceCompliance,
          },
          assignments: {
            total: evaluatedAssignments.length,
            overdueCount: evaluatedAssignments.filter((a) => a.status === "OVERDUE").length,
            approachingCount: evaluatedAssignments.filter(
              (a) => a.status === "APPROACHING" || a.status === "URGENT",
            ).length,
            items: evaluatedAssignments,
          },
          exams: {
            total: examCompliance.length,
            pendingResultsCount: examCompliance.filter((e) => !e.isSubmitted).length,
            items: examCompliance,
          },
        },
      });
    }

    // ── TEACHER VIEW ───────────────────────────────────────────────────────────
    if (role === Role.TEACHER) {
      const teacherProfile = await db.teacherProfile.findUnique({
        where: { userId },
        include: { assignedClasses: true },
      });

      const assignedClasses = teacherProfile?.assignedClasses || [];
      const classMap = new Map(assignedClasses.map((c) => [c.id, c.name]));

      // Check timetable slots taught by this teacher today
      const mySlotsToday = await db.timetableSlot.findMany({
        where: {
          subjectTeaching: { teacherProfileId: teacherProfile?.id },
          dayOfWeek: currentDayOfWeek,
        },
        include: {
          class: { select: { id: true, name: true } },
          subjectTeaching: {
            include: {
              subject: { select: { name: true } },
            },
          },
        },
        orderBy: { startTime: "asc" },
      });

      const todayAttendance = await db.attendanceRecord.groupBy({
        by: ["classId"],
        where: {
          schoolId,
          date: { gte: todayStart },
        },
      });
      const markedIds = new Set(todayAttendance.map((a) => a.classId));

      let myAttendanceTasks: any[] = [];

      if (mySlotsToday.length > 0) {
        myAttendanceTasks = mySlotsToday.map((slot) => {
          const isMarked = markedIds.has(slot.classId);
          const [startH, startM] = slot.startTime.split(":").map(Number);
          const slotStartMinutes = startH * 60 + startM;
          const slotCutoffMinutes = slotStartMinutes + windowMinutes;

          const cutoffH = Math.floor(slotCutoffMinutes / 60);
          const cutoffM = slotCutoffMinutes % 60;
          const cutoffTimeStr = `${String(cutoffH).padStart(2, "0")}:${String(cutoffM).padStart(2, "0")}`;
          const isPastCutoff = currentMinutesToday > slotCutoffMinutes;
          const isWindowActive =
            currentMinutesToday >= slotStartMinutes && currentMinutesToday <= slotCutoffMinutes;

          return {
            id: slot.id,
            classId: slot.classId,
            className: slot.class.name,
            subjectName: slot.subjectTeaching.subject.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            cutoffTime: cutoffTimeStr,
            windowMinutes,
            isMarked,
            status: isMarked
              ? "COMPLETED"
              : isPastCutoff
              ? "OVERDUE"
              : isWindowActive
              ? "APPROACHING"
              : "SCHEDULED",
          };
        });
      } else {
        // Fallback to assigned homeroom classes
        myAttendanceTasks = assignedClasses.map((c) => {
          const isMarked = markedIds.has(c.id);
          const isPastCutoff = currentMinutesToday > 9 * 60;
          return {
            id: c.id,
            classId: c.id,
            className: c.name,
            subjectName: "Homeroom Attendance",
            startTime: "08:00",
            cutoffTime: "08:15",
            windowMinutes,
            isMarked,
            status: isMarked ? "COMPLETED" : isPastCutoff ? "OVERDUE" : "APPROACHING",
          };
        });
      }

      // Teacher's created assignments
      const myAssignments = await db.assignment.findMany({
        where: { schoolId, createdById: userId },
        include: {
          subject: { select: { name: true } },
          submissions: { select: { id: true, status: true, submittedAt: true } },
        },
        orderBy: { dueDate: "asc" },
      });

      const evaluatedAssignments = myAssignments.map((a) => {
        const evaluation = evaluateDeadline(a.dueDate, timezone);
        return {
          id: a.id,
          title: a.title,
          subjectName: a.subject.name,
          className: (a.classId ? classMap.get(a.classId) : null) || "All Classes",
          dueDate: a.dueDate,
          formattedDueDate: evaluation.formattedDueDate,
          status: evaluation.status,
          humanCountdown: evaluation.humanCountdown,
          totalSubmissions: a.submissions.length,
          gradedSubmissions: a.submissions.filter((s: any) => s.status === "GRADED").length,
        };
      });

      return sendSuccess(res, {
        role,
        timezone,
        windowMinutes,
        summary: {
          attendanceTasks: myAttendanceTasks,
          assignments: evaluatedAssignments,
        },
      });
    }

    // ── STUDENT VIEW ───────────────────────────────────────────────────────────
    if (role === Role.STUDENT) {
      const studentProfile = await db.studentProfile.findUnique({
        where: { userId },
      });

      if (!studentProfile) {
        return sendSuccess(res, { role, timezone, assignments: [], pendingCount: 0 });
      }

      const assignments = await db.assignment.findMany({
        where: {
          schoolId,
          isPublished: true,
          OR: [{ classId: studentProfile.classId }, { classId: null }],
        },
        include: {
          subject: { select: { name: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          submissions: {
            where: { studentId: userId },
            select: { id: true, status: true, submittedAt: true, marksObtained: true },
          },
        },
        orderBy: { dueDate: "asc" },
      });

      const items = assignments.map((a) => {
        const mySub = a.submissions[0] || null;
        const evaluation = evaluateDeadline(
          a.dueDate,
          timezone,
          mySub?.submittedAt || null,
        );

        return {
          id: a.id,
          title: a.title,
          subjectName: a.subject.name,
          teacherName: `${a.createdBy.firstName} ${a.createdBy.lastName}`,
          dueDate: a.dueDate,
          formattedDueDate: evaluation.formattedDueDate,
          deadlineStatus: evaluation.status,
          priority: evaluation.priority,
          color: evaluation.color,
          humanCountdown: evaluation.humanCountdown,
          isSubmitted: !!mySub,
          submissionStatus: mySub ? mySub.status : "NOT_SUBMITTED",
          submittedAt: mySub?.submittedAt || null,
          marksObtained: mySub?.marksObtained ?? null,
          totalMarks: a.totalMarks,
        };
      });

      const pendingCount = items.filter((i) => !i.isSubmitted).length;
      const overdueCount = items.filter(
        (i) => !i.isSubmitted && i.deadlineStatus === "OVERDUE",
      ).length;

      return sendSuccess(res, {
        role,
        timezone,
        summary: {
          total: items.length,
          pendingCount,
          overdueCount,
          items,
        },
      });
    }

    // ── PARENT VIEW ────────────────────────────────────────────────────
    if (role === Role.PARENT) {
      const parentProfile = await db.parentProfile.findUnique({
        where: { userId },
        include: {
          studentLinks: {
            include: {
              studentProfile: {
                include: {
                  user: { select: { id: true, firstName: true, lastName: true } },
                  class: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });

      const children = parentProfile?.studentLinks || [];
      const childrenSummary = [];

      for (const link of children) {
        const childUser = link.studentProfile.user;
        const childClassId = link.studentProfile.classId;

        const assignments = await db.assignment.findMany({
          where: {
            schoolId,
            isPublished: true,
            OR: [{ classId: childClassId }, { classId: null }],
          },
          include: {
            subject: { select: { name: true } },
            submissions: {
              where: { studentId: childUser.id },
              select: { id: true, status: true, submittedAt: true, marksObtained: true },
            },
          },
          orderBy: { dueDate: "asc" },
        });

        const childTasks = assignments.map((a) => {
          const sub = a.submissions[0] || null;
          const evaluation = evaluateDeadline(
            a.dueDate,
            timezone,
            sub?.submittedAt || null,
          );

          return {
            id: a.id,
            title: a.title,
            subjectName: a.subject.name,
            dueDate: a.dueDate,
            formattedDueDate: evaluation.formattedDueDate,
            deadlineStatus: evaluation.status,
            priority: evaluation.priority,
            humanCountdown: evaluation.humanCountdown,
            isSubmitted: !!sub,
            submissionStatus: sub ? sub.status : "NOT_SUBMITTED",
          };
        });

        childrenSummary.push({
          studentId: childUser.id,
          studentName: `${childUser.firstName} ${childUser.lastName}`,
          className: link.studentProfile.class?.name || "Unassigned",
          tasks: childTasks,
          overdueCount: childTasks.filter(
            (t) => !t.isSubmitted && t.deadlineStatus === "OVERDUE",
          ).length,
        });
      }

      return sendSuccess(res, {
        role,
        timezone,
        children: childrenSummary,
      });
    }

    return sendSuccess(res, { role, timezone, summary: {} });
  } catch (e) {
    next(e);
  }
});

// ── POST /deadlines/run-check (Manual trigger for testing / admin) ────────────
router.post("/run-check", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await runDeadlineEngineCycle();
    sendSuccess(res, { success: true }, "Deadline evaluation cycle completed");
  } catch (e) {
    next(e);
  }
});

export default router;
