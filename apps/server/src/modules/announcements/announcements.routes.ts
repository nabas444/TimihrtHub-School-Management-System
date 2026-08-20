import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  AnnouncementTarget,
  AnnouncementPriority,
  Role,
} from "@prisma/client";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { emitToSchool } from "../../config/socket";
import {
  sendSuccess,
  sendCreated,
  paginationMeta,
} from "../../utils/response";
import { authorize } from "../../middleware/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Service: List Announcements
// ─────────────────────────────────────────────────────────────────────────────
const listAnnouncements = async (
  schoolId: string,
  userId: string,
  role: Role,
  params: {
    page: number;
    limit: number;
    priority?: string;
    target?: string;
    gradeLevelId?: string;
    classId?: string;
    search?: string;
  },
) => {
  const { page, limit, priority, target, gradeLevelId, classId, search } =
    params;
  const skip = (page - 1) * limit;
  const now = new Date();

  const where: any = { schoolId };

  // Filter out unpublished or expired for non-admins
  const isSchoolAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
  if (!isSchoolAdmin) {
    where.publishedAt = { lte: now };
    where.OR = [{ expiresAt: null }, { expiresAt: { gte: now } }];
  }

  // Priority filter
  if (
    priority &&
    Object.values(AnnouncementPriority).includes(priority as any)
  ) {
    where.priority = priority as AnnouncementPriority;
  }

  // Target filter
  if (target && Object.values(AnnouncementTarget).includes(target as any)) {
    where.target = target as AnnouncementTarget;
  }

  // Grade level filter
  if (gradeLevelId) {
    where.gradeLevelId = gradeLevelId;
  }

  // Class filter
  if (classId) {
    where.OR = [
      { classId },
      { classIds: { has: classId } },
    ];
  }

  // Search filter
  if (search) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
        ],
      },
    ];
  }

  // Role-specific scoping
  if (role === Role.STUDENT) {
    const student = await db.studentProfile.findUnique({
      where: { userId },
      select: { classId: true, gradeLevelId: true },
    });

    const targetConditions: any[] = [
      { target: { in: [AnnouncementTarget.ALL, AnnouncementTarget.STUDENTS] } },
    ];

    if (student?.classId) {
      targetConditions.push({
        target: AnnouncementTarget.CLASS,
        OR: [
          { classId: student.classId },
          { classIds: { has: student.classId } },
        ],
      });
    }
    if (student?.gradeLevelId) {
      targetConditions.push({
        gradeLevelId: student.gradeLevelId,
      });
    }

    where.AND = [...(where.AND || []), { OR: targetConditions }];
  } else if (role === Role.PARENT) {
    const parent = await db.parentProfile.findUnique({
      where: { userId },
      include: {
        studentLinks: {
          include: {
            studentProfile: { select: { classId: true, gradeLevelId: true } },
          },
        },
      },
    });

    const studentClassIds = (parent?.studentLinks || [])
      .map((s) => s.studentProfile.classId)
      .filter((id): id is string => Boolean(id));

    const studentGradeIds = (parent?.studentLinks || [])
      .map((s) => s.studentProfile.gradeLevelId)
      .filter((id): id is string => Boolean(id));

    const targetConditions: any[] = [
      { target: { in: [AnnouncementTarget.ALL, AnnouncementTarget.PARENTS] } },
    ];

    if (studentClassIds.length > 0) {
      targetConditions.push({
        target: AnnouncementTarget.CLASS,
        OR: [
          { classId: { in: studentClassIds } },
          { classIds: { hasSome: studentClassIds } },
        ],
      });
    }

    if (studentGradeIds.length > 0) {
      targetConditions.push({
        gradeLevelId: { in: studentGradeIds },
      });
    }

    where.AND = [...(where.AND || []), { OR: targetConditions }];
  } else if (role === Role.TEACHER) {
    const targetConditions: any[] = [
      { target: { in: [AnnouncementTarget.ALL, AnnouncementTarget.TEACHERS] } },
      { authorId: userId },
    ];

    where.AND = [...(where.AND || []), { OR: targetConditions }];
  }

  const [announcements, total] = await Promise.all([
    db.announcement.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            avatar: true,
            role: true,
          },
        },
        class: { select: { id: true, name: true } },
        gradeLevel: { select: { id: true, name: true } },
      },
    }),
    db.announcement.count({ where }),
  ]);

  return { announcements, total };
};

