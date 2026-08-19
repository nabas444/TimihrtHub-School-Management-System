import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RoomType, Role } from '@prisma/client';
import { db } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess, sendCreated, paginationMeta } from '../../utils/response';
import { isAdmin, isStaff } from '../../middleware/auth';
import { getIO } from '../../config/socket';

// ── In-Memory Chat Moderation State ───────────────────────────────────────────
export const chatBlockedUsers = new Set<string>();
export const flaggedUsersMap = new Map<
  string,
  { reason: string; flaggedBy: string; flaggedAt: Date; notes?: string }
>();

// ── Scoped Contacts Directory ─────────────────────────────────────────────────
const getScopedContacts = async (
  userId: string,
  schoolId: string,
  userRole: Role,
  filterRole?: string,
  search?: string,
) => {
  let targetUserIds: string[] | null = null; // null means unrestricted within school

  if (userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN) {
    targetUserIds = null;
  } else if (userRole === Role.TEACHER) {
    const teacherProfile = await db.teacherProfile.findUnique({
      where: { userId },
      include: {
        assignedClasses: { select: { id: true } },
        classTeacherOf: { select: { id: true } },
        subjectTeachings: { select: { classId: true } },
      },
    });

    const classIds = new Set<string>();
    teacherProfile?.assignedClasses.forEach((c) => classIds.add(c.id));
    if (teacherProfile?.classTeacherOfId) classIds.add(teacherProfile.classTeacherOfId);
    teacherProfile?.subjectTeachings.forEach((st) => {
      if (st.classId) classIds.add(st.classId);
    });

    const classIdList = Array.from(classIds);
    const [studentsInClasses, teachers, admins] = await Promise.all([
      classIdList.length > 0
        ? db.studentProfile.findMany({
            where: { classId: { in: classIdList } },
            include: {
              user: { select: { id: true } },
              parentLinks: { include: { parentProfile: { select: { userId: true } } } },
            },
          })
        : [],
      db.user.findMany({
        where: { schoolId, role: Role.TEACHER, isActive: true },
        select: { id: true },
      }),
      db.user.findMany({
        where: { schoolId, role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, isActive: true },
        select: { id: true },
      }),
    ]);

    const accessible = new Set<string>();
    teachers.forEach((t) => accessible.add(t.id));
    admins.forEach((a) => accessible.add(a.id));
    studentsInClasses.forEach((s) => {
      accessible.add(s.user.id);
      s.parentLinks.forEach((pl) => accessible.add(pl.parentProfile.userId));
    });

    if (classIdList.length === 0) {
      targetUserIds = null;
    } else {
      targetUserIds = Array.from(accessible);
    }
  } else if (userRole === Role.STUDENT) {
    const studentProfile = await db.studentProfile.findUnique({
      where: { userId },
      include: {
        class: {
          include: {
            classTeacher: { select: { userId: true } },
            teachings: { include: { teacherProfile: { select: { userId: true } } } },
            students: { select: { userId: true } },
          },
        },
        parentLinks: { include: { parentProfile: { select: { userId: true } } } },
      },
    });

    const accessible = new Set<string>();
    studentProfile?.class?.classTeacher.forEach((ct) => accessible.add(ct.userId));
    studentProfile?.class?.teachings.forEach((t) => {
      if (t.teacherProfile?.userId) accessible.add(t.teacherProfile.userId);
    });
    studentProfile?.class?.students.forEach((s) => accessible.add(s.userId));
    studentProfile?.parentLinks.forEach((pl) => accessible.add(pl.parentProfile.userId));

    const admins = await db.user.findMany({
      where: { schoolId, role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, isActive: true },
      select: { id: true },
    });
    admins.forEach((a) => accessible.add(a.id));

    if (!studentProfile?.classId) {
      targetUserIds = null;
    } else {
      targetUserIds = Array.from(accessible);
    }
  } else if (userRole === Role.PARENT) {
    const parentProfile = await db.parentProfile.findUnique({
      where: { userId },
      include: {
        studentLinks: {
          include: {
            studentProfile: {
              include: {
                user: { select: { id: true } },
                class: {
                  include: {
                    classTeacher: { select: { userId: true } },
                    teachings: { include: { teacherProfile: { select: { userId: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const accessible = new Set<string>();
    parentProfile?.studentLinks.forEach((link) => {
      accessible.add(link.studentProfile.user.id);
      link.studentProfile.class?.classTeacher.forEach((ct) => accessible.add(ct.userId));
      link.studentProfile.class?.teachings.forEach((t) => {
        if (t.teacherProfile?.userId) accessible.add(t.teacherProfile.userId);
      });
    });

    const admins = await db.user.findMany({
      where: { schoolId, role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, isActive: true },
      select: { id: true },
    });
    admins.forEach((a) => accessible.add(a.id));

    if (!parentProfile?.studentLinks.length) {
      targetUserIds = null;
    } else {
      targetUserIds = Array.from(accessible);
    }
  }

  const where: any = {
    schoolId,
    id: { not: userId },
    isActive: true,
  };

  if (targetUserIds !== null) {
    where.id = { in: targetUserIds, not: userId };
  }

  if (filterRole && filterRole !== 'ALL') {
    where.role = filterRole as Role;
  }

  if (search && search.trim().length > 0) {
    const s = search.trim();
    where.OR = [
      { firstName: { contains: s, mode: 'insensitive' } },
      { lastName: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { phone: { contains: s, mode: 'insensitive' } },
    ];
  }

  const users = await db.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatar: true,
      role: true,
      gender: true,
      address: true,
      isActive: true,
      createdAt: true,
      studentProfile: {
        select: {
          admissionNumber: true,
          rollNumber: true,
          class: { select: { id: true, name: true, gradeLevel: { select: { name: true } } } },
        },
      },
      teacherProfile: {
        select: {
          employeeId: true,
          specialization: true,
          qualification: true,
          classTeacherOf: { select: { name: true } },
          subjectTeachings: {
            select: { subject: { select: { name: true } }, class: { select: { name: true } } },
          },
        },
      },
      parentProfile: {
        select: {
          occupation: true,
          relation: true,
          studentLinks: {
            select: {
              studentProfile: {
                select: {
                  user: { select: { firstName: true, lastName: true } },
                  class: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      adminProfile: {
        select: {
          department: true,
          employeeId: true,
        },
      },
    },
    orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    take: 100,
  });

  const userIds = users.map((u) => u.id);
  const existingRooms = await db.chatRoomMember.findMany({
    where: {
      userId,
      leftAt: null,
      room: {
        type: RoomType.DIRECT,
        members: { some: { userId: { in: userIds }, leftAt: null } },
      },
    },
    include: {
      room: {
        include: {
          members: { where: { userId: { not: userId } }, select: { userId: true } },
        },
      },
    },
  });

  const userRoomMap = new Map<string, string>();
  existingRooms.forEach((rm) => {
    const otherMember = rm.room.members[0];
    if (otherMember) {
      userRoomMap.set(otherMember.userId, rm.roomId);
    }
  });

  return users.map((u) => {
    const isBlocked = chatBlockedUsers.has(u.id) || !u.isActive;
    const isFlagged = flaggedUsersMap.has(u.id);

    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: u.phone,
      avatar: u.avatar,
      role: u.role,
      gender: u.gender,
      address: u.address,
      isActive: u.isActive,
      isBlocked,
      isFlagged,
      flagReason: flaggedUsersMap.get(u.id)?.reason,
      existingRoomId: userRoomMap.get(u.id) || null,
      details: {
        student: u.studentProfile
          ? {
              rollNumber: u.studentProfile.rollNumber,
              admissionNumber: u.studentProfile.admissionNumber,
              className: u.studentProfile.class?.name,
              gradeName: u.studentProfile.class?.gradeLevel?.name,
            }
          : null,
        teacher: u.teacherProfile
          ? {
              employeeId: u.teacherProfile.employeeId,
              specialization: u.teacherProfile.specialization,
              qualification: u.teacherProfile.qualification,
              classTeacherOf: u.teacherProfile.classTeacherOf?.name,
              subjects: u.teacherProfile.subjectTeachings.map((st: any) => st.subject.name),
            }
          : null,
        parent: u.parentProfile
          ? {
              occupation: u.parentProfile.occupation,
              relation: u.parentProfile.relation,
              children: u.parentProfile.studentLinks.map(
                (l: any) =>
                  `${l.studentProfile.user.firstName} ${l.studentProfile.user.lastName} (${
                    l.studentProfile.class?.name || 'Class'
                  })`,
              ),
            }
          : null,
        admin: u.adminProfile
          ? {
              department: u.adminProfile.department,
              employeeId: u.adminProfile.employeeId,
            }
          : null,
      },
    };
  });
};

// ── Rooms Service helpers ─────────────────────────────────────────────────────
const getUserRooms = async (userId: string, schoolId: string) => {
  const memberships = await db.chatRoomMember.findMany({
    where: { userId, leftAt: null, room: { schoolId } },
    include: {
      room: {
        include: {
          members: {
            where: { userId: { not: userId }, leftAt: null },
            include: {
              room: false,
            },
            take: 3,
          },
          messages: {
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { room: { updatedAt: 'desc' } },
  });

  const otherUserIds = new Set<string>();
  memberships.forEach((m) => {
    m.room.members.forEach((mem) => otherUserIds.add(mem.userId));
  });

  const otherUsers = await db.user.findMany({
    where: { id: { in: Array.from(otherUserIds) } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      email: true,
      phone: true,
      address: true,
      studentProfile: {
        select: {
          rollNumber: true,
          admissionNumber: true,
          class: { select: { name: true, gradeLevel: { select: { name: true } } } },
        },
      },
      teacherProfile: {
        select: {
          specialization: true,
          qualification: true,
          classTeacherOf: { select: { name: true } },
          subjectTeachings: { select: { subject: { select: { name: true } } } },
        },
      },
      parentProfile: {
        select: {
          occupation: true,
          studentLinks: {
            select: {
              studentProfile: {
                select: {
                  user: { select: { firstName: true, lastName: true } },
                  class: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      adminProfile: {
        select: { department: true },
      },
    },
  });

  const userMap = new Map<string, any>();
  otherUsers.forEach((u) => userMap.set(u.id, u));

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

      const membersWithDetails = m.room.members.map((mem) => {
        const u = userMap.get(mem.userId);
        return {
          ...mem,
          user: u || null,
          firstName: u?.firstName,
          lastName: u?.lastName,
          avatar: u?.avatar,
          role: u?.role,
        };
      });

      return {
        ...m,
        unread,
        room: {
          ...m.room,
          members: membersWithDetails,
        },
      };
    }),
  );
};

const createDirectRoom = async (schoolId: string, userAId: string, userBId: string) => {
  const userB = await db.user.findFirst({ where: { id: userBId, schoolId } });
  if (!userB) throw new AppError('User not found in this school', 404);

  const existing = await db.chatRoom.findFirst({
    where: {
      schoolId,
      type: RoomType.DIRECT,
      members: { some: { userId: userAId, leftAt: null } },
      AND: [{ members: { some: { userId: userBId, leftAt: null } } }],
    },
    include: { members: true },
  });

  if (existing) return existing;

  return db.chatRoom.create({
    data: {
      schoolId,
      type: RoomType.DIRECT,
      members: {
        create: [{ userId: userAId }, { userId: userBId }],
      },
    },
    include: { members: true },
  });
};

const getMessages = async (
  roomId: string,
  userId: string,
  schoolId: string,
  params: { page: number; limit: number },
) => {
  const member = await db.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!member || member.leftAt) throw new AppError('Not a member of this room', 403);

  const { page, limit } = params;
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    db.message.findMany({
      where: { roomId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { firstName: true, lastName: true } },
          },
        },
        reactions: true,
      },
    }),
    db.message.count({ where: { roomId } }),
  ]);

  await db.chatRoomMember.update({
    where: { roomId_userId: { roomId, userId } },
    data: { lastReadAt: new Date() },
  });

  return { messages: messages.reverse(), total };
};

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();

// Contacts Directory (Filtered by Role & Search)
router.get('/contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, search } = req.query as { role?: string; search?: string };
    const contacts = await getScopedContacts(
      req.user.id,
      req.user.schoolId,
      req.user.role as Role,
      role,
      search,
    );
    sendSuccess(res, contacts);
  } catch (e) {
    next(e);
  }
});

// User Detailed Profile
router.get('/users/:userId/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUser = await db.user.findFirst({
      where: { id: req.params.userId, schoolId: req.user.schoolId },
      include: {
        studentProfile: {
          include: {
            class: { include: { gradeLevel: true } },
            parentLinks: { include: { parentProfile: { include: { user: true } } } },
          },
        },
        teacherProfile: {
          include: {
            assignedClasses: true,
            classTeacherOf: true,
            subjectTeachings: { include: { subject: true, class: true } },
          },
        },
        parentProfile: {
          include: {
            studentLinks: { include: { studentProfile: { include: { user: true, class: true } } } },
          },
        },
        adminProfile: true,
      },
    });

    if (!targetUser) throw new AppError('User not found', 404);

    const isBlocked = chatBlockedUsers.has(targetUser.id) || !targetUser.isActive;
    const flagInfo = flaggedUsersMap.get(targetUser.id);

    sendSuccess(res, {
      id: targetUser.id,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      fullName: `${targetUser.firstName} ${targetUser.lastName}`,
      email: targetUser.email,
      phone: targetUser.phone,
      avatar: targetUser.avatar,
      role: targetUser.role,
      gender: targetUser.gender,
      dateOfBirth: targetUser.dateOfBirth,
      address: targetUser.address,
      isActive: targetUser.isActive,
      isBlocked,
      isFlagged: !!flagInfo,
      flagInfo: flagInfo || null,
      createdAt: targetUser.createdAt,
      profiles: {
        student: targetUser.studentProfile,
        teacher: targetUser.teacherProfile,
        parent: targetUser.parentProfile,
        admin: targetUser.adminProfile,
      },
    });
  } catch (e) {
    next(e);
  }
});

// Rooms
router.get('/rooms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getUserRooms(req.user.id, req.user.schoolId));
  } catch (e) {
    next(e);
  }
});

router.post('/rooms/direct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    sendCreated(res, await createDirectRoom(req.user.schoolId, req.user.id, userId));
  } catch (e) {
    next(e);
  }
});

// Messages in Room
router.get('/rooms/:roomId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const { messages, total } = await getMessages(
      req.params.roomId,
      req.user.id,
      req.user.schoolId,
      { page, limit },
    );
    sendSuccess(res, messages, 'OK', 200, paginationMeta(total, page, limit));
  } catch (e) {
    next(e);
  }
});

// Send Message (HTTP Endpoint fallback / reliable delivery)
router.post('/rooms/:roomId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (chatBlockedUsers.has(req.user.id)) {
      throw new AppError('Your chat privileges have been suspended by the administration', 403);
    }

    const { content, type, replyToId } = z
      .object({
        content: z.string().min(1),
        type: z.enum(['TEXT', 'IMAGE', 'FILE', 'AUDIO', 'SYSTEM']).optional(),
        replyToId: z.string().optional(),
      })
      .parse(req.body);

    const isMember = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId: req.params.roomId, userId: req.user.id } },
    });
    if (!isMember || isMember.leftAt) throw new AppError('Not a member of this room', 403);

    const message = await db.message.create({
      data: {
        roomId: req.params.roomId,
        senderId: req.user.id,
        content,
        type: (type as any) ?? 'TEXT',
        replyToId: replyToId ?? null,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
        },
        replyTo: {
          select: { id: true, content: true, senderId: true },
        },
        reactions: true,
      },
    });

    await db.chatRoom.update({
      where: { id: req.params.roomId },
      data: { updatedAt: new Date() },
    });

    try {
      const io = getIO();
      io.to(`room:${req.params.roomId}`).emit('chat:message', message);
      const members = await db.chatRoomMember.findMany({
        where: { roomId: req.params.roomId, leftAt: null },
        select: { userId: true },
      });
      members.forEach((m) => {
        io.to(`user:${m.userId}`).emit('chat:message', message);
      });
    } catch (_) {}

    sendCreated(res, message);
  } catch (e) {
    next(e);
  }
});

