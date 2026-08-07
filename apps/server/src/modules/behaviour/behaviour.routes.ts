import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { BehaviourType, BehaviourSeverity } from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToUser } from "../../config/socket";
import { sendSuccess, sendCreated, paginationMeta } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";

// ════════════════════════════════════════════════════════════
// SERVICE
// ════════════════════════════════════════════════════════════

const listRecords = async (
  schoolId: string,
  params: {
    studentId?: string;
    type?: BehaviourType;
    page: number;
    limit: number;
  },
) => {
  const { page, limit, studentId, type } = params;
  const skip = (page - 1) * limit;
  const where = {
    schoolId,
    ...(studentId && { studentId }),
    ...(type && { type }),
  };

  const [records, total] = await Promise.all([
    db.behaviourRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: "desc" },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.behaviourRecord.count({ where }),
  ]);

  return { records, total };
};

const createRecord = async (
  schoolId: string,
  reportedById: string,
  data: {
    studentId: string;
    type: BehaviourType;
    severity: BehaviourSeverity;
    title: string;
    description: string;
    actionTaken?: string;
    points?: number;
    date: Date;
    attachments?: string[];
  },
) => {
  const record = await db.behaviourRecord.create({
    data: { schoolId, reportedById, ...data, parentNotified: false },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      reportedBy: { select: { firstName: true, lastName: true } },
    },
  });

  // Always notify student
  emitToUser(data.studentId, "notification:new", {
    type: "BEHAVIOUR",
    title: data.type === "MERIT" ? "🏅 Merit Awarded" : "⚠️ Behaviour Record",
    body: data.title,
  });

  // Notify parents for demerits and incidents
  if (data.type !== "MERIT" && data.type !== "COMMENDATION") {
    const parentLinks = await db.parentStudentLink.findMany({
      where: { studentProfile: { userId: data.studentId } },
      include: { parentProfile: { include: { user: true } } },
    });

    await db.notification.createMany({
      data: parentLinks.map((link) => ({
        schoolId,
        userId: link.parentProfile.user.id,
        type: "BEHAVIOUR" as const,
        title: `Behaviour Notice: ${record.student.firstName}`,
        body: `${data.type} — ${data.title}`,
      })),
    });

    parentLinks.forEach((link) => {
      emitToUser(link.parentProfile.user.id, "notification:new", {
        type: "BEHAVIOUR",
        title: `Behaviour Notice: ${record.student.firstName}`,
        body: data.title,
      });
    });

    await db.behaviourRecord.update({
      where: { id: record.id },
      data: { parentNotified: true },
    });
  }

  return record;
};

const resolveRecord = async (
  id: string,
  schoolId: string,
  actionTaken: string,
) => {
  const record = await db.behaviourRecord.findFirst({
    where: { id, schoolId },
  });
  if (!record) throw new AppError("Record not found", 404);
  return db.behaviourRecord.update({
    where: { id },
    data: { isResolved: true, actionTaken },
  });
};

const getStudentBehaviourSummary = async (
  studentId: string,
  schoolId: string,
) => {
  const [merits, demerits, incidents, recent] = await Promise.all([
    db.behaviourRecord.count({
      where: { schoolId, studentId, type: { in: ["MERIT", "COMMENDATION"] } },
    }),
    db.behaviourRecord.count({
      where: { schoolId, studentId, type: { in: ["DEMERIT", "WARNING"] } },
    }),
    db.behaviourRecord.count({
      where: { schoolId, studentId, type: "INCIDENT" },
    }),
    db.behaviourRecord.findMany({
      where: { schoolId, studentId },
      orderBy: { date: "desc" },
      take: 10,
      include: { reportedBy: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const totalPoints = await db.behaviourRecord.aggregate({
    where: { schoolId, studentId },
    _sum: { points: true },
  });

  return {
    merits,
    demerits,
    incidents,
    totalPoints: totalPoints._sum.points ?? 0,
    recent,
  };
};

// ════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════
const router = Router();
const isStaff: Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

router.get(
  "/",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const { studentId, type } = req.query as Record<string, string>;
      const { records, total } = await listRecords(req.user.schoolId, {
        studentId,
        type: type as BehaviourType,
        page,
        limit,
      });
      sendSuccess(res, records, "OK", 200, paginationMeta(total, page, limit));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          studentId: z.string(),
          type: z.nativeEnum(BehaviourType),
          severity: z.nativeEnum(BehaviourSeverity).default("LOW"),
          title: z.string(),
          description: z.string(),
          actionTaken: z.string().optional(),
          points: z.number().default(0),
          date: z.string().datetime(),
          attachments: z.array(z.string()).optional(),
        })
        .parse(req.body);
      sendCreated(
        res,
        await createRecord(req.user.schoolId, req.user.id, {
          ...data,
          date: new Date(data.date),
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

// Extracted as a pure function (session-6 hardening) so the IDOR fix from
// Section 4.4 has a unit test that doesn't need Express/Prisma to run —
// same three conditions as before, just named and testable in isolation.
export const canViewBehaviourSummary = (
  requester: { id: string; role: Role },
  studentId: string,
  isLinkedParent: boolean,
): boolean => {
  const isStaffUser = isStaff.includes(requester.role);
  const isSelf = requester.role === Role.STUDENT && requester.id === studentId;
  return isStaffUser || isSelf || isLinkedParent;
};

router.get(
  "/student/:studentId/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      const isStaffUser = isStaff.includes(req.user.role);
      const isSelf =
        req.user.role === Role.STUDENT && req.user.id === studentId;
      let isLinkedParent = false;

      if (!isStaffUser && !isSelf && req.user.role === Role.PARENT) {
        const link = await db.parentStudentLink.findFirst({
          where: {
            studentProfile: { userId: studentId },
            parentProfile: { userId: req.user.id },
          },
        });
        isLinkedParent = !!link;
      }

      if (!canViewBehaviourSummary(req.user, studentId, isLinkedParent)) {
        throw new AppError(
          "Not authorized to view this student's behaviour record",
          403,
        );
      }

      sendSuccess(
        res,
        await getStudentBehaviourSummary(studentId, req.user.schoolId),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/resolve",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actionTaken } = z
        .object({ actionTaken: z.string() })
        .parse(req.body);
      sendSuccess(
        res,
        await resolveRecord(req.params.id, req.user.schoolId, actionTaken),
        "Resolved",
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
