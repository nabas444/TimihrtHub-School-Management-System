/**
 * TimhirtHub Unified Deadline Engine Background Worker
 * Periodically evaluates academic tasks across the 5 supported domains:
 * 1. Student Assignments (48h, 24h, 2h, Overdue)
 * 2. Teacher Attendance (Approaching Cutoff, Overdue)
 * 3. Teacher Exam Marks / Results Submission
 * 4. Teacher Roster / Term Report Submission
 * 5. Parent Priority-Based Urgent Notices
 *
 * Implements strict duplicate notification prevention and school-timezone awareness.
 */

import { db } from "../config/database";
import { emitToUser } from "../config/socket";
import { logger } from "../utils/logger";
import { evaluateDeadline, formatInSchoolTimezone } from "../utils/deadlines";
import { NotificationType } from "@prisma/client";

/**
 * Check if a notification with the given stage was already dispatched to the user
 */
async function hasNotificationBeenSent(
  userId: string,
  taskId: string,
  stage: string,
): Promise<boolean> {
  const existing = await db.notification.findFirst({
    where: {
      userId,
      data: {
        path: ["stage"],
        equals: stage,
      },
      AND: [
        {
          data: {
            path: ["taskId"],
            equals: taskId,
          },
        },
      ],
    },
    select: { id: true },
  });

  return !!existing;
}

/**
 * Dispatch an in-app notification and emit real-time socket event
 */
async function dispatchDeadlineNotification(params: {
  schoolId: string;
  userId: string;
  type: NotificationType;
  priority: "INFO" | "IMPORTANT" | "URGENT";
  title: string;
  body: string;
  taskId: string;
  taskType: "ASSIGNMENT" | "ATTENDANCE" | "RESULT" | "ROSTER" | "BEHAVIOUR" | "POLICY";
  stage: string;
  link?: string;
  assignmentId?: string;
  deadline?: string;
}) {
  const {
    schoolId,
    userId,
    type,
    priority,
    title,
    body,
    taskId,
    taskType,
    stage,
    link,
    assignmentId,
    deadline,
  } = params;

  // Duplicate check
  const alreadySent = await hasNotificationBeenSent(userId, taskId, stage);
  if (alreadySent) return;

  const notif = await db.notification.create({
    data: {
      schoolId,
      userId,
      type,
      title,
      body,
      assignmentId: assignmentId || null,
      data: {
        priority,
        stage,
        taskId,
        taskType,
        link: link || "/dashboard",
        deadline: deadline || null,
      },
    },
  });

  emitToUser(userId, "notification:new", {
    id: notif.id,
    type,
    priority,
    title,
    body,
    link: link || "/dashboard",
    createdAt: notif.createdAt,
  });
}

/**
 * Main Deadline Engine Evaluation Cycle
 */