// Edit Message
router.patch('/messages/:messageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    const msg = await db.message.findUnique({ where: { id: req.params.messageId } });
    if (!msg) throw new AppError('Message not found', 404);

    const isAuthorized =
      msg.senderId === req.user.id ||
      req.user.role === Role.ADMIN ||
      req.user.role === Role.SUPER_ADMIN;
    if (!isAuthorized) throw new AppError('Cannot edit another user’s message', 403);

    const updated = await db.message.update({
      where: { id: req.params.messageId },
      data: { content, isEdited: true, updatedAt: new Date() },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatar: true, role: true } },
        replyTo: { select: { id: true, content: true, senderId: true } },
        reactions: true,
      },
    });

    try {
      getIO().to(`room:${msg.roomId}`).emit('chat:edit', updated);
    } catch (_) {}

    sendSuccess(res, updated, 'Message edited');
  } catch (e) {
    next(e);
  }
});

// Delete Message
router.delete('/messages/:messageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const msg = await db.message.findUnique({ where: { id: req.params.messageId } });
    if (!msg) throw new AppError('Message not found', 404);

    const isAuthorized =
      msg.senderId === req.user.id ||
      req.user.role === Role.ADMIN ||
      req.user.role === Role.SUPER_ADMIN;
    if (!isAuthorized) throw new AppError('Cannot delete another user’s message', 403);

    const updated = await db.message.update({
      where: { id: req.params.messageId },
      data: { isDeleted: true, content: 'This message was deleted' },
    });

    try {
      getIO().to(`room:${msg.roomId}`).emit('chat:delete', {
        messageId: msg.id,
        roomId: msg.roomId,
      });
    } catch (_) {}

    sendSuccess(res, updated, 'Message deleted');
  } catch (e) {
    next(e);
  }
});

