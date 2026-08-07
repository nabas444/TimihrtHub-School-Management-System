import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RoomType } from '@prisma/client';
import { db } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess, sendCreated, paginationMeta } from '../../utils/response';
import { authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

// ── Service helpers ───────────────────────────────────────────────────────────
const getUserRooms = async (userId: string, schoolId: string) => {
  const memberships = await db.chatRoomMember.findMany({
    where: { userId, leftAt: null, room: { schoolId } },
    include: {
      room: {
        include: {
          members: {
            where: { userId: { not: userId }, leftAt: null },
            include: { room: false },
            take: 3,
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { room: { updatedAt: 'desc' } },
  });

  // Attach unread counts
  return Promise.all(
    memberships.map(async (m) => {
      const unread = await db.message.count({
        where: {
          roomId: m.roomId,
          createdAt: { gt: m.lastReadAt ?? new Date(0) },
          senderId: { not: userId },
          isDeleted: false,
        },
      });
      return { ...m, unread };
    }),
  );
};

const createDirectRoom = async (schoolId: string, userAId: string, userBId: string) => {
  // Check both users are in same school
  const userB = await db.user.findFirst({ where: { id: userBId, schoolId } });
  if (!userB) throw new AppError('User not found in this school', 404);

  // Check if DM already exists
  const existing = await db.chatRoom.findFirst({
    where: {
      schoolId, type: RoomType.DIRECT,
      members: { some: { userId: userAId, leftAt: null } },
      AND: [{ members: { some: { userId: userBId, leftAt: null } } }],
    },
    include: { members: true },
  });

  if (existing) return existing;

  return db.chatRoom.create({
    data: {
      schoolId, type: RoomType.DIRECT,
      members: {
        create: [{ userId: userAId }, { userId: userBId }],
      },
    },
    include: { members: true },
  });
};

const createGroupRoom = async (schoolId: string, creatorId: string, data: { name: string; memberIds: string[] }) => {
  const allMemberIds = [...new Set([creatorId, ...data.memberIds])];
  return db.chatRoom.create({
    data: {
      schoolId, type: RoomType.GROUP, name: data.name,
      members: { create: allMemberIds.map((id) => ({ userId: id, isAdmin: id === creatorId })) },
    },
    include: { members: true },
  });
};

const getMessages = async (roomId: string, userId: string, schoolId: string, params: { page: number; limit: number }) => {
  // Verify membership
  const member = await db.chatRoomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
  if (!member || member.leftAt) throw new AppError('Not a member of this room', 403);

  const { page, limit } = params;
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    db.message.findMany({
      where: { roomId, isDeleted: false },
      skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatar: true, role: true } },
        replyTo: { select: { id: true, content: true, sender: { select: { firstName: true, lastName: true } } } },
        reactions: true,
      },
    }),
    db.message.count({ where: { roomId, isDeleted: false } }),
  ]);

  // Mark as read
  await db.chatRoomMember.update({ where: { roomId_userId: { roomId, userId } }, data: { lastReadAt: new Date() } });

  return { messages: messages.reverse(), total };
};

const addMemberToRoom = async (roomId: string, userId: string, newMemberId: string, schoolId: string) => {
  const room = await db.chatRoom.findFirst({ where: { id: roomId, schoolId, type: RoomType.GROUP } });
  if (!room) throw new AppError('Group room not found', 404);

  const isAdmin = await db.chatRoomMember.findFirst({ where: { roomId, userId, isAdmin: true, leftAt: null } });
  if (!isAdmin) throw new AppError('Only room admins can add members', 403);

  return db.chatRoomMember.upsert({
    where: { roomId_userId: { roomId, userId: newMemberId } },
    update: { leftAt: null },
    create: { roomId, userId: newMemberId },
  });
};

const leaveRoom = async (roomId: string, userId: string) => {
  await db.chatRoomMember.update({
    where: { roomId_userId: { roomId, userId } },
    data: { leftAt: new Date() },
  });
};

const deleteMessage = async (messageId: string, userId: string, schoolId: string) => {
  const msg = await db.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new AppError('Message not found', 404);
  if (msg.senderId !== userId) throw new AppError('Cannot delete another user\'s message', 403);
  return db.message.update({ where: { id: messageId }, data: { isDeleted: true, content: null } });
};

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();

// Rooms
router.get('/rooms', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getUserRooms(req.user.id, req.user.schoolId)); } catch (e) { next(e); }
});

router.post('/rooms/direct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    sendCreated(res, await createDirectRoom(req.user.schoolId, req.user.id, userId));
  } catch (e) { next(e); }
});

router.post('/rooms/group', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ name: z.string().min(1), memberIds: z.array(z.string()).min(1) }).parse(req.body);
    sendCreated(res, await createGroupRoom(req.user.schoolId, req.user.id, data));
  } catch (e) { next(e); }
});

router.post('/rooms/:roomId/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    sendCreated(res, await addMemberToRoom(req.params.roomId, req.user.id, userId, req.user.schoolId));
  } catch (e) { next(e); }
});

router.delete('/rooms/:roomId/leave', async (req: Request, res: Response, next: NextFunction) => {
  try { await leaveRoom(req.params.roomId, req.user.id); sendSuccess(res, null, 'Left room'); } catch (e) { next(e); }
});

// Messages
router.get('/rooms/:roomId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const { messages, total } = await getMessages(req.params.roomId, req.user.id, req.user.schoolId, { page, limit });
    sendSuccess(res, messages, 'OK', 200, paginationMeta(total, page, limit));
  } catch (e) { next(e); }
});

router.delete('/messages/:messageId', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await deleteMessage(req.params.messageId, req.user.id, req.user.schoolId), 'Deleted'); } catch (e) { next(e); }
});

export default router;
