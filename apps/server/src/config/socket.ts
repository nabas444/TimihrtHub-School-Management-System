import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './database';
import { logger } from '../utils/logger';

export interface AuthSocket extends Socket {
  userId: string;
  schoolId: string;
  role: string;
}

let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // ── Auth middleware ──────────────────────────────────────────────────────
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ??
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET ?? '',
      ) as { userId: string; schoolId: string; role: string };

      (socket as AuthSocket).userId = payload.userId;
      (socket as AuthSocket).schoolId = payload.schoolId;
      (socket as AuthSocket).role = payload.role;

      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const s = socket as AuthSocket;
    logger.info(`Socket connected: ${s.userId} (${s.role})`);

    // Join personal room for private notifications
    s.join(`user:${s.userId}`);

    // Join school room for announcements
    s.join(`school:${s.schoolId}`);

    // Auto-join user's chat rooms
    const memberships = await db.chatRoomMember.findMany({
      where: { userId: s.userId, leftAt: null },
      select: { roomId: true },
    });
    memberships.forEach(({ roomId }) => s.join(`room:${roomId}`));

    // ── Chat events ──────────────────────────────────────────────────────
    s.on('chat:send', async (data: { roomId: string; content: string; type?: string; replyToId?: string }) => {
      try {
        const isMember = await db.chatRoomMember.findUnique({
          where: { roomId_userId: { roomId: data.roomId, userId: s.userId } },
        });
        if (!isMember || isMember.leftAt) {
          s.emit('error', { message: 'Not a member of this room' });
          return;
        }

        const message = await db.message.create({
          data: {
            roomId: data.roomId,
            senderId: s.userId,
            content: data.content,
            type: (data.type as any) ?? 'TEXT',
            replyToId: data.replyToId ?? null,
          },
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
            replyTo: {
              select: { id: true, content: true, senderId: true },
            },
          },
        });

        // Broadcast to all room members
        io.to(`room:${data.roomId}`).emit('chat:message', message);

        // Update room's updatedAt
        await db.chatRoom.update({
          where: { id: data.roomId },
          data: { updatedAt: new Date() },
        });
      } catch (err) {
        logger.error('chat:send error', err);
        s.emit('error', { message: 'Failed to send message' });
      }
    });

    s.on('chat:typing', (data: { roomId: string }) => {
      s.to(`room:${data.roomId}`).emit('chat:typing', {
        userId: s.userId,
        roomId: data.roomId,
      });
    });

    s.on('chat:read', async (data: { roomId: string }) => {
      await db.chatRoomMember.update({
        where: { roomId_userId: { roomId: data.roomId, userId: s.userId } },
        data: { lastReadAt: new Date() },
      });
      s.to(`room:${data.roomId}`).emit('chat:read', {
        userId: s.userId,
        roomId: data.roomId,
        readAt: new Date(),
      });
    });

    s.on('chat:react', async (data: { messageId: string; emoji: string }) => {
      const reaction = await db.messageReaction.upsert({
        where: {
          messageId_userId_emoji: {
            messageId: data.messageId,
            userId: s.userId,
            emoji: data.emoji,
          },
        },
        update: {},
        create: {
          messageId: data.messageId,
          userId: s.userId,
          emoji: data.emoji,
        },
      });
      const message = await db.message.findUnique({ where: { id: data.messageId } });
      if (message) {
        io.to(`room:${message.roomId}`).emit('chat:reaction', reaction);
      }
    });

    // ── Presence ─────────────────────────────────────────────────────────
    io.to(`school:${s.schoolId}`).emit('presence:online', { userId: s.userId });

    s.on('disconnect', () => {
      io.to(`school:${s.schoolId}`).emit('presence:offline', { userId: s.userId });
      logger.info(`Socket disconnected: ${s.userId}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

// Utility: emit to a specific user from anywhere in the app
export const emitToUser = (userId: string, event: string, data: unknown) => {
  getIO().to(`user:${userId}`).emit(event, data);
};

// Utility: emit to entire school
export const emitToSchool = (schoolId: string, event: string, data: unknown) => {
  getIO().to(`school:${schoolId}`).emit(event, data);
};
