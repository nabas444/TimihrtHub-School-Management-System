import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { DayOfWeek } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess, sendCreated } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";

// ════════════════════════════════════════════════════════════
// SERVICE
// ════════════════════════════════════════════════════════════

const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

const getClassTimetable = async (classId: string, schoolId: string) => {
  const slots = await db.timetableSlot.findMany({
    where: { classId, class: { schoolId } },
    include: {
      class: { select: { id: true, name: true, academicYear: true } },
      subjectTeaching: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacherProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const grouped = ALL_DAYS.reduce<Record<string, typeof slots>>((acc, day) => {
    acc[day] = slots.filter((s) => s.dayOfWeek === day);
    return acc;
  }, {});

  return {
    grouped,
    slots,
  };
};

const getTeacherTimetable = async (teacherUserId: string, schoolId: string) => {
  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: teacherUserId },
  });
  if (!teacherProfile) {
    // If no teacher profile found (e.g. admin viewing self without teacher role), return empty
    const emptyGrouped = ALL_DAYS.reduce<Record<string, any[]>>((acc, day) => {
      acc[day] = [];
      return acc;
    }, {});
    return { grouped: emptyGrouped, slots: [] };
  }

  const slots = await db.timetableSlot.findMany({
    where: {
      subjectTeaching: { teacherProfileId: teacherProfile.id },
      class: { schoolId },
    },
    include: {
      class: { select: { id: true, name: true, academicYear: true } },
      subjectTeaching: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacherProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const grouped = ALL_DAYS.reduce<Record<string, typeof slots>>((acc, day) => {
    acc[day] = slots.filter((s) => s.dayOfWeek === day);
    return acc;
  }, {});

  return {
    grouped,
    slots,
  };
};

const listSchoolTeachers = async (schoolId: string) => {
  const teachers = await db.teacherProfile.findMany({
    where: { user: { schoolId, isActive: true } },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
      subjectTeachings: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { user: { firstName: "asc" } },
  });

  return teachers;
};

const getOrCreateSubjectTeaching = async (
  schoolId: string,
  classId: string,
  subjectId: string,
  teacherProfileId: string,
  academicYear: string,
) => {
  const cls = await db.class.findFirst({
    where: { id: classId, schoolId },
  });
  if (!cls) throw new AppError("Class not found in this school", 404);

  return db.subjectTeaching.upsert({
    where: {
      classId_subjectId_academicYear: {
        classId,
        subjectId,
        academicYear,
      },
    },
    update: { teacherProfileId },
    create: {
      classId,
      subjectId,
      teacherProfileId,
      academicYear,
    },
  });
};

const createSlot = async (
  schoolId: string,
  data: {
    classId: string;
    subjectTeachingId?: string;
    subjectId?: string;
    teacherProfileId?: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    room?: string;
    academicYear?: string;
  },
) => {
  const cls = await db.class.findFirst({
    where: { id: data.classId, schoolId },
  });
  if (!cls) throw new AppError("Class not found", 404);

  const academicYear = data.academicYear || cls.academicYear || "2024/2025";
  let subjectTeachingId = data.subjectTeachingId;

  if (!subjectTeachingId) {
    if (!data.subjectId) {
      throw new AppError("Subject is required to create a timetable slot", 400);
    }

    let teacherProfileId = data.teacherProfileId;
    if (!teacherProfileId) {
      // Find default teacher or first teacher
      const firstTeacher = await db.teacherProfile.findFirst({
        where: { user: { schoolId } },
      });
      if (!firstTeacher) {
        throw new AppError("A teacher profile is required to assign this slot", 400);
      }
      teacherProfileId = firstTeacher.id;
    }

    const st = await getOrCreateSubjectTeaching(
      schoolId,
      data.classId,
      data.subjectId,
      teacherProfileId,
      academicYear,
    );
    subjectTeachingId = st.id;
  }

  // Check for conflicts in same class + day + overlapping time
  const existing = await db.timetableSlot.findMany({
    where: {
      classId: data.classId,
      dayOfWeek: data.dayOfWeek,
      academicYear,
    },
  });

  for (const slot of existing) {
    if (slot.startTime < data.endTime && slot.endTime > data.startTime) {
      throw new AppError(
        `Time conflict: Existing period ${slot.startTime}–${slot.endTime} overlaps with ${data.startTime}–${data.endTime}`,
        409,
      );
    }
  }

  return db.timetableSlot.create({
    data: {
      classId: data.classId,
      subjectTeachingId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      room: data.room,
      academicYear,
    },
    include: {
      class: { select: { id: true, name: true } },
      subjectTeaching: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacherProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
};

const updateSlot = async (
  id: string,
  schoolId: string,
  data: {
    dayOfWeek?: DayOfWeek;
    startTime?: string;
    endTime?: string;
    room?: string;
    subjectId?: string;
    teacherProfileId?: string;
  },
) => {
  const slot = await db.timetableSlot.findFirst({
    where: { id, class: { schoolId } },
    include: { subjectTeaching: true, class: true },
  });
  if (!slot) throw new AppError("Slot not found", 404);

  let subjectTeachingId = slot.subjectTeachingId;
  const academicYear = slot.academicYear || slot.class.academicYear;

  if (data.subjectId || data.teacherProfileId) {
    const targetSubjectId = data.subjectId || slot.subjectTeaching.subjectId;
    const targetTeacherId =
      data.teacherProfileId || slot.subjectTeaching.teacherProfileId;

    const st = await getOrCreateSubjectTeaching(
      schoolId,
      slot.classId,
      targetSubjectId,
      targetTeacherId,
      academicYear,
    );
    subjectTeachingId = st.id;
  }

  const newDay = data.dayOfWeek || slot.dayOfWeek;
  const newStart = data.startTime || slot.startTime;
  const newEnd = data.endTime || slot.endTime;

  // Conflict check if time or day changed
  if (data.startTime || data.endTime || data.dayOfWeek) {
    const existing = await db.timetableSlot.findMany({
      where: {
        classId: slot.classId,
        dayOfWeek: newDay,
        academicYear,
        NOT: { id: slot.id },
      },
    });

    for (const s of existing) {
      if (s.startTime < newEnd && s.endTime > newStart) {
        throw new AppError(
          `Time conflict: Existing period ${s.startTime}–${s.endTime} overlaps with ${newStart}–${newEnd}`,
          409,
        );
      }
    }
  }

  return db.timetableSlot.update({
    where: { id },
    data: {
      subjectTeachingId,
      dayOfWeek: newDay,
      startTime: newStart,
      endTime: newEnd,
      room: data.room !== undefined ? data.room : slot.room,
    },
    include: {
      class: { select: { id: true, name: true } },
      subjectTeaching: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacherProfile: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
};

const deleteSlot = async (id: string, schoolId: string) => {
  const slot = await db.timetableSlot.findFirst({
    where: { id, class: { schoolId } },
  });
  if (!slot) throw new AppError("Slot not found", 404);
  await db.timetableSlot.delete({ where: { id } });
};

const clearClassTimetable = async (classId: string, schoolId: string) => {
  const cls = await db.class.findFirst({
    where: { id: classId, schoolId },
  });
  if (!cls) throw new AppError("Class not found", 404);

  const deleted = await db.timetableSlot.deleteMany({
    where: { classId },
  });

  return { count: deleted.count };
};

// ════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════
const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

// ── Teacher list for assignment ──────────────────────────────
router.get(
  "/teachers",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await listSchoolTeachers(req.user.schoolId));
    } catch (e) {
      next(e);
    }
  },
);

// ── Class Timetable ──────────────────────────────────────────
router.get(
  "/class/:classId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await getClassTimetable(req.params.classId, req.user.schoolId),
      );
    } catch (e) {
      next(e);
    }
  },
);

// ── Teacher Timetable (Own) ──────────────────────────────────
router.get(
  "/teacher",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await getTeacherTimetable(req.user.id, req.user.schoolId),
      );
    } catch (e) {
      next(e);
    }
  },
);

