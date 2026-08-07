import { AttendanceStatus } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToUser } from "../../config/socket";
import { sendSms } from "../../utils/sms";

const STATUS_CODE: Record<AttendanceStatus, string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
  EXCUSED: "X",
};

// ── Mark attendance (bulk for a class) ──────────────────────────────────────
export const markAttendance = async (
  schoolId: string,
  markedById: string,
  data: {
    classId: string;
    termId: string;
    date: Date;
    records: Array<{
      studentId: string;
      status: AttendanceStatus;
      note?: string;
    }>;
  },
) => {
  // Verify teacher belongs to this school
  const cls = await db.class.findFirst({
    where: { id: data.classId, schoolId },
  });
  if (!cls) throw new AppError("Class not found", 404);

  const ops = data.records.map((r) =>
    db.attendanceRecord.upsert({
      where: {
        studentId_classId_date: {
          studentId: r.studentId,
          classId: data.classId,
          date: data.date,
        },
      },
      update: { status: r.status, note: r.note, markedById },
      create: {
        schoolId,
        studentId: r.studentId,
        classId: data.classId,
        termId: data.termId,
        date: data.date,
        status: r.status,
        note: r.note,
        markedById,
      },
    }),
  );

  const saved = await db.$transaction(ops);

  // Notify parents of absent students
  const absentStudents = data.records.filter(
    (r) => r.status === "ABSENT" || r.status === "LATE",
  );
  for (const absent of absentStudents) {
    const parentLinks = await db.parentStudentLink.findMany({
      where: { studentProfile: { userId: absent.studentId } },
      include: {
        parentProfile: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                phone: true,
                smsOptIn: true,
              },
            },
          },
        },
      },
    });

    const studentUser = await db.user.findUnique({
      where: { id: absent.studentId },
      select: { firstName: true, lastName: true },
    });

    parentLinks.forEach((link) => {
      const parentUser = link.parentProfile.user;
      const msg =
        absent.status === "ABSENT"
          ? `${studentUser?.firstName} was marked absent on ${data.date.toLocaleDateString()}`
          : `${studentUser?.firstName} was marked late on ${data.date.toLocaleDateString()}`;

      emitToUser(parentUser.id, "notification:new", {
        type: "ATTENDANCE",
        title: "Attendance Alert",
        body: msg,
      });

      db.notification
        .create({
          data: {
            schoolId,
            userId: parentUser.id,
            type: "ATTENDANCE",
            title: "Attendance Alert",
            body: msg,
          },
        })
        .catch(() => {});

      // Phase 5: SMS is a second channel for parents who opted in — the
      // in-app/push notification above already fires regardless, so a
      // failed or unconfigured SMS send never blocks attendance marking.
      if (parentUser.smsOptIn) {
        sendSms(parentUser.phone, `TimhirtHub: ${msg}`).catch(() => {});
      }
    });
  }

  return saved;
};

// ── Get class attendance for a date ────────────────────────────────────────
export const getClassAttendance = async (
  classId: string,
  schoolId: string,
  date?: Date,
) => {
  const targetDate = date ?? new Date();
  targetDate.setHours(0, 0, 0, 0);

  const records = await db.attendanceRecord.findMany({
    where: { classId, schoolId, date: targetDate },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          studentProfile: { select: { rollNumber: true } },
        },
      },
    },
    orderBy: { student: { firstName: "asc" } },
  });

  // Get all students in class who aren't marked yet
  const students = await db.studentProfile.findMany({
    where: { classId, user: { schoolId, isActive: true } },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  });

  return {
    date: targetDate,
    classId,
    records,
    totalStudents: students.length,
    present: records.filter((r) => r.status === "PRESENT").length,
    absent: records.filter((r) => r.status === "ABSENT").length,
    late: records.filter((r) => r.status === "LATE").length,
    excused: records.filter((r) => r.status === "EXCUSED").length,
    unmarked: students.filter(
      (s) => !records.find((r) => r.studentId === s.userId),
    ).length,
  };
};

// ── Student attendance summary ────────────────────────────────────────────────
export const getStudentAttendanceSummary = async (
  studentId: string,
  schoolId: string,
  termId?: string,
) => {
  const where = { studentId, schoolId, ...(termId && { termId }) };

  const [total, present, absent, late, excused] = await Promise.all([
    db.attendanceRecord.count({ where }),
    db.attendanceRecord.count({ where: { ...where, status: "PRESENT" } }),
    db.attendanceRecord.count({ where: { ...where, status: "ABSENT" } }),
    db.attendanceRecord.count({ where: { ...where, status: "LATE" } }),
    db.attendanceRecord.count({ where: { ...where, status: "EXCUSED" } }),
  ]);

  const percentage = total > 0 ? ((present + late * 0.5) / total) * 100 : 0;

  const recentRecords = await db.attendanceRecord.findMany({
    where,
    orderBy: { date: "desc" },
    take: 30,
    select: { date: true, status: true, note: true },
  });

  return {
    total,
    present,
    absent,
    late,
    excused,
    percentage: Math.round(percentage * 10) / 10,
    recentRecords,
  };
};

