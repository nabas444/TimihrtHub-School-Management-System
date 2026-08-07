import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AnnouncementTarget } from '@prisma/client';
import { db } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { emitToSchool, emitToUser } from '../../config/socket';
import { sendSuccess, sendCreated, paginationMeta } from '../../utils/response';
import { authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

// ── Service ───────────────────────────────────────────────────────────────────
const listAnnouncements = async (schoolId: string, userId: string, role: Role, params: { page: number; limit: number }) => {
  const { page, limit } = params;
  const skip = (page - 1) * limit;
  const now = new Date();

  // Students only see announcements targeted to them/all
  const targetFilter =
    role === Role.STUDENT ? { target: { in: ['ALL', 'STUDENTS'] as AnnouncementTarget[] } }
    : role === Role.PARENT ? { target: { in: ['ALL', 'PARENTS'] as AnnouncementTarget[] } }
    : role === Role.TEACHER ? { target: { in: ['ALL', 'TEACHERS'] as AnnouncementTarget[] } }
    : {};

  const where = {
    schoolId,
    ...targetFilter,
    publishedAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
  };

  const [announcements, total] = await Promise.all([
    db.announcement.findMany({
      where, skip, take: limit,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true, role: true } } },
    }),
    db.announcement.count({ where }),
  ]);

  return { announcements, total };
};

const createAnnouncement = async (
  schoolId: string, authorId: string,
  data: { title: string; content: string; target: AnnouncementTarget; classId?: string; isPinned?: boolean; attachments?: string[]; expiresAt?: Date },
) => {
  const announcement = await db.announcement.create({
    data: { schoolId, authorId, ...data, publishedAt: new Date() },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Broadcast via Socket.IO to the school room
  emitToSchool(schoolId, 'announcement:new', announcement);

  return announcement;
};

const deleteAnnouncement = async (id: string, schoolId: string) => {
  const a = await db.announcement.findFirst({ where: { id, schoolId } });
  if (!a) throw new AppError('Announcement not found', 404);
  await db.announcement.delete({ where: { id } });
};

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const { announcements, total } = await listAnnouncements(req.user.schoolId, req.user.id, req.user.role as Role, { page, limit });
    sendSuccess(res, announcements, 'OK', 200, paginationMeta(total, page, limit));
  } catch (e) { next(e); }
});

router.post('/', authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      title: z.string().min(1), content: z.string().min(1),
      target: z.nativeEnum(AnnouncementTarget).default('ALL'),
      classId: z.string().optional(), isPinned: z.boolean().optional(),
      attachments: z.array(z.string()).optional(), expiresAt: z.string().datetime().optional(),
    }).parse(req.body);
    sendCreated(res, await createAnnouncement(req.user.schoolId, req.user.id, { ...data, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined }));
  } catch (e) { next(e); }
});

router.delete('/:id', authorize(...isStaff), async (req: Request, res: Response, next: NextFunction) => {
  try { await deleteAnnouncement(req.params.id, req.user.schoolId); sendSuccess(res, null, 'Deleted'); } catch (e) { next(e); }
});

router.patch('/:id/pin', authorize(Role.ADMIN, Role.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await db.announcement.findFirst({ where: { id: req.params.id, schoolId: req.user.schoolId } });
    if (!a) throw new AppError('Not found', 404);
    const updated = await db.announcement.update({ where: { id: req.params.id }, data: { isPinned: !a.isPinned } });
    sendSuccess(res, updated, updated.isPinned ? 'Pinned' : 'Unpinned');
  } catch (e) { next(e); }
});

export default router;