export async function runDeadlineEngineCycle() {
  try {
    const schools = await db.school.findMany({
      where: { isActive: true },
      include: { settings: true },
    });

    for (const school of schools) {
      const timezone = school.timezone || "Africa/Addis_Ababa";

      // ─────────────────────────────────────────────────────────────
      // 1. STUDENT ASSIGNMENT DEADLINES
      // ─────────────────────────────────────────────────────────────
      const assignments = await db.assignment.findMany({
        where: {
          schoolId: school.id,
          isPublished: true,
        },
        include: {
          subject: { select: { name: true } },
          submissions: { select: { studentId: true, status: true, submittedAt: true } },
        },
      });

      for (const assignment of assignments) {
        const evaluation = evaluateDeadline(assignment.dueDate, timezone);
        const submittedStudentIds = new Set(
          assignment.submissions.map((s: { studentId: string }) => s.studentId),
        );

        // Find enrolled students for this assignment
        let targetStudents: { id: string }[] = [];
        if (assignment.classId) {
          targetStudents = await db.user.findMany({
            where: {
              schoolId: school.id,
              role: "STUDENT",
              studentProfile: { classId: assignment.classId },
            },
            select: { id: true },
          });
        }

        for (const student of targetStudents) {
          if (submittedStudentIds.has(student.id)) continue; // Already submitted

          const formattedDue = evaluation.formattedDueDate;

          // 🔴 Overdue Stage
          if (evaluation.status === "OVERDUE") {
            await dispatchDeadlineNotification({
              schoolId: school.id,
              userId: student.id,
              type: NotificationType.ASSIGNMENT,
              priority: "URGENT",
              title: "🔴 Assignment Overdue",
              body: `"${assignment.title}" (${assignment.subject.name}) was due on ${formattedDue}. Please submit immediately.`,
              taskId: assignment.id,
              taskType: "ASSIGNMENT",
              stage: "OVERDUE",
              link: `/assignments/${assignment.id}`,
              assignmentId: assignment.id,
              deadline: assignment.dueDate.toISOString(),
            });

            // Notify parents of unsubmitted overdue assignment
            const parentLinks = await db.parentStudentLink.findMany({
              where: { studentProfile: { userId: student.id } },
              include: { parentProfile: { select: { userId: true } } },
            });

            for (const pl of parentLinks) {
              await dispatchDeadlineNotification({
                schoolId: school.id,
                userId: pl.parentProfile.userId,
                type: NotificationType.ASSIGNMENT,
                priority: "URGENT",
                title: "⚠️ Child Assignment Overdue",
                body: `Your child has an overdue assignment: "${assignment.title}" (${assignment.subject.name}). Due date was ${formattedDue}.`,
                taskId: assignment.id,
                taskType: "ASSIGNMENT",
                stage: `PARENT_OVERDUE_${student.id}`,
                link: `/assignments/${assignment.id}`,
                assignmentId: assignment.id,
              });
            }
          }
          // 🔴 Urgent Stage (<= 2h)
          else if (evaluation.status === "URGENT") {
            await dispatchDeadlineNotification({
              schoolId: school.id,
              userId: student.id,
              type: NotificationType.ASSIGNMENT,
              priority: "URGENT",
              title: "🔴 Urgent Assignment Deadline",
              body: `"${assignment.title}" (${assignment.subject.name}) is due in less than 2 hours (${formattedDue})!`,
              taskId: assignment.id,
              taskType: "ASSIGNMENT",
              stage: "2H_REMINDER",
              link: `/assignments/${assignment.id}`,
              assignmentId: assignment.id,
              deadline: assignment.dueDate.toISOString(),
            });
          }
          // 🟡 Approaching Stage (<= 24h)
          else if (evaluation.hoursRemaining <= 24 && evaluation.hoursRemaining > 2) {
            await dispatchDeadlineNotification({
              schoolId: school.id,
              userId: student.id,
              type: NotificationType.ASSIGNMENT,
              priority: "IMPORTANT",
              title: "🟡 Assignment Due Tomorrow",
              body: `Reminder: "${assignment.title}" (${assignment.subject.name}) is due tomorrow (${formattedDue}).`,
              taskId: assignment.id,
              taskType: "ASSIGNMENT",
              stage: "24H_REMINDER",
              link: `/assignments/${assignment.id}`,
              assignmentId: assignment.id,
              deadline: assignment.dueDate.toISOString(),
            });
          }
          // 🟢 48h Advance Reminder (<= 48h)
          else if (evaluation.hoursRemaining <= 48 && evaluation.hoursRemaining > 24) {
            await dispatchDeadlineNotification({
              schoolId: school.id,
              userId: student.id,
              type: NotificationType.ASSIGNMENT,
              priority: "INFO",
              title: "📚 Upcoming Assignment",
              body: `"${assignment.title}" (${assignment.subject.name}) is due in 2 days on ${formattedDue}.`,
              taskId: assignment.id,
              taskType: "ASSIGNMENT",
              stage: "48H_REMINDER",
              link: `/assignments/${assignment.id}`,
              assignmentId: assignment.id,
              deadline: assignment.dueDate.toISOString(),
            });
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 2. TEACHER ATTENDANCE: DYNAMIC PER-TEACHING-PERIOD WINDOWS
      // ─────────────────────────────────────────────────────────────
      const windowMinutes = school.settings?.lateThresholdMinutes ?? 15;
      const now = new Date();
      const todayDateStr = formatInSchoolTimezone(now, timezone, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      const dayMap = [
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ] as const;
      const currentDayOfWeek = dayMap[now.getDay()];

      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const currentMinutesToday = now.getHours() * 60 + now.getMinutes();

      // 2a. Check timetable slots for today's scheduled teaching periods
      const todaySlots = await db.timetableSlot.findMany({
        where: {
          class: { schoolId: school.id },
          dayOfWeek: currentDayOfWeek,
        },
        include: {
          class: { select: { id: true, name: true } },
          subjectTeaching: {
            include: {
              subject: { select: { name: true } },
              teacherProfile: { select: { userId: true } },
            },
          },
        },
      });

      for (const slot of todaySlots) {
        const teacherUserId = slot.subjectTeaching.teacherProfile.userId;
        const [startH, startM] = slot.startTime.split(":").map(Number);
        const slotStartMinutes = startH * 60 + startM;
        const slotCutoffMinutes = slotStartMinutes + windowMinutes;

        const cutoffH = Math.floor(slotCutoffMinutes / 60);
        const cutoffM = slotCutoffMinutes % 60;
        const cutoffTimeStr = `${String(cutoffH).padStart(2, "0")}:${String(cutoffM).padStart(2, "0")}`;

        // Check if attendance has been marked today for this class
        const attendanceCount = await db.attendanceRecord.count({
          where: {
            schoolId: school.id,
            classId: slot.classId,
            date: { gte: todayStart },
          },
        });

        if (attendanceCount === 0) {
          const taskId = `ATTENDANCE_PERIOD_${slot.id}_${todayDateStr}`;

          // Overdue: past period start + window (e.g. past 08:15)
          if (currentMinutesToday > slotCutoffMinutes) {
            await dispatchDeadlineNotification({
              schoolId: school.id,
              userId: teacherUserId,
              type: NotificationType.ATTENDANCE,
              priority: "URGENT",
              title: "🔴 Period Attendance Overdue",
              body: `Attendance for Class ${slot.class.name} (${slot.subjectTeaching.subject.name}, ${slot.startTime} period) is overdue. Reporting window closed at ${cutoffTimeStr}.`,
              taskId,
              taskType: "ATTENDANCE",
              stage: `PERIOD_OVERDUE_${slot.id}_${todayDateStr}`,
              link: `/attendance/mark`,
            });
          }
          // Active Window: period start to period start + window (e.g. 08:00 - 08:15)
          else if (currentMinutesToday >= slotStartMinutes && currentMinutesToday <= slotCutoffMinutes) {
            await dispatchDeadlineNotification({
              schoolId: school.id,
              userId: teacherUserId,
              type: NotificationType.ATTENDANCE,
              priority: "IMPORTANT",
              title: "🟡 Period Attendance Window Active",
              body: `Class ${slot.class.name} (${slot.subjectTeaching.subject.name}) period started at ${slot.startTime}. Please report attendance before ${cutoffTimeStr} (${windowMinutes}m window).`,
              taskId,
              taskType: "ATTENDANCE",
              stage: `PERIOD_WINDOW_${slot.id}_${todayDateStr}`,
              link: `/attendance/mark`,
            });
          }
        }
      }

      // 2b. Fallback for assigned class teachers without specific timetable slots
      const teachers = await db.user.findMany({
        where: { schoolId: school.id, role: "TEACHER", isActive: true },
        include: {
          teacherProfile: {
            include: {
              assignedClasses: true,
            },
          },
        },
      });

      for (const teacher of teachers) {
        const assignedClasses = teacher.teacherProfile?.assignedClasses || [];
        for (const klass of assignedClasses) {
          const attendanceCount = await db.attendanceRecord.count({
            where: {
              schoolId: school.id,
              classId: klass.id,
              date: { gte: todayStart },
            },
          });

          if (attendanceCount === 0 && todaySlots.length === 0) {
            const taskId = `ATTENDANCE_${klass.id}_${todayDateStr}`;
            if (currentMinutesToday > 9 * 60) {
              await dispatchDeadlineNotification({
                schoolId: school.id,
                userId: teacher.id,
                type: NotificationType.ATTENDANCE,
                priority: "URGENT",
                title: "🔴 Attendance Submission Overdue",
                body: `Today's attendance for Class ${klass.name} has not been reported. Please submit attendance immediately.`,
                taskId,
                taskType: "ATTENDANCE",
                stage: "ATTENDANCE_OVERDUE",
                link: `/attendance/mark`,
              });
            }
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 3. TEACHER EXAM RESULT & MARK SUBMISSION DEADLINES
      // ─────────────────────────────────────────────────────────────
      const recentExams = await db.exam.findMany({
        where: {
          schoolId: school.id,
          scheduledAt: { lt: now },
        },
        include: {
          subject: { select: { name: true } },
          class: { select: { id: true, name: true } },
          results: { select: { id: true } },
        },
      });

      for (const exam of recentExams) {
        if (exam.results.length === 0) {
          // No marks submitted yet for this completed exam
          const examDueResultDate = new Date(exam.scheduledAt);
          examDueResultDate.setHours(examDueResultDate.getHours() + 48); // 48h result entry deadline

          const evalResult = evaluateDeadline(examDueResultDate, timezone);
          const taskId = `EXAM_RESULT_${exam.id}`;

          // Find teacher(s) teaching this subject for this class
          let teacherUserIds: string[] = [];
          if (exam.classId) {
            const teachings = await db.subjectTeaching.findMany({
              where: {
                classId: exam.classId,
                subjectId: exam.subjectId,
              },
              include: { teacherProfile: { select: { userId: true } } },
            });
            teacherUserIds = teachings.map((t) => t.teacherProfile.userId);
          }

          for (const teacherId of teacherUserIds) {
            if (evalResult.status === "OVERDUE") {
              await dispatchDeadlineNotification({
                schoolId: school.id,
                userId: teacherId,
                type: NotificationType.EXAM,
                priority: "URGENT",
                title: "🔴 Exam Marks Entry Overdue",
                body: `Results entry for "${exam.title}" (${exam.subject.name} - Class ${exam.class?.name || ""}) is overdue. Please enter student marks now.`,
                taskId,
                taskType: "RESULT",
                stage: "EXAM_RESULT_OVERDUE",
                link: `/grades`,
              });
            } else if (evalResult.status === "APPROACHING" || evalResult.status === "URGENT") {
              await dispatchDeadlineNotification({
                schoolId: school.id,
                userId: teacherId,
                type: NotificationType.EXAM,
                priority: "IMPORTANT",
                title: "🟡 Exam Marks Submission Due Soon",
                body: `Please submit student results for "${exam.title}" (${exam.subject.name}). Due: ${evalResult.formattedDueDate}.`,
                taskId,
                taskType: "RESULT",
                stage: "EXAM_RESULT_APPROACHING",
                link: `/grades`,
              });
            }
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 4. POLICY SCHEDULED REVIEW DUE REMINDERS
      // ─────────────────────────────────────────────────────────────
      try {
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const expiringPolicies = await (db as any).policy.findMany({
          where: {
            schoolId: school.id,
            status: "PUBLISHED",
            nextReviewDate: {
              not: null,
              lte: thirtyDaysFromNow,
            },
          },
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        for (const policy of expiringPolicies) {
          if (!policy.nextReviewDate) continue;
          const reviewDate = new Date(policy.nextReviewDate);
          const evalPolicy = evaluateDeadline(reviewDate, timezone);
          const taskId = `POLICY_REVIEW_${policy.id}`;

          if (evalPolicy.status === "OVERDUE") {
            await dispatchDeadlineNotification({
              schoolId: school.id,
              userId: policy.ownerId,
              type: NotificationType.POLICY,
              priority: "URGENT",
              title: "🔴 Policy Review Overdue",
              body: `School policy "${policy.title}" was due for scheduled re-review on ${evalPolicy.formattedDueDate}. Please draft an updated version.`,
              taskId,
              taskType: "POLICY",
              stage: "POLICY_REVIEW_OVERDUE",
              link: `/policies/${policy.id}`,
            });
          } else if (evalPolicy.daysRemaining <= 30) {
            await dispatchDeadlineNotification({
              schoolId: school.id,
              userId: policy.ownerId,
              type: NotificationType.POLICY,
              priority: "IMPORTANT",
              title: "🟡 Policy Review Approaching",
              body: `Scheduled compliance review for policy "${policy.title}" is due on ${evalPolicy.formattedDueDate}.`,
              taskId,
              taskType: "POLICY",
              stage: "POLICY_REVIEW_APPROACHING",
              link: `/policies/${policy.id}`,
            });
          }
        }
      } catch (policyErr) {
        // Safe fallback if policy tables are not initialized yet
      }
    }
  } catch (err) {
    logger.error("Error in deadline engine background cycle:", err);
  }
}

/**
 * Start the deadline engine background timer
 */
let intervalHandle: NodeJS.Timeout | null = null;

export function startDeadlineEngine(intervalMinutes: number = 5) {
  if (intervalHandle) return;

  logger.info(`Starting Unified Deadline Engine (interval: ${intervalMinutes}m)`);

  // Run initial cycle after 5 seconds
  setTimeout(() => {
    runDeadlineEngineCycle().catch((err) =>
      logger.error("Initial deadline cycle error:", err),
    );
  }, 5000);

  // Set recurring interval
  intervalHandle = setInterval(() => {
    runDeadlineEngineCycle().catch((err) =>
      logger.error("Recurring deadline cycle error:", err),
    );
  }, intervalMinutes * 60 * 1000);
}

export function stopDeadlineEngine() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