// ── Class-wide attendance report ──────────────────────────────────────────────
export const getClassAttendanceReport = async (
  classId: string,
  schoolId: string,
  startDate: Date,
  endDate: Date,
) => {
  const students = await db.studentProfile.findMany({
    where: { classId, user: { schoolId, isActive: true } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const report = await Promise.all(
    students.map(async (s) => {
      const records = await db.attendanceRecord.findMany({
        where: {
          studentId: s.userId,
          classId,
          date: { gte: startDate, lte: endDate },
        },
        select: { status: true, date: true },
      });
      const total = records.length;
      const present = records.filter((r) => r.status === "PRESENT").length;
      const absent = records.filter((r) => r.status === "ABSENT").length;
      const percentage =
        total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0;

      return {
        studentId: s.userId,
        name: `${s.user.firstName} ${s.user.lastName}`,
        rollNumber: s.rollNumber,
        total,
        present,
        absent,
        late: records.filter((r) => r.status === "LATE").length,
        percentage,
        atRisk: percentage < 75,
      };
    }),
  );

  return report.sort((a, b) => a.percentage - b.percentage);
};

// ── Attendance streak / trend for dashboard ──────────────────────────────────
export const getAttendanceTrend = async (
  schoolId: string,
  classId: string,
  days = 30,
) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const records = await db.attendanceRecord.findMany({
    where: { schoolId, classId, date: { gte: startDate } },
    select: { date: true, status: true },
    orderBy: { date: "asc" },
  });

  // Group by date
  const byDate = records.reduce<
    Record<
      string,
      { present: number; absent: number; late: number; total: number }
    >
  >((acc, r) => {
    const key = r.date.toISOString().split("T")[0];
    if (!acc[key]) acc[key] = { present: 0, absent: 0, late: 0, total: 0 };
    acc[key].total++;
    if (r.status === "PRESENT") acc[key].present++;
    else if (r.status === "ABSENT") acc[key].absent++;
    else if (r.status === "LATE") acc[key].late++;
    return acc;
  }, {});

  return Object.entries(byDate).map(([date, counts]) => ({
    date,
    ...counts,
    percentage:
      counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0,
  }));
};

// ── Printable attendance sheet (requirement doc: "printable attendance sheets")
// Phase 2 built the PDF generator (utils/pdf.ts) but never wired an endpoint to
// it — closing that gap here, following the same pattern as
// academics.service.ts's getReportCardPdf/getMarkSheetPdf. ─────────────────────
export const getAttendanceSheetPdf = async (
  classId: string,
  schoolId: string,
  startDate: Date,
  endDate: Date,
) => {
  const cls = await db.class.findFirst({ where: { id: classId, schoolId } });
  if (!cls) throw new AppError("Class not found", 404);

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new AppError("School not found", 404);

  const students = await db.studentProfile.findMany({
    where: { classId, user: { schoolId, isActive: true } },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { user: { firstName: "asc" } },
  });
  if (students.length === 0)
    throw new AppError("No students found in this class", 404);

  const records = await db.attendanceRecord.findMany({
    where: { classId, schoolId, date: { gte: startDate, lte: endDate } },
    select: { studentId: true, date: true, status: true },
  });

  // Build the school-day column list from the dates that actually have
  // attendance records in range, so sheets don't render empty columns for
  // weekends/holidays with no marking.
  const dateSet = new Set(
    records.map((r) => r.date.toISOString().split("T")[0]),
  );
  const dates = Array.from(dateSet).sort();
  if (dates.length === 0)
    throw new AppError(
      "No attendance records found for this class in the given date range",
      404,
    );

  const { generateAttendanceSheetPdf } = await import("../../utils/pdf");
  const pdf = await generateAttendanceSheetPdf({
    school: {
      name: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
    },
    className: cls.name,
    dateRange: { from: dates[0], to: dates[dates.length - 1] },
    dates,
    students: students.map((s) => {
      const statusesByDate: Record<string, string> = {};
      records
        .filter((r) => r.studentId === s.userId)
        .forEach((r) => {
          statusesByDate[r.date.toISOString().split("T")[0]] =
            STATUS_CODE[r.status];
        });
      return {
        name: `${s.user.firstName} ${s.user.lastName}`,
        admissionNumber: s.admissionNumber,
        statusesByDate,
      };
    }),
  });

  return {
    pdf,
    fileName: `attendance-sheet-${cls.name.replace(/\s+/g, "-")}-${dates[0]}-to-${dates[dates.length - 1]}.pdf`,
  };
};
