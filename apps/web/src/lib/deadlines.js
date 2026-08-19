/**
 * TimhirtHub Client-Side Unified Deadline & Timezone Engine
 * Computes time-based statuses (Healthy, Approaching, Urgent, Overdue)
 * using the configured school timezone.
 */

export const DEFAULT_THRESHOLDS = {
  approachingHours: 24,
  urgentHours: 2,
};

/**
 * Format a Date in the school's configured timezone
 */
export function formatInSchoolTimezone(
  date,
  timezone = "Africa/Addis_Ababa",
  options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "Africa/Addis_Ababa",
      ...options,
    }).format(d);
  } catch (err) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Addis_Ababa",
      ...options,
    }).format(d);
  }
}

/**
 * Human-readable countdown string from milliseconds
 */
export function getHumanCountdown(timeRemainingMs) {
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
    if (remainingMinutes > 0) return `${remainingMinutes}m left`;
    return "Due now";
  }
}

/**
 * Unified Deadline Evaluation function for UI
 */
export function evaluateDeadline(
  dueDate,
  timezone = "Africa/Addis_Ababa",
  completedAt = null,
  customThresholds = {}
) {
  if (!dueDate) {
    return {
      status: "HEALTHY",
      priority: "INFO",
      color: "gray",
      isOverdue: false,
      isCompleted: false,
      humanCountdown: "No deadline",
      formattedDueDate: "—",
    };
  }

  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const completed = completedAt ? (typeof completedAt === "string" ? new Date(completedAt) : completedAt) : null;
  const now = new Date();

  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...customThresholds,
  };

  const formattedDueDate = formatInSchoolTimezone(due, timezone);

  // If already completed / submitted
  if (completed && !isNaN(completed.getTime())) {
    const isLateCompleted = completed.getTime() > due.getTime();
    return {
      status: isLateCompleted ? "LATE_COMPLETED" : "COMPLETED",
      priority: "INFO",
      color: isLateCompleted ? "amber" : "green",
      badgeVariant: isLateCompleted ? "yellow" : "green",
      timeRemainingMs: due.getTime() - completed.getTime(),
      hoursRemaining: 0,
      minutesRemaining: 0,
      isOverdue: false,
      isCompleted: true,
      isLate: isLateCompleted,
      humanCountdown: isLateCompleted ? "Submitted Late" : "Submitted",
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
      badgeVariant: "red",
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
      badgeVariant: "red",
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
      badgeVariant: "yellow",
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
    badgeVariant: "green",
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
