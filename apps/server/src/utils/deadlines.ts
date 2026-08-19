/**
 * TimhirtHub Unified Deadline & Timezone Engine
 * Evaluates task deadlines, time-based statuses, countdowns, and reminder thresholds
 * in the school's configured timezone.
 */

export type DeadlineStatus =
  | "HEALTHY" // 🟢 Plenty of time (> approaching threshold)
  | "APPROACHING" // 🟡 Approaching deadline (<= 24h / 48h)
  | "URGENT" // 🔴 Imminent (<= 2h)
  | "OVERDUE" // 🔴 Passed deadline and incomplete
  | "COMPLETED" // 🟢 Completed on time
  | "LATE_COMPLETED"; // 🟠 Completed after deadline

export type DeadlinePriority = "INFO" | "IMPORTANT" | "URGENT";

export interface DeadlineThresholds {
  approachingHours: number; // default: 24h
  urgentHours: number; // default: 2h
}

export const DEFAULT_THRESHOLDS: DeadlineThresholds = {
  approachingHours: 24,
  urgentHours: 2,
};

export interface DeadlineEvaluation {
  status: DeadlineStatus;
  priority: DeadlinePriority;
  color: "green" | "yellow" | "red" | "emerald" | "amber" | "gray";
  timeRemainingMs: number;
  hoursRemaining: number;
  minutesRemaining: number;
  isOverdue: boolean;
  isCompleted: boolean;
  isLate: boolean;
  humanCountdown: string;
  formattedDueDate: string;
}

/**
 * Format a Date in the school's configured timezone using Intl
 */
export function formatInSchoolTimezone(
  date: Date | string,
  timezone: string = "Africa/Addis_Ababa",
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "Africa/Addis_Ababa",
      ...options,
    }).format(d);
  } catch (err) {
    // Fallback if invalid timezone string
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Addis_Ababa",
      ...options,
    }).format(d);
  }
}

/**
 * Calculate time difference and human readable countdown string
 */
export function getHumanCountdown(timeRemainingMs: number): string {
  const isPast = timeRemainingMs < 0;
  const absMs = Math.abs(timeRemainingMs);
  const totalMinutes = Math.floor(absMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const remainingMinutes = totalMinutes % 60;

  if (isPast) {
    if (days > 0) return `Overdue by ${days}d ${remainingHours}h`;
    if (hours > 0) return `Overdue by ${hours}h ${remainingMinutes}m`;
    return `Overdue by ${Math.max(1, remainingMinutes)}m`;
  } else {
    if (days > 1) return `${days} days left`;
    if (days === 1) return `1 day ${remainingHours}h left`;
    if (hours > 0) return `${hours}h ${remainingMinutes}m left`;
    if (remainingMinutes > 0) return `${remainingMinutes} mins left`;
    return "Due now";
  }
}

/**
 * Unified Deadline Evaluator
 */
export function evaluateDeadline(
  dueDate: Date | string,
  timezone: string = "Africa/Addis_Ababa",
  completedAt?: Date | string | null,
  customThresholds: Partial<DeadlineThresholds> = {},
): DeadlineEvaluation {
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const completed =
    completedAt ? (typeof completedAt === "string" ? new Date(completedAt) : completedAt) : null;
  const now = new Date();

  const thresholds: DeadlineThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...customThresholds,
  };

  const formattedDueDate = formatInSchoolTimezone(due, timezone);

  // If already completed
  if (completed && !isNaN(completed.getTime())) {
    const isLateCompleted = completed.getTime() > due.getTime();
    return {
      status: isLateCompleted ? "LATE_COMPLETED" : "COMPLETED",
      priority: "INFO",
      color: isLateCompleted ? "amber" : "green",
      timeRemainingMs: due.getTime() - completed.getTime(),
      hoursRemaining: 0,
      minutesRemaining: 0,
      isOverdue: false,
      isCompleted: true,
      isLate: isLateCompleted,
      humanCountdown: isLateCompleted ? "Submitted Late" : "Completed",
      formattedDueDate,
    };
  }

  const timeRemainingMs = due.getTime() - now.getTime();
  const hoursRemaining = timeRemainingMs / (1000 * 60 * 60);
  const minutesRemaining = Math.floor(timeRemainingMs / (1000 * 60));
  const isOverdue = timeRemainingMs <= 0;
  const humanCountdown = getHumanCountdown(timeRemainingMs);

  if (isOverdue) {
    return {
      status: "OVERDUE",
      priority: "URGENT",
      color: "red",
      timeRemainingMs,
      hoursRemaining,
      minutesRemaining,
      isOverdue: true,
      isCompleted: false,
      isLate: true,
      humanCountdown,
      formattedDueDate,
    };
  }

  if (hoursRemaining <= thresholds.urgentHours) {
    return {
      status: "URGENT",
      priority: "URGENT",
      color: "red",
      timeRemainingMs,
      hoursRemaining,
      minutesRemaining,
      isOverdue: false,
      isCompleted: false,
      isLate: false,
      humanCountdown,
      formattedDueDate,
    };
  }

  if (hoursRemaining <= thresholds.approachingHours) {
    return {
      status: "APPROACHING",
      priority: "IMPORTANT",
      color: "yellow",
      timeRemainingMs,
      hoursRemaining,
      minutesRemaining,
      isOverdue: false,
      isCompleted: false,
      isLate: false,
      humanCountdown,
      formattedDueDate,
    };
  }

  return {
    status: "HEALTHY",
    priority: "INFO",
    color: "green",
    timeRemainingMs,
    hoursRemaining,
    minutesRemaining,
    isOverdue: false,
    isCompleted: false,
    isLate: false,
    humanCountdown,
    formattedDueDate,
  };
}
