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

const getClassTimetable = async (classId: string, schoolId: string) => {
  const slots = await db.timetableSlot.findMany({
    where: { classId, class: { schoolId } },
    include: {
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
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  // Group by day
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  return days.reduce<Record<string, typeof slots>>((acc, day) => {
    acc[day] = slots.filter((s) => s.dayOfWeek === day);
    return acc;
  }, {});
};

const getTeacherTimetable = async (teacherUserId: string, schoolId: string) => {
  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: teacherUserId },
  });
  if (!teacherProfile) throw new AppError("Teacher profile not found", 404);

  const slots = await db.timetableSlot.findMany({
    where: {
      subjectTeaching: { teacherProfileId: teacherProfile.id },
      class: { schoolId },
    },
    include: {
      class: { select: { id: true, name: true } },
      subjectTeaching: {
        include: { subject: { select: { name: true, code: true } } },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  return days.reduce<Record<string, typeof slots>>((acc, day) => {
    acc[day] = slots.filter((s) => s.dayOfWeek === day);
    return acc;
  }, {});
};

const createSlot = async (
  schoolId: string,
  data: {
    classId: string;
    subjectTeachingId: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    room?: string;
    academicYear: string;
  },
) => {
  // Check for conflicts in same class + day + overlapping time
  const existing = await db.timetableSlot.findMany({
    where: {
      classId: data.classId,
      dayOfWeek: data.dayOfWeek,
      academicYear: data.academicYear,
    },
  });

  for (const slot of existing) {
    if (slot.startTime < data.endTime && slot.endTime > data.startTime) {
      throw new AppError(
        `Time conflict detected: existing slot ${slot.startTime}-${slot.endTime}`,
        409,
      );
    }
  }

  return db.timetableSlot.create({
    data,
    include: { subjectTeaching: { include: { subject: true } } },
  });
};

const deleteSlot = async (id: string, schoolId: string) => {
  const slot = await db.timetableSlot.findFirst({
    where: { id, class: { schoolId } },
  });
  if (!slot) throw new AppError("Slot not found", 404);
  await db.timetableSlot.delete({ where: { id } });
};

const assignSubjectTeaching = async (
  schoolId: string,
  data: {
    classId: string;
    subjectId: string;
    teacherProfileId: string;
    academicYear: string;
  },
) => {
  const cls = await db.class.findFirst({
    where: { id: data.classId, schoolId },
  });
  if (!cls) throw new AppError("Class not found", 404);
  return db.subjectTeaching.upsert({
    where: {
      classId_subjectId_academicYear: {
        classId: data.classId,
        subjectId: data.subjectId,
        academicYear: data.academicYear,
      },
    },
    update: { teacherProfileId: data.teacherProfileId },
    create: data,
    include: {
      subject: { select: { name: true } },
      teacherProfile: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });
};

// ════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════
const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

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

router.get(
  "/teacher/:teacherId",
  authorize(...isAdmin),
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

router.post(
  "/slots",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          classId: z.string(),
          subjectTeachingId: z.string(),
          dayOfWeek: z.nativeEnum(DayOfWeek),
          startTime: z.string(),
          endTime: z.string(),
          room: z.string().optional(),
          academicYear: z.string(),
        })
        .parse(req.body);
      sendCreated(res, await createSlot(req.user.schoolId, data));
    } catch (e) {
      next(e);
    }
  },
);

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

router.post(
  "/assign-teaching",
  authorize(...isAdmin),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          classId: z.string(),
          subjectId: z.string(),
          teacherProfileId: z.string(),
          academicYear: z.string(),
        })
        .parse(req.body);
      sendCreated(
        res,
        await assignSubjectTeaching(req.user.schoolId, data),
        "Teaching assigned",
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
