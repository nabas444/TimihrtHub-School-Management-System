import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MeetingStatus } from '@prisma/client';
import { db } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { emitToUser } from '../../config/socket';
import { sendSuccess, sendCreated, paginationMeta } from '../../utils/response';
import { authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

// ── Service ───────────────────────────────────────────────────────────────────
const listMeetings = async (userId: string, role: Role, schoolId: string, params: { page: number; limit: number; status?: MeetingStatus }) => {
  const { page, limit, status } = params;
  const skip = (page - 1) * limit;

  const where = {
    schoolId,
    ...(status && { status }),
    ...(role === Role.TEACHER ? { teacherId: userId }
      : role === Role.PARENT ? { parentId: userId }
      : {}),
  };

  const [meetings, total] = await Promise.all([
    db.meeting.findMany({
      where, skip, take: limit,
      orderBy: { scheduledAt: 'desc' },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        parent: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    }),
    db.meeting.count({ where }),
  ]);

  return { meetings, total };
};

const requestMeeting = async (
  parentId: string, schoolId: string,
  data: { teacherId: string; studentId?: string; title: string; agenda?: string; scheduledAt: Date; duration?: number; location?: string; meetingLink?: string },
) => {
  const teacher = await db.user.findFirst({ where: { id: data.teacherId, schoolId, role: Role.TEACHER } });
  if (!teacher) throw new AppError('Teacher not found', 404);

  const meeting = await db.meeting.create({
    data: { schoolId, parentId, ...data, status: MeetingStatus.PENDING },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      parent: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Notify teacher
  emitToUser(data.teacherId, 'notification:new', {
    type: 'MEETING', title: 'Meeting Request',
    body: `${meeting.parent.firstName} ${meeting.parent.lastName} requested a meeting on ${data.scheduledAt.toLocaleDateString()}`,
  });

  await db.notification.create({
    data: { schoolId, userId: data.teacherId, type: 'MEETING', title: 'Meeting Request', body: `${meeting.title} — ${data.scheduledAt.toLocaleDateString()}` },
  });

  return meeting;
};

const updateMeetingStatus = async (id: string, userId: string, schoolId: string, status: MeetingStatus, notes?: string) => {
  const meeting = await db.meeting.findFirst({
    where: { id, schoolId, OR: [{ teacherId: userId }, { parentId: userId }] },
  });
  if (!meeting) throw new AppError('Meeting not found', 404);

  const updated = await db.meeting.update({ where: { id }, data: { status, ...(notes && { notes }) } });

  // Notify the other party
  const notifyUserId = userId === meeting.teacherId ? meeting.parentId : meeting.teacherId;
  const statusText = status === 'CONFIRMED' ? 'confirmed' : status === 'CANCELLED' ? 'cancelled' : 'updated';
  emitToUser(notifyUserId, 'notification:new', {
    type: 'MEETING', title: `Meeting ${statusText}`, body: `${meeting.title} has been ${statusText}`,
  });

  return updated;
};

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();
const isStaff = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER];

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const status = req.query.status as MeetingStatus | undefined;
    const { meetings, total } = await listMeetings(req.user.id, req.user.role as Role, req.user.schoolId, { page, limit, status });
    sendSuccess(res, meetings, 'OK', 200, paginationMeta(total, page, limit));
  } catch (e) { next(e); }
});

router.post('/', authorize(Role.PARENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      teacherId: z.string(), studentId: z.string().optional(),
      title: z.string(), agenda: z.string().optional(),
      scheduledAt: z.string().datetime(), duration: z.number().optional(),
      location: z.string().optional(), meetingLink: z.string().url().optional(),
    }).parse(req.body);
    sendCreated(res, await requestMeeting(req.user.id, req.user.schoolId, { ...data, scheduledAt: new Date(data.scheduledAt) }));
  } catch (e) { next(e); }
});

router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, notes } = z.object({ status: z.nativeEnum(MeetingStatus), notes: z.string().optional() }).parse(req.body);
    sendSuccess(res, await updateMeetingStatus(req.params.id, req.user.id, req.user.schoolId, status, notes), 'Status updated');
  } catch (e) { next(e); }
});

export default router;
