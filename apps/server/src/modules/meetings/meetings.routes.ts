import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MeetingStatus } from '@prisma/client';
import { db } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { emitToUser } from '../../config/socket';
import { sendSuccess, sendCreated, paginationMeta } from '../../utils/response';
import { authorize } from '../../middleware/auth';
import { Role, NotificationType } from '@prisma/client';

// ── Service ───────────────────────────────────────────────────────────────────

const listMeetings = async (
  userId: string,
  role: Role,
  schoolId: string,
  params: { page: number; limit: number; status?: MeetingStatus },
) => {
  const { page, limit, status } = params;
  const skip = (page - 1) * limit;

  const where = {
    schoolId,
    ...(status && { status }),
    ...(role === Role.TEACHER
      ? { teacherId: userId }
      : role === Role.PARENT
      ? { parentId: userId }
      : {}),
  };

  const [meetings, total] = await Promise.all([
    db.meeting.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledAt: 'desc' },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
        },
        parent: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
      },
    }),
    db.meeting.count({ where }),
  ]);

  return { meetings, total };
};

const getMeetingContacts = async (userId: string, role: Role, schoolId: string) => {
  if (role === Role.PARENT) {
    const parentProfile = await db.parentProfile.findUnique({
      where: { userId },
      include: {
        studentLinks: {
          include: {
            studentProfile: {
              include: {
                class: {
                  include: {
                    classTeacher: {
                      include: {
                        user: {
                          select: { id: true, firstName: true, lastName: true, email: true },
                        },
                      },
                    },
                    teachings: {
                      include: {
                        subject: { select: { name: true } },
                        teacherProfile: {
                          include: {
                            user: {
                              select: { id: true, firstName: true, lastName: true, email: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const teacherMap = new Map<string, any>();

    (parentProfile?.studentLinks ?? []).forEach((link) => {
      const cls = link.studentProfile.class;
      if (cls?.classTeacher) {
        cls.classTeacher.forEach((ct) => {
          if (ct.user) {
            teacherMap.set(ct.user.id, {
              id: ct.user.id,
              name: `${ct.user.firstName} ${ct.user.lastName}`,
              email: ct.user.email,
              roleDescription: `Class Teacher (${cls.name})`,
            });
          }
        });
      }
      if (cls?.teachings) {
        cls.teachings.forEach((t) => {
          if (t.teacherProfile?.user) {
            const u = t.teacherProfile.user;
            teacherMap.set(u.id, {
              id: u.id,
              name: `${u.firstName} ${u.lastName}`,
              email: u.email,
              roleDescription: `${t.subject.name} Teacher (${cls.name})`,
            });
          }
        });
      }
    });

    let teachersList = Array.from(teacherMap.values());

    if (teachersList.length === 0) {
      const allTeachers = await db.user.findMany({
        where: { schoolId, role: Role.TEACHER, isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: { firstName: 'asc' },
      });
      teachersList = allTeachers.map((t) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        email: t.email,
        roleDescription: 'Teacher',
      }));
    }

    return { teachers: teachersList, parents: [] };
  }

  if (role === Role.TEACHER) {
    const teacherProfile = await db.teacherProfile.findUnique({
      where: { userId },
      include: {
        subjectTeachings: { select: { classId: true } },
        assignedClasses: { select: { id: true } },
        classTeacherOf: { select: { id: true } },
      },
    });

    const classIds = new Set<string>();
    (teacherProfile?.subjectTeachings ?? []).forEach((t) => classIds.add(t.classId));
    (teacherProfile?.assignedClasses ?? []).forEach((c) => classIds.add(c.id));
    if (teacherProfile?.classTeacherOf) classIds.add(teacherProfile.classTeacherOf.id);

    const classIdArray = Array.from(classIds);

    const studentLinks = await db.parentStudentLink.findMany({
      where: {
        studentProfile: {
          user: { schoolId },
          ...(classIdArray.length > 0 ? { classId: { in: classIdArray } } : {}),
        },
      },
      include: {
        parentProfile: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
          },
        },
        studentProfile: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            class: { select: { name: true } },
          },
        },
      },
    });

    const parentsList = studentLinks.map((link) => ({
      parentId: link.parentProfile.user.id,
      parentName: `${link.parentProfile.user.firstName} ${link.parentProfile.user.lastName}`,
      parentEmail: link.parentProfile.user.email,
      parentPhone: link.parentProfile.user.phone,
      studentId: link.studentProfile.user.id,
      studentName: `${link.studentProfile.user.firstName} ${link.studentProfile.user.lastName}`,
      className: link.studentProfile.class?.name ?? 'Assigned Class',
      relation: link.relation,
    }));

    if (parentsList.length === 0) {
      const allParents = await db.parentProfile.findMany({
        where: { user: { schoolId, isActive: true } },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          studentLinks: {
            include: {
              studentProfile: {
                include: {
                  user: { select: { id: true, firstName: true, lastName: true } },
                  class: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      allParents.forEach((p) => {
        const student = p.studentLinks[0]?.studentProfile;
        parentsList.push({
          parentId: p.user.id,
          parentName: `${p.user.firstName} ${p.user.lastName}`,
          parentEmail: p.user.email,
          parentPhone: p.user.phone,
          studentId: student?.user.id,
          studentName: student ? `${student.user.firstName} ${student.user.lastName}` : '',
          className: student?.class?.name ?? '',
          relation: p.studentLinks[0]?.relation || 'Guardian',
        });
      });
    }

    return { parents: parentsList, teachers: [] };
  }

  // Admin / Super Admin
  const [allTeachers, allParents] = await Promise.all([
    db.user.findMany({
      where: { schoolId, role: Role.TEACHER, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: 'asc' },
    }),
    db.user.findMany({
      where: { schoolId, role: Role.PARENT, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      orderBy: { firstName: 'asc' },
    }),
  ]);

  return {
    teachers: allTeachers.map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
      email: t.email,
      roleDescription: 'Teacher',
    })),
    parents: allParents.map((p) => ({
      parentId: p.id,
      parentName: `${p.firstName} ${p.lastName}`,
      parentEmail: p.email,
      parentPhone: p.phone,
      studentName: 'Student Parent',
      className: '',
      relation: 'Parent',
    })),
  };
};

const createMeeting = async (
  requestingUser: { id: string; role: Role; firstName?: string; lastName?: string },
  schoolId: string,
  data: {
    teacherId?: string;
    parentId?: string;
    studentId?: string;
    title: string;
    agenda?: string;
    scheduledAt: Date;
    duration?: number;
    location?: string;
    meetingLink?: string;
  },
) => {
  let finalTeacherId = data.teacherId;
  let finalParentId = data.parentId;

  if (requestingUser.role === Role.PARENT) {
    finalParentId = requestingUser.id;
    if (!finalTeacherId) throw new AppError('teacherId is required', 400);
  } else if (requestingUser.role === Role.TEACHER) {
    finalTeacherId = requestingUser.id;
    if (!finalParentId) throw new AppError('parentId is required', 400);
  } else {
    // Admin
    if (!finalTeacherId || !finalParentId) {
      throw new AppError('Both teacherId and parentId are required', 400);
    }
  }

  const [teacher, parent] = await Promise.all([
    db.user.findFirst({ where: { id: finalTeacherId, schoolId, role: Role.TEACHER } }),
    db.user.findFirst({ where: { id: finalParentId, schoolId, role: Role.PARENT } }),
  ]);

  if (!teacher) throw new AppError('Teacher not found', 404);
  if (!parent) throw new AppError('Parent not found', 404);

  const meeting = await db.meeting.create({
    data: {
      schoolId,
      teacherId: finalTeacherId,
      parentId: finalParentId,
      studentId: data.studentId,
      title: data.title,
      agenda: data.agenda,
      scheduledAt: data.scheduledAt,
      duration: data.duration ?? 30,
      location: data.location,
      meetingLink: data.meetingLink,
      status: MeetingStatus.PENDING,
    },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      parent: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Notify recipient
  const isTeacherInitiator = requestingUser.role === Role.TEACHER;
  const recipientId = isTeacherInitiator ? finalParentId : finalTeacherId;
  const initiatorName = isTeacherInitiator
    ? `Teacher ${teacher.firstName} ${teacher.lastName}`
    : `${parent.firstName} ${parent.lastName}`;

  const notifTitle = 'Meeting Request';
  const notifBody = `${initiatorName} requested a meeting on ${data.scheduledAt.toLocaleDateString()} regarding "${data.title}"`;

  emitToUser(recipientId, 'notification:new', {
    type: 'MEETING',
    title: notifTitle,
    body: notifBody,
  });

  await db.notification.create({
    data: {
      schoolId,
      userId: recipientId,
      type: NotificationType.MEETING,
      title: notifTitle,
      body: notifBody,
    },
  });

  return meeting;
};

const updateMeetingStatus = async (
  id: string,
  userId: string,
  schoolId: string,
  status: MeetingStatus,
  notes?: string,
) => {
  const meeting = await db.meeting.findFirst({
    where: { id, schoolId, OR: [{ teacherId: userId }, { parentId: userId }] },
  });
  if (!meeting) throw new AppError('Meeting not found', 404);

  const updated = await db.meeting.update({
    where: { id },
    data: { status, ...(notes && { notes }) },
  });

  // Notify the other party
  const notifyUserId = userId === meeting.teacherId ? meeting.parentId : meeting.teacherId;
  const statusText =
    status === 'CONFIRMED' ? 'confirmed' : status === 'CANCELLED' ? 'cancelled' : 'updated';

  emitToUser(notifyUserId, 'notification:new', {
    type: 'MEETING',
    title: `Meeting ${statusText}`,
    body: `${meeting.title} has been ${statusText}`,
  });

  return updated;
};

// ── Router ────────────────────────────────────────────────────────────────────
const router = Router();
const isStaffOrParent = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER, Role.PARENT];

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const status = req.query.status as MeetingStatus | undefined;
    const { meetings, total } = await listMeetings(
      req.user.id,
      req.user.role as Role,
      req.user.schoolId,
      { page, limit, status },
    );
    sendSuccess(res, meetings, 'OK', 200, paginationMeta(total, page, limit));
  } catch (e) {
    next(e);
  }
});

router.get('/contacts', authorize(...isStaffOrParent), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contacts = await getMeetingContacts(
      req.user.id,
      req.user.role as Role,
      req.user.schoolId,
    );
    sendSuccess(res, contacts);
  } catch (e) {
    next(e);
  }
});

router.post('/', authorize(...isStaffOrParent), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z
      .object({
        teacherId: z.string().optional(),
        parentId: z.string().optional(),
        studentId: z.string().optional(),
        title: z.string().min(1, 'Meeting title is required'),
        agenda: z.string().optional(),
        scheduledAt: z.string().datetime(),
        duration: z.number().optional(),
        location: z.string().optional(),
        meetingLink: z.string().url().optional().or(z.literal('')),
      })
      .parse(req.body);

    sendCreated(
      res,
      await createMeeting(req.user, req.user.schoolId, {
        ...data,
        meetingLink: data.meetingLink || undefined,
        scheduledAt: new Date(data.scheduledAt),
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, notes } = z
      .object({
        status: z.nativeEnum(MeetingStatus),
        notes: z.string().optional(),
      })
      .parse(req.body);
    sendSuccess(
      res,
      await updateMeetingStatus(req.params.id, req.user.id, req.user.schoolId, status, notes),
      'Status updated',
    );
  } catch (e) {
    next(e);
  }
});

export default router;