// ── Admin Moderation: Block, Unblock, & Flag Users ────────────────────────────
router.post(
  '/users/:userId/block',
  isAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = z
        .object({ reason: z.string().default('Violation of chat policies') })
        .parse(req.body);
      const targetUser = await db.user.findFirst({
        where: { id: req.params.userId, schoolId: req.user.schoolId },
      });
      if (!targetUser) throw new AppError('User not found', 404);

      chatBlockedUsers.add(targetUser.id);
      flaggedUsersMap.set(targetUser.id, {
        reason,
        flaggedBy: `${req.user.firstName} ${req.user.lastName}`,
        flaggedAt: new Date(),
      });

      sendSuccess(res, { blocked: true, userId: targetUser.id }, 'User has been blocked from chat');
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/users/:userId/unblock',
  isAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUser = await db.user.findFirst({
        where: { id: req.params.userId, schoolId: req.user.schoolId },
      });
      if (!targetUser) throw new AppError('User not found', 404);

      chatBlockedUsers.delete(targetUser.id);
      flaggedUsersMap.delete(targetUser.id);

      sendSuccess(res, { blocked: false, userId: targetUser.id }, 'User chat access restored');
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/users/:userId/flag',
  isStaff,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason, notes } = z
        .object({ reason: z.string().min(3), notes: z.string().optional() })
        .parse(req.body);

      const targetUser = await db.user.findFirst({
        where: { id: req.params.userId, schoolId: req.user.schoolId },
      });
      if (!targetUser) throw new AppError('User not found', 404);

      flaggedUsersMap.set(targetUser.id, {
        reason,
        notes,
        flaggedBy: `${req.user.firstName} ${req.user.lastName}`,
        flaggedAt: new Date(),
      });

      sendSuccess(res, { flagged: true, userId: targetUser.id }, 'User has been flagged for administrative review');
    } catch (e) {
      next(e);
    }
  },
);

export default router;
