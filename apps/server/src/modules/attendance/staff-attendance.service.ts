/**
 * TimhirtHub Staff Presence, Punctuality & Disciplinary System
 * Manages daily faculty/staff attendance, punctuality analytics,
 * late arrival tracking, and disciplinary rules & salary deduction penalties.
 */

import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToUser } from "../../config/socket";
import { NotificationType, Role } from "@prisma/client";
import { formatInSchoolTimezone } from "../../utils/deadlines";

export type StaffAttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "HALF_DAY"
  | "ON_LEAVE"
  | "EXCUSED"
  | "UNRECORDED";

export type PenaltyType =
  | "SALARY_DEDUCTION"
  | "WARNING_LETTER"
  | "SUSPENSION"
  | "DEMERIT_SCORE"
  | "LEAVE_DEDUCTION"
  | "CUSTOM";

export type PenaltyStatus =
  | "APPLIED"
  | "DEDUCTED_FROM_PAYROLL"
  | "WAIVED"
  | "RESOLVED";

let tablesInitialized = false;

export async function ensureStaffAttendanceTables() {
  if (tablesInitialized) return;
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS staff_attendance_records (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        staff_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'PRESENT',
        check_in_time VARCHAR,
        check_out_time VARCHAR,
        expected_time VARCHAR DEFAULT '08:00',
        late_minutes INT DEFAULT 0,
        notes TEXT,
        marked_by_id VARCHAR NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT staff_attendance_unique UNIQUE (staff_id, date)
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_staff_att_school_date ON staff_attendance_records (school_id, date)
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_staff_att_staff_date ON staff_attendance_records (staff_id, date)
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS staff_penalties (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        staff_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        issued_by_id VARCHAR NOT NULL REFERENCES users(id),
        type VARCHAR NOT NULL DEFAULT 'WARNING_LETTER',
        reason TEXT NOT NULL,
        amount DOUBLE PRECISION DEFAULT 0,
        currency VARCHAR DEFAULT 'ETB',
        demerit_points INT DEFAULT 0,
        status VARCHAR DEFAULT 'APPLIED',
        effective_date TIMESTAMPTZ DEFAULT NOW(),
        action_notes TEXT,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_staff_penalties_school_staff ON staff_penalties (school_id, staff_id)
    `);

    tablesInitialized = true;
  } catch (err) {
    console.error("Failed to initialize staff attendance tables:", err);
  }
}

/**
 * 1. Mark or Update Single Staff Attendance Record
 */
export async function recordStaffAttendance(
  schoolId: string,
  markedById: string,
  data: {
    staffId: string;
    date: string; // "YYYY-MM-DD"
    status: StaffAttendanceStatus;
    checkInTime?: string;
    checkOutTime?: string;
    expectedTime?: string;
    lateMinutes?: number;
    notes?: string;
  },
) {
  await ensureStaffAttendanceTables();

  const {
    staffId,
    date,
    status,
    checkInTime = null,
    checkOutTime = null,
    expectedTime = "08:00",
    lateMinutes = 0,
    notes = null,
  } = data;

  // Auto-compute lateMinutes if checkInTime and expectedTime exist and lateMinutes not set
  let computedLate = lateMinutes;
  if (status === "LATE" && checkInTime && expectedTime && !lateMinutes) {
    const [expH, expM] = expectedTime.split(":").map(Number);
    const [inH, inM] = checkInTime.split(":").map(Number);
    const diff = (inH * 60 + inM) - (expH * 60 + expM);
    computedLate = Math.max(0, diff);
  }

  const result: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO staff_attendance_records (
      school_id, staff_id, date, status, check_in_time, check_out_time, expected_time, late_minutes, notes, marked_by_id, updated_at
    ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (staff_id, date) DO UPDATE SET
      status = EXCLUDED.status,
      check_in_time = EXCLUDED.check_in_time,
      check_out_time = EXCLUDED.check_out_time,
      expected_time = EXCLUDED.expected_time,
      late_minutes = EXCLUDED.late_minutes,
      notes = EXCLUDED.notes,
      marked_by_id = EXCLUDED.marked_by_id,
      updated_at = NOW()
    RETURNING *;
  `,
    schoolId,
    staffId,
    date,
    status,
    checkInTime,
    checkOutTime,
    expectedTime,
    computedLate,
    notes,
    markedById,
  );

  return result[0];
}

/**
 * 2. Batch Mark Staff Attendance for a Given Date
 */
export async function batchRecordStaffAttendance(
  schoolId: string,
  markedById: string,
  date: string,
  records: Array<{
    staffId: string;
    status: StaffAttendanceStatus;
    checkInTime?: string;
    checkOutTime?: string;
    expectedTime?: string;
    lateMinutes?: number;
    notes?: string;
  }>,
) {
  await ensureStaffAttendanceTables();

  const results = [];
  for (const r of records) {
    const res = await recordStaffAttendance(schoolId, markedById, {
      ...r,
      date,
    });
    results.push(res);
  }

  return results;
}

/**
 * 3. Get Daily Staff Attendance Register with Advanced Categorical Filtering
 */
export async function getDailyStaffAttendance(
  schoolId: string,
  date: string,
  filters: { role?: string; search?: string; category?: string } = {},
) {
  await ensureStaffAttendanceTables();

  const search = filters.search?.trim();
  const allowedRoles: Role[] = [
    Role.TEACHER,
    Role.FINANCE,
    Role.ADMIN,
    Role.SUPER_ADMIN,
  ];

  // 1. Fetch all staff users for total / category counters
  const allStaffUsers = await db.user.findMany({
    where: {
      schoolId,
      role: { in: allowedRoles },
      isActive: true,
    },
    include: {
      teacherProfile: {
        select: {
          employeeId: true,
          specialization: true,
          qualification: true,
        },
      },
      adminProfile: {
        select: {
          employeeId: true,
          department: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
  });

  // Fetch existing attendance records for the date
  let records: any[] = [];
  try {
    records = await db.$queryRawUnsafe(
      `
      SELECT * FROM staff_attendance_records
      WHERE school_id = $1 AND date = $2::date
    `,
      schoolId,
      date,
    );
  } catch (e) {
    console.warn("Records query warning:", e);
  }

  const recordMap = new Map(records.map((r) => [r.staff_id, r]));

  // Build mapped roster for all staff
  const fullRoster = allStaffUsers.map((staff: any) => {
    const rec = recordMap.get(staff.id);
    const category =
      staff.role === Role.TEACHER
        ? "TEACHER"
        : staff.role === Role.FINANCE
        ? "FINANCE"
        : "ADMIN";

    const department =
      staff.role === Role.TEACHER
        ? staff.teacherProfile?.specialization || "Teaching & Academics"
        : staff.role === Role.FINANCE
        ? "Finance & Accounts"
        : staff.adminProfile?.department || "Administration & HR";

    const employeeId =
      staff.teacherProfile?.employeeId ||
      staff.adminProfile?.employeeId ||
      "—";

    return {
      staffId: staff.id,
      staff,
      category,
      department,
      employeeId,
      attendanceId: rec?.id || null,
      status: (rec?.status as StaffAttendanceStatus) || "UNRECORDED",
      checkInTime: rec?.check_in_time || null,
      checkOutTime: rec?.check_out_time || null,
      expectedTime: rec?.expected_time || "08:00",
      lateMinutes: rec?.late_minutes || 0,
      notes: rec?.notes || null,
      markedAt: rec?.updated_at || null,
    };
  });

  // Calculate true counts across full roster
  const presentCount = fullRoster.filter((r) => r.status === "PRESENT").length;
  const lateCount = fullRoster.filter((r) => r.status === "LATE").length;
  const absentCount = fullRoster.filter((r) => r.status === "ABSENT").length;
  const unrecordedCount = fullRoster.filter((r) => r.status === "UNRECORDED").length;

  const categories = {
    TEACHER: {
      total: fullRoster.filter((r) => r.category === "TEACHER").length,
      present: fullRoster.filter((r) => r.category === "TEACHER" && r.status === "PRESENT").length,
      late: fullRoster.filter((r) => r.category === "TEACHER" && r.status === "LATE").length,
      absent: fullRoster.filter((r) => r.category === "TEACHER" && r.status === "ABSENT").length,
      unrecorded: fullRoster.filter((r) => r.category === "TEACHER" && r.status === "UNRECORDED").length,
    },
    FINANCE: {
      total: fullRoster.filter((r) => r.category === "FINANCE").length,
      present: fullRoster.filter((r) => r.category === "FINANCE" && r.status === "PRESENT").length,
      late: fullRoster.filter((r) => r.category === "FINANCE" && r.status === "LATE").length,
      absent: fullRoster.filter((r) => r.category === "FINANCE" && r.status === "ABSENT").length,
      unrecorded: fullRoster.filter((r) => r.category === "FINANCE" && r.status === "UNRECORDED").length,
    },
    ADMIN: {
      total: fullRoster.filter((r) => r.category === "ADMIN").length,
      present: fullRoster.filter((r) => r.category === "ADMIN" && r.status === "PRESENT").length,
      late: fullRoster.filter((r) => r.category === "ADMIN" && r.status === "LATE").length,
      absent: fullRoster.filter((r) => r.category === "ADMIN" && r.status === "ABSENT").length,
      unrecorded: fullRoster.filter((r) => r.category === "ADMIN" && r.status === "UNRECORDED").length,
    },
  };

  // Filter roster if search or category filter was explicitly passed
  let filteredRoster = fullRoster;

  if (filters.role && filters.role !== "ALL") {
    filteredRoster = filteredRoster.filter((r) => r.staff.role === filters.role);
  } else if (filters.category && filters.category !== "ALL") {
    filteredRoster = filteredRoster.filter((r) => r.category === filters.category);
  }

  if (search) {
    const s = search.toLowerCase();
    filteredRoster = filteredRoster.filter((item) => {
      const fullName = `${item.staff.firstName || ""} ${item.staff.lastName || ""}`.toLowerCase();
      const email = (item.staff.email || "").toLowerCase();
      const phone = (item.staff.phone || "").toLowerCase();
      const empId = (item.employeeId || "").toLowerCase();
      const dept = (item.department || "").toLowerCase();
      const notes = (item.notes || "").toLowerCase();

      return (
        fullName.includes(s) ||
        email.includes(s) ||
        phone.includes(s) ||
        empId.includes(s) ||
        dept.includes(s) ||
        notes.includes(s)
      );
    });
  }

  return {
    date,
    totalStaff: fullRoster.length,
    counts: {
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      unrecorded: unrecordedCount,
      attendanceRate:
        fullRoster.length > 0
          ? Math.round(((presentCount + lateCount) / fullRoster.length) * 100)
          : 0,
      punctualityRate:
        presentCount + lateCount > 0
          ? Math.round((presentCount / (presentCount + lateCount)) * 100)
          : 0,
    },
    categories,
    roster: filteredRoster,
  };
}

/**
 * 4. Get Staff Punctuality & Attendance Analytics Assessment with Advanced Categorization
 */
export async function getStaffPunctualityAnalytics(
  schoolId: string,
  startDate: string,
  endDate: string,
  filters: { role?: string; search?: string; category?: string } = {},
) {
  await ensureStaffAttendanceTables();

  const search = filters.search?.trim();
  const allowedRoles: Role[] = [
    Role.TEACHER,
    Role.FINANCE,
    Role.ADMIN,
    Role.SUPER_ADMIN,
  ];

  const staffUsers = await db.user.findMany({
    where: {
      schoolId,
      role: { in: allowedRoles },
      isActive: true,
    },
    include: {
      teacherProfile: { select: { employeeId: true, specialization: true, qualification: true } },
      adminProfile: { select: { employeeId: true, department: true } },
    },
    orderBy: [{ role: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
  });

  // Query aggregated attendance metrics
  let attendanceAgg: any[] = [];
  try {
    attendanceAgg = await db.$queryRawUnsafe(
      `
      SELECT
        staff_id,
        COUNT(*)::int as total_recorded_days,
        COUNT(CASE WHEN status = 'PRESENT' THEN 1 END)::int as present_days,
        COUNT(CASE WHEN status = 'LATE' THEN 1 END)::int as late_days,
        COUNT(CASE WHEN status = 'ABSENT' THEN 1 END)::int as absent_days,
        COUNT(CASE WHEN status = 'EXCUSED' OR status = 'ON_LEAVE' THEN 1 END)::int as excused_days,
        COALESCE(SUM(late_minutes), 0)::int as total_late_minutes
      FROM staff_attendance_records
      WHERE school_id = $1 AND date >= $2::date AND date <= $3::date
      GROUP BY staff_id
    `,
      schoolId,
      startDate,
      endDate,
    );
  } catch (e) {
    console.warn("Attendance agg warning:", e);
  }

  // Query active penalties per staff member
  let penaltiesAgg: any[] = [];
  try {
    penaltiesAgg = await db.$queryRawUnsafe(
      `
      SELECT
        staff_id,
        COUNT(*)::int as total_penalties,
        COALESCE(SUM(amount), 0)::float as total_deductions,
        COALESCE(SUM(demerit_points), 0)::int as total_demerits
      FROM staff_penalties
      WHERE school_id = $1 AND status != 'WAIVED'
      GROUP BY staff_id
    `,
      schoolId,
    );
  } catch (e) {
    console.warn("Penalties agg warning:", e);
  }

  const attMap = new Map(attendanceAgg.map((a) => [a.staff_id, a]));
  const penMap = new Map(penaltiesAgg.map((p) => [p.staff_id, p]));

  let staffAssessments = staffUsers.map((staff: any) => {
    const a = attMap.get(staff.id) || {
      total_recorded_days: 0,
      present_days: 0,
      late_days: 0,
      absent_days: 0,
      excused_days: 0,
      total_late_minutes: 0,
    };
    const p = penMap.get(staff.id) || {
      total_penalties: 0,
      total_deductions: 0,
      total_demerits: 0,
    };

    const category =
      staff.role === Role.TEACHER
        ? "TEACHER"
        : staff.role === Role.FINANCE
        ? "FINANCE"
        : "ADMIN";

    const department =
      staff.role === Role.TEACHER
        ? staff.teacherProfile?.specialization || "Teaching & Academics"
        : staff.role === Role.FINANCE
        ? "Finance & Accounts"
        : staff.adminProfile?.department || "Administration & HR";

    const attendedDays = a.present_days + a.late_days;
    const punctualityScore =
      attendedDays > 0 ? Math.round((a.present_days / attendedDays) * 100) : 100;
    const attendanceScore =
      a.total_recorded_days > 0
        ? Math.round((attendedDays / a.total_recorded_days) * 100)
        : 100;

    // Determine flag risk level
    let riskLevel = "CLEAN"; // "CLEAN" | "AT_RISK" | "FLAGGED_FOR_PENALTY"
    if (a.late_days >= 3 || a.absent_days >= 2 || punctualityScore < 75) {
      riskLevel = "FLAGGED_FOR_PENALTY";
    } else if (a.late_days >= 1 || punctualityScore < 90) {
      riskLevel = "AT_RISK";
    }

    return {
      staffId: staff.id,
      staff,
      category,
      department,
      employeeId:
        staff.teacherProfile?.employeeId ||
        staff.adminProfile?.employeeId ||
        "—",
      totalRecordedDays: a.total_recorded_days,
      presentDays: a.present_days,
      lateDays: a.late_days,
      absentDays: a.absent_days,
      excusedDays: a.excused_days,
      totalLateMinutes: a.total_late_minutes,
      punctualityScore,
      attendanceScore,
      riskLevel,
      penaltiesCount: p.total_penalties,
      totalSalaryDeductions: p.total_deductions,
      totalDemerits: p.total_demerits,
    };
  });

  if (filters.role && filters.role !== "ALL") {
    staffAssessments = staffAssessments.filter((s) => s.staff.role === filters.role);
  } else if (filters.category && filters.category !== "ALL") {
    staffAssessments = staffAssessments.filter((s) => s.category === filters.category);
  }

  if (search) {
    const s = search.toLowerCase();
    staffAssessments = staffAssessments.filter((item) => {
      const fullName = `${item.staff.firstName || ""} ${item.staff.lastName || ""}`.toLowerCase();
      const email = (item.staff.email || "").toLowerCase();
      const empId = (item.employeeId || "").toLowerCase();
      const dept = (item.department || "").toLowerCase();
      return (
        fullName.includes(s) ||
        email.includes(s) ||
        empId.includes(s) ||
        dept.includes(s)
      );
    });
  }

  const totalLateArrivals = staffAssessments.reduce(
    (acc, s) => acc + s.lateDays,
    0,
  );
  const totalUnexcusedAbsences = staffAssessments.reduce(
    (acc, s) => acc + s.absentDays,
    0,
  );
  const totalLateMins = staffAssessments.reduce(
    (acc, s) => acc + s.totalLateMinutes,
    0,
  );
  const flaggedCount = staffAssessments.filter(
    (s) => s.riskLevel === "FLAGGED_FOR_PENALTY",
  ).length;

  return {
    dateRange: { startDate, endDate },
    totalStaff: staffUsers.length,
    overview: {
      totalLateArrivals,
      totalUnexcusedAbsences,
      totalLateMinutes: totalLateMins,
      flaggedForPenaltyCount: flaggedCount,
    },
    staffAssessments,
  };
}

/**
 * 5. Issue Penalty / Punishment to Staff Member
 */
export async function issueStaffPenalty(
  schoolId: string,
  issuedById: string,
  data: {
    staffId: string;
    type: PenaltyType;
    reason: string;
    amount?: number;
    currency?: string;
    demeritPoints?: number;
    actionNotes?: string;
    effectiveDate?: string;
  },
) {
  await ensureStaffAttendanceTables();

  const {
    staffId,
    type,
    reason,
    amount = 0,
    currency = "ETB",
    demeritPoints = 0,
    actionNotes = null,
    effectiveDate = new Date().toISOString(),
  } = data;

  const staff = await db.user.findUnique({
    where: { id: staffId },
    select: { id: true, firstName: true, lastName: true, schoolId: true },
  });
  if (!staff || staff.schoolId !== schoolId) {
    throw new AppError("Staff member not found", 404);
  }

  const result: any[] = await db.$queryRawUnsafe(
    `
    INSERT INTO staff_penalties (
      school_id, staff_id, issued_by_id, type, reason, amount, currency, demerit_points, status, effective_date, action_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPLIED', $9::timestamptz, $10)
    RETURNING *;
  `,
    schoolId,
    staffId,
    issuedById,
    type,
    reason,
    amount,
    currency,
    demeritPoints,
    effectiveDate,
    actionNotes,
  );

  const penalty = result[0];

  // Dispatch In-App Notification to Staff Member
  const penaltyLabel =
    type === "SALARY_DEDUCTION"
      ? `Salary Deduction (${amount} ${currency})`
      : type === "WARNING_LETTER"
      ? "Formal Warning Notice"
      : type === "SUSPENSION"
      ? "Suspension Notice"
      : type === "DEMERIT_SCORE"
      ? `Demerit Points (-${demeritPoints} pts)`
      : "Disciplinary Action";

  const notif = await db.notification.create({
    data: {
      schoolId,
      userId: staffId,
      type: NotificationType.GENERAL,
      title: `⚠️ Disciplinary Notice: ${penaltyLabel}`,
      body: `A disciplinary penalty has been applied due to: "${reason}". Amount: ${amount > 0 ? `${amount} ${currency}` : "N/A"}.`,
      data: {
        priority: "URGENT",
        penaltyId: penalty.id,
        penaltyType: type,
        amount,
        currency,
        link: "/attendance",
      },
    },
  });

  emitToUser(staffId, "notification:new", {
    id: notif.id,
    type: "BEHAVIOUR",
    priority: "URGENT",
    title: `⚠️ Disciplinary Notice: ${penaltyLabel}`,
    body: reason,
    link: "/attendance",
  });

  return penalty;
}

/**
 * 6. Get List of Staff Penalties
 */
export async function getStaffPenalties(
  schoolId: string,
  filters: { staffId?: string; status?: string } = {},
) {
  await ensureStaffAttendanceTables();

  let query = `
    SELECT
      p.*,
      u.first_name as staff_first_name,
      u.last_name as staff_last_name,
      u.email as staff_email,
      u.role as staff_role,
      u.avatar as staff_avatar,
      adm.first_name as issued_by_first_name,
      adm.last_name as issued_by_last_name
    FROM staff_penalties p
    JOIN users u ON p.staff_id = u.id
    JOIN users adm ON p.issued_by_id = adm.id
    WHERE p.school_id = $1
  `;
  const params: any[] = [schoolId];

  if (filters.staffId) {
    params.push(filters.staffId);
    query += ` AND p.staff_id = $${params.length}`;
  }

  if (filters.status && filters.status !== "ALL") {
    params.push(filters.status);
    query += ` AND p.status = $${params.length}`;
  }

  query += ` ORDER BY p.created_at DESC`;

  let penalties: any[] = [];
  try {
    penalties = await db.$queryRawUnsafe(query, ...params);
  } catch (e) {
    console.warn("Get penalties query warning:", e);
  }

  return penalties.map((p) => ({
    id: p.id,
    staffId: p.staff_id,
    staff: {
      firstName: p.staff_first_name,
      lastName: p.staff_last_name,
      email: p.staff_email,
      role: p.staff_role,
      avatar: p.staff_avatar,
    },
    issuedBy: {
      firstName: p.issued_by_first_name,
      lastName: p.issued_by_last_name,
    },
    type: p.type,
    reason: p.reason,
    amount: p.amount,
    currency: p.currency,
    demeritPoints: p.demerit_points,
    status: p.status,
    effectiveDate: p.effective_date,
    actionNotes: p.action_notes,
    resolvedAt: p.resolved_at,
    createdAt: p.created_at,
  }));
}

/**
 * 7. Update Penalty Status (Deduct from payroll, waive, resolve)
 */
export async function updateStaffPenaltyStatus(
  schoolId: string,
  penaltyId: string,
  status: PenaltyStatus,
  actionNotes?: string,
) {
  await ensureStaffAttendanceTables();

  const result: any[] = await db.$queryRawUnsafe(
    `
    UPDATE staff_penalties
    SET
      status = $1,
      action_notes = COALESCE($2, action_notes),
      resolved_at = CASE WHEN $1 IN ('WAIVED', 'RESOLVED', 'DEDUCTED_FROM_PAYROLL') THEN NOW() ELSE resolved_at END,
      updated_at = NOW()
    WHERE id = $3 AND school_id = $4
    RETURNING *;
  `,
    status,
    actionNotes || null,
    penaltyId,
    schoolId,
  );

  if (!result.length) {
    throw new AppError("Penalty record not found", 404);
  }

  return result[0];
}

/**
 * 8. Delete Penalty Record
 */
export async function deleteStaffPenalty(schoolId: string, penaltyId: string) {
  await ensureStaffAttendanceTables();

  const count = await db.$executeRawUnsafe(
    `DELETE FROM staff_penalties WHERE id = $1 AND school_id = $2`,
    penaltyId,
    schoolId,
  );

  if (!count) throw new AppError("Penalty record not found", 404);
  return { success: true };
}