// ── Teacher Timetable by Teacher User ID ─────────────────────
router.get(
  "/teacher/:teacherId",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await getTeacherTimetable(req.params.teacherId, req.user.schoolId),
      );
    } catch (e) {
      next(e);
    }
  },
);

// ── Create Timetable Slot ────────────────────────────────────
router.post(
  "/slots",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          classId: z.string(),
          subjectTeachingId: z.string().optional(),
          subjectId: z.string().optional(),
          teacherProfileId: z.string().optional(),
          dayOfWeek: z.nativeEnum(DayOfWeek),
          startTime: z.string(),
          endTime: z.string(),
          room: z.string().optional(),
          academicYear: z.string().optional(),
        })
        .parse(req.body);
      sendCreated(res, await createSlot(req.user.schoolId, data));
    } catch (e) {
      next(e);
    }
  },
);

// ── Update Timetable Slot ────────────────────────────────────
router.patch(
  "/slots/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          dayOfWeek: z.nativeEnum(DayOfWeek).optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          room: z.string().optional(),
          subjectId: z.string().optional(),
          teacherProfileId: z.string().optional(),
        })
        .parse(req.body);
      sendSuccess(
        res,
        await updateSlot(req.params.id, req.user.schoolId, data),
        "Slot updated",
      );
    } catch (e) {
      next(e);
    }
  },
);

// ── Delete Timetable Slot ────────────────────────────────────
router.delete(
  "/slots/:id",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteSlot(req.params.id, req.user.schoolId);
      sendSuccess(res, null, "Deleted");
    } catch (e) {
      next(e);
    }
  },
);

// ── Clear All Slots for a Class ──────────────────────────────
router.delete(
  "/class/:classId/clear",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await clearClassTimetable(req.params.classId, req.user.schoolId),
        "Class timetable cleared",
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;

