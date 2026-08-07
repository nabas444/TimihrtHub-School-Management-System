import { useNavigate } from "react-router-dom";
import {
  Plus,
  CalendarCheck,
  MessageSquare,
  FileText,
  ClipboardList,
} from "lucide-react";
import { Badge } from "../../../components/ui/index";
import { useTranslation } from "../../../lib/i18n/I18nProvider";

// ── QuickActions ──────────────────────────────────────────────────────────────
export function QuickActions({ role }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const actions = {
    ADMIN: [
      {
        label: t("dashboard.action_add_student"),
        icon: Plus,
        to: "/students",
        color: "bg-primary-600 text-white",
      },
      {
        label: t("dashboard.action_announce"),
        icon: FileText,
        to: "/announcements",
        color: "bg-amber-500 text-white",
      },
      {
        label: t("dashboard.action_mark_attend"),
        icon: CalendarCheck,
        to: "/attendance/mark",
        color: "bg-green-600 text-white",
      },
      {
        label: t("dashboard.action_send_message"),
        icon: MessageSquare,
        to: "/chat",
        color: "bg-purple-600 text-white",
      },
    ],
    TEACHER: [
      {
        label: t("dashboard.action_new_assignment"),
        icon: ClipboardList,
        to: "/assignments",
        color: "bg-primary-600 text-white",
      },
      {
        label: t("dashboard.action_mark_attendance"),
        icon: CalendarCheck,
        to: "/attendance/mark",
        color: "bg-green-600 text-white",
      },
      {
        label: t("dashboard.action_message"),
        icon: MessageSquare,
        to: "/chat",
        color: "bg-purple-600 text-white",
      },
    ],
    PARENT: [
      {
        label: t("dashboard.action_message_teacher"),
        icon: MessageSquare,
        to: "/chat",
        color: "bg-primary-600 text-white",
      },
      {
        label: t("dashboard.action_book_meeting"),
        icon: CalendarCheck,
        to: "/meetings",
        color: "bg-green-600 text-white",
      },
      {
        label: t("dashboard.action_view_fees"),
        icon: FileText,
        to: "/fees",
        color: "bg-amber-500 text-white",
      },
    ],
    STUDENT: [
      {
        label: t("dashboard.action_my_assignments"),
        icon: ClipboardList,
        to: "/assignments",
        color: "bg-primary-600 text-white",
      },
      {
        label: t("dashboard.action_chat"),
        icon: MessageSquare,
        to: "/chat",
        color: "bg-purple-600 text-white",
      },
    ],
  };

  const items = actions[role] ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((a) => (
        <button
          key={a.label}
          onClick={() => navigate(a.to)}
          className={`btn text-sm ${a.color} shadow-sm`}
        >
          <a.icon className="w-4 h-4" /> {a.label}
        </button>
      ))}
    </div>
  );
}

// ── UpcomingExams ─────────────────────────────────────────────────────────────
export function UpcomingExams({ exams = [] }) {
  const { t } = useTranslation();
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-900">
          {t("dashboard.upcoming_exams")}
        </h3>
        <Badge variant="blue">{exams.length}</Badge>
      </div>
      <div className="divide-y divide-gray-50">
        {exams.length === 0 && (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">
            {t("dashboard.no_upcoming_exams")}
          </p>
        )}
        {exams.map((e) => (
          <div
            key={e.id}
            className="px-6 py-3 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {e.subject?.name}
              </p>
              <p className="text-xs text-gray-500">
                {e.title} · {e.class?.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-primary-600">
                {new Date(e.scheduledAt).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(e.scheduledAt).toLocaleTimeString("en", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RecentActivity ────────────────────────────────────────────────────────────
export function RecentActivity({ results }) {
  const { t } = useTranslation();
  const exams = results?.examResults ?? [];
  const subs = results?.submissionResults ?? [];

  const all = [
    ...exams.map((r) => ({
      type: "exam",
      label: r.exam?.subject?.name,
      detail: r.exam?.title,
      score: r.marksObtained,
      total: r.exam?.totalMarks,
      date: r.exam?.scheduledAt,
    })),
    ...subs.map((r) => ({
      type: "hw",
      label: r.assignment?.subject?.name,
      detail: r.assignment?.title,
      score: r.marksObtained,
      total: r.assignment?.totalMarks,
      date: r.gradedAt,
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  const pct = (s, tot) => (tot ? Math.round((s / tot) * 100) : 0);
  const color = (p) =>
    p >= 70 ? "badge-green" : p >= 50 ? "badge-yellow" : "badge-red";

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-900">
          {t("dashboard.recent_grades")}
        </h3>
      </div>
      <div className="divide-y divide-gray-50">
        {all.length === 0 && (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">
            {t("dashboard.no_grades_yet")}
          </p>
        )}
        {all.map((item, i) => (
          <div key={i} className="px-6 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
            </div>
            <span
              className={color(pct(item.score, item.total)) + " badge ml-2"}
            >
              {item.score}/{item.total} ({pct(item.score, item.total)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