// ─────────────────────────────────────────────────────────────────────────────
// Service: Create Announcement
// ─────────────────────────────────────────────────────────────────────────────
const createAnnouncement = async (
  schoolId: string,
  authorId: string,
  data: {
    title: string;
    content: string;
    target: AnnouncementTarget;
    priority?: AnnouncementPriority;
    classId?: string;
    classIds?: string[];
    gradeLevelId?: string;
    isPinned?: boolean;
    attachments?: string[];
    publishedAt?: Date;
    expiresAt?: Date;
  },
) => {
  const normalizedClassIds = data.classIds || (data.classId ? [data.classId] : []);
  const primaryClassId = data.classId || (normalizedClassIds.length > 0 ? normalizedClassIds[0] : null);

  const announcement = await db.announcement.create({
    data: {
      schoolId,
      authorId,
      title: data.title,
      content: data.content,
      target: data.target,
      priority: data.priority || AnnouncementPriority.NORMAL,
      classId: primaryClassId,
      classIds: normalizedClassIds,
      gradeLevelId: data.gradeLevelId || null,
      isPinned: data.isPinned ?? false,
      attachments: data.attachments || [],
      publishedAt: data.publishedAt || new Date(),
      expiresAt: data.expiresAt || null,
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          avatar: true,
          role: true,
        },
      },
      class: { select: { id: true, name: true } },
      gradeLevel: { select: { id: true, name: true } },
    },
  });

  // Broadcast via Socket.IO to the school room
  emitToSchool(schoolId, "announcement:new", announcement);

  return announcement;
};

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────
const router = Router();
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const { priority, target, gradeLevelId, classId, search } = req.query;

    const { announcements, total } = await listAnnouncements(
      req.user.schoolId,
      req.user.id,
      req.user.role as Role,
      {
        page,
        limit,
        priority: priority as string,
        target: target as string,
        gradeLevelId: gradeLevelId as string,
        classId: classId as string,
        search: search as string,
      },
    );

    sendSuccess(
      res,
      announcements,
      "OK",
      200,
      paginationMeta(total, page, limit),
    );
  } catch (e) {
    next(e);
  }
});

router.post(
  "/",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = z
        .object({
          title: z.string().min(1, "Title is required"),
          content: z.string().min(1, "Message content is required"),
          target: z.nativeEnum(AnnouncementTarget).default(AnnouncementTarget.ALL),
          priority: z.nativeEnum(AnnouncementPriority).default(AnnouncementPriority.NORMAL),
          classId: z.string().optional(),
          classIds: z.array(z.string()).optional(),
          gradeLevelId: z.string().optional(),
          isPinned: z.boolean().optional(),
          attachments: z.array(z.string()).optional(),
          publishedAt: z.string().datetime().optional(),
          expiresAt: z.string().datetime().optional(),
        })
        .parse(req.body);

      const result = await createAnnouncement(req.user.schoolId, req.user.id, {
        ...data,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      });

      sendCreated(res, result);
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const role = req.user.role;

      const existing = await db.announcement.findFirst({
        where: { id, schoolId },
      });
      if (!existing) throw new AppError("Announcement not found", 404);

      if (role !== Role.ADMIN && role !== Role.SUPER_ADMIN && existing.authorId !== userId) {
        throw new AppError("You can only edit your own announcements", 403);
      }

      const data = z
        .object({
          title: z.string().min(1).optional(),
          content: z.string().min(1).optional(),
          target: z.nativeEnum(AnnouncementTarget).optional(),
          priority: z.nativeEnum(AnnouncementPriority).optional(),
          classId: z.string().optional(),
          classIds: z.array(z.string()).optional(),
          gradeLevelId: z.string().optional(),
          isPinned: z.boolean().optional(),
          attachments: z.array(z.string()).optional(),
          publishedAt: z.string().datetime().optional(),
          expiresAt: z.string().datetime().optional(),
        })
        .parse(req.body);

      const updated = await db.announcement.update({
        where: { id },
        data: {
          title: data.title !== undefined ? data.title : existing.title,
          content: data.content !== undefined ? data.content : existing.content,
          target: data.target !== undefined ? data.target : existing.target,
          priority: data.priority !== undefined ? data.priority : existing.priority,
          classId: data.classId !== undefined ? data.classId : existing.classId,
          classIds: data.classIds !== undefined ? data.classIds : existing.classIds,
          gradeLevelId: data.gradeLevelId !== undefined ? data.gradeLevelId : existing.gradeLevelId,
          isPinned: data.isPinned !== undefined ? data.isPinned : existing.isPinned,
          attachments: data.attachments !== undefined ? data.attachments : existing.attachments,
          publishedAt: data.publishedAt ? new Date(data.publishedAt) : existing.publishedAt,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : existing.expiresAt,
        },
        include: {
          author: true,
          class: true,
          gradeLevel: true,
        },
      });

      sendSuccess(res, updated, "Announcement updated successfully");
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/:id",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const role = req.user.role;

      const existing = await db.announcement.findFirst({
        where: { id, schoolId },
      });
      if (!existing) throw new AppError("Announcement not found", 404);

      if (role !== Role.ADMIN && role !== Role.SUPER_ADMIN && existing.authorId !== userId) {
        throw new AppError("You can only delete your own announcements", 403);
      }

      await db.announcement.delete({ where: { id } });
      sendSuccess(res, null, "Announcement deleted");
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/:id/pin",
  authorize(...isStaff),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const a = await db.announcement.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
      });
      if (!a) throw new AppError("Announcement not found", 404);

      const updated = await db.announcement.update({
        where: { id: req.params.id },
        data: { isPinned: !a.isPinned },
      });

      sendSuccess(res, updated, updated.isPinned ? "Pinned" : "Unpinned");
    } catch (e) {
      next(e);
    }
  },
);

export default router;
