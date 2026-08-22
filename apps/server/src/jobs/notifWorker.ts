import { Queue, Worker, Job } from 'bullmq';
import { redisSub } from '../config/redis';
import { db } from '../config/database';
import { emitToUser } from '../config/socket';
import { logger } from '../utils/logger';
import { sendSms } from '../utils/sms';

export const notifQueue = new Queue('notifications', { connection: redisSub });

interface NotifJob {
  type: 'ASSIGNMENT_REMINDER' | 'FEE_OVERDUE' | 'ATTENDANCE_SUMMARY' | 'EXAM_REMINDER';
  schoolId?: string;
  payload?: Record<string, unknown>;
}

// ── Worker ────────────────────────────────────────────────────────────────────
export const notifWorker = new Worker<NotifJob>(
  'notifications',
  async (job: Job<NotifJob>) => {
    const { type, schoolId, payload } = job.data;

    switch (type) {
      case 'ASSIGNMENT_REMINDER': {
        // Remind students about assignments due in 24 hours
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);

        const upcoming = await db.assignment.findMany({
          where: { schoolId, isPublished: true, dueDate: { gte: tomorrow, lt: dayAfter } },
          include: { subject: { select: { name: true } } },
        });

        for (const a of upcoming) {
          if (!a.classId) continue;
          const students = await db.user.findMany({
            where: { schoolId, role: 'STUDENT', studentProfile: { classId: a.classId } },
            select: { id: true },
          });

          await db.notification.createMany({
            data: students.map((s) => ({
              schoolId: schoolId!,
              userId: s.id,
              type: 'ASSIGNMENT' as const,
              title: '📚 Assignment Due Tomorrow',
              body: `${a.subject.name}: "${a.title}" is due tomorrow!`,
              assignmentId: a.id,
            })),
            skipDuplicates: true,
          });

          students.forEach((s) =>
            emitToUser(s.id, 'notification:new', { type: 'ASSIGNMENT', title: 'Due Tomorrow', body: a.title }),
          );
        }
        logger.info(`Assignment reminders sent for school ${schoolId}`);
        break;
      }

      case 'FEE_OVERDUE': {
        // Mark overdue invoices and notify
        const now = new Date();
        const overdueInvoices = await db.feeInvoice.findMany({
          where: { schoolId, dueDate: { lt: now }, status: { in: ['PENDING', 'PARTIAL'] } },
          include: { studentProfile: { include: { user: { select: { id: true } }, parentLinks: { include: { parentProfile: { include: { user: { select: { id: true, phone: true, smsOptIn: true } } } } } } } } },
        });

        const updateOps = overdueInvoices.map((inv) =>
          db.feeInvoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE' } }),
        );
        if (updateOps.length > 0) await db.$transaction(updateOps);

        for (const inv of overdueInvoices) {
          const studentUserId = inv.studentProfile.user.id;
          emitToUser(studentUserId, 'notification:new', { type: 'FEE', title: '⚠️ Fee Overdue', body: `${inv.title} is overdue` });

          inv.studentProfile.parentLinks.forEach((link) => {
            const parentUser = link.parentProfile.user;
            const msg = `${inv.title} is overdue`;
            emitToUser(parentUser.id, 'notification:new', { type: 'FEE', title: '⚠️ Fee Overdue', body: msg });

            // Phase 5: SMS is a second channel for parents who opted in —
            // never blocks the overdue-marking transaction or the in-app alert.
            if (parentUser.smsOptIn) {
              sendSms(parentUser.phone, `TimhirtHub: Fee reminder — ${msg}. Please settle at your earliest convenience.`).catch(() => {});
            }
          });
        }

        logger.info(`Marked ${overdueInvoices.length} invoices as overdue`);
        break;
      }

      case 'EXAM_REMINDER': {
        // Remind 48 hours before exam
        const in48h = new Date();
        in48h.setHours(in48h.getHours() + 48);
        const in49h = new Date(in48h);
        in49h.setHours(in49h.getHours() + 1);

        const exams = await db.exam.findMany({
          where: { schoolId, isPublished: true, scheduledAt: { gte: in48h, lt: in49h } },
          include: { subject: { select: { name: true } }, class: { select: { id: true, name: true } } },
        });

        for (const exam of exams) {
          if (!exam.classId) continue;
          const students = await db.user.findMany({
            where: { schoolId, role: 'STUDENT', studentProfile: { classId: exam.classId } },
            select: { id: true },
          });

          await db.notification.createMany({
            data: students.map((s) => ({
              schoolId: schoolId!,
              userId: s.id,
              type: 'EXAM' as const,
              title: '📝 Exam in 2 Days',
              body: `${exam.subject.name}: ${exam.title} — ${exam.scheduledAt.toLocaleDateString()} at ${exam.venue ?? 'TBA'}`,
            })),
            skipDuplicates: true,
          });

          students.forEach((s) => emitToUser(s.id, 'notification:new', { type: 'EXAM', title: 'Exam Reminder', body: exam.title }));
        }
        break;
      }
    }
  },
  { connection: redisSub, concurrency: 2 },
);

notifWorker.on('failed', (job, err) => logger.error(`Notif job ${job?.id} failed:`, err));
notifWorker.on('error', (err) => logger.debug(`NotifWorker notice: ${err.message}`));
notifQueue.on('error', (err) => logger.debug(`NotifQueue notice: ${err.message}`));

// ── Schedule recurring jobs ───────────────────────────────────────────────────
export const scheduleRecurringJobs = async (schoolId: string) => {
  // Assignment reminders — daily at 8am
  await notifQueue.add('assignment-reminder', { type: 'ASSIGNMENT_REMINDER', schoolId }, {
    repeat: { pattern: '0 8 * * *' },
    jobId: `assignment-reminder-${schoolId}`,
  });

  // Fee overdue check — daily at midnight
  await notifQueue.add('fee-overdue', { type: 'FEE_OVERDUE', schoolId }, {
    repeat: { pattern: '0 0 * * *' },
    jobId: `fee-overdue-${schoolId}`,
  });

  // Exam reminders — daily at 9am
  await notifQueue.add('exam-reminder', { type: 'EXAM_REMINDER', schoolId }, {
    repeat: { pattern: '0 9 * * *' },
    jobId: `exam-reminder-${schoolId}`,
  });

  logger.info(`Scheduled recurring jobs for school ${schoolId}`);
};
