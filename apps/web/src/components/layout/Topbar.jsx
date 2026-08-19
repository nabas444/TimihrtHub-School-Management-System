import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Menu,
  Sun,
  Moon,
  Search,
  X,
  Check,
  Languages,
  ArrowRight,
  Trash2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import clsx from "clsx";
import OfflineStatusBadge from "../shared/OfflineStatusBadge";
import { Avatar } from "../ui/index";
import { formatInSchoolTimezone } from "../../lib/deadlines";

export default function Topbar() {
  const { user } = useAuthStore();
  const { toggleSidebar, theme, setTheme } = useUIStore();
  const { locale, setLocale, locales } = useTranslation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState("ALL"); // "ALL" | "UNREAD" | "URGENT"
  const notifRef = useRef(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const timezone = user?.school?.timezone || "Africa/Addis_Ababa";

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications?limit=30").then((r) => r.data.data),
    refetchInterval: 15000,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markSingleRead = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteNotif = useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))
        setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? notifications.filter((n) => !n.isRead).length;

  const filteredNotifs = useMemo(() => {
    if (notifTab === "UNREAD") return notifications.filter((n) => !n.isRead);
    if (notifTab === "URGENT")
      return notifications.filter(
        (n) => n.data?.priority === "URGENT" || n.data?.priority === "IMPORTANT"
      );
    return notifications;
  }, [notifications, notifTab]);

  const NOTIF_ICON = {
    GRADE: "📊",
    ASSIGNMENT: "📚",
    ATTENDANCE: "📋",
    BEHAVIOUR: "⚠️",
    FEE: "💰",
    EXAM: "📝",
    CHAT: "💬",
    MEETING: "📅",
    GENERAL: "🔔",
    ANNOUNCEMENT: "📢",
  };

  const handleNotificationClick = (n) => {
    if (!n.isRead) {
      markSingleRead.mutate(n.id);
    }
    setNotifOpen(false);

    if (n.data?.link) {
      navigate(n.data.link);
    } else if (n.assignmentId) {
      navigate(`/assignments/${n.assignmentId}`);
    } else if (n.type === "ASSIGNMENT") {
      navigate("/assignments");
    } else if (n.type === "ATTENDANCE") {
      navigate("/attendance");
    } else if (n.type === "GRADE" || n.type === "EXAM") {
      navigate("/grades");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 gap-3 flex-shrink-0">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title space */}
      <div className="flex-1" />

      <OfflineStatusBadge />

      {/* Language switcher */}
      <div className="relative flex items-center">
        <Languages className="w-4 h-4 text-gray-400 absolute left-2.5 pointer-events-none" />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          aria-label="Language"
          className="pl-8 pr-6 py-1.5 rounded-xl text-sm bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 border-none focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
        >
          {locales.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
      >
        {theme === "dark" ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </button>

      {/* ── Notification Center Dropdown ──────────────────────────────────── */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((o) => !o)}
          className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-all"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-12 w-88 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 z-50 animate-slide-in overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-primary-600" />
                  Notifications & Reminders
                </h3>
                <span className="text-[10px] text-gray-400">
                  School Time: {formatInSchoolTimezone(new Date(), timezone, { hour: "2-digit", minute: "2-digit" })} ({timezone})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => setNotifOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-[11px]">
              {[
                { id: "ALL", label: `All (${notifications.length})` },
                { id: "UNREAD", label: `Unread (${unreadCount})` },
                {
                  id: "URGENT",
                  label: `Urgent / Priority (${
                    notifications.filter(
                      (n) => n.data?.priority === "URGENT" || n.data?.priority === "IMPORTANT"
                    ).length
                  })`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setNotifTab(tab.id)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap",
                    notifTab === tab.id
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-2xs"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Notification Items List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {filteredNotifs.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  <Bell className="w-6 h-6 mx-auto mb-1.5 text-gray-300 dark:text-gray-700" />
                  No notifications to display
                </div>
              ) : (
                filteredNotifs.map((n) => {
                  const priority = n.data?.priority || "INFO";
                  return (
                    <div
                      key={n.id}
                      className={clsx(
                        "p-3.5 hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-all cursor-pointer flex items-start gap-3 group relative",
                        !n.isRead && "bg-primary-50/40 dark:bg-primary-950/20"
                      )}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <span className="text-xl flex-shrink-0 mt-0.5">
                        {NOTIF_ICON[n.type] ?? "🔔"}
                      </span>

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {n.title}
                          </p>

                          {/* Priority Badge */}
                          {priority === "URGENT" && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-red-100 text-red-800 border border-red-200 animate-pulse">
                              🔴 URGENT
                            </span>
                          )}
                          {priority === "IMPORTANT" && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              🟡 IMPORTANT
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>

                        <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-gray-400">
                          <span>
                            {formatInSchoolTimezone(n.createdAt, timezone, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-primary-600 dark:text-primary-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5">
                            View Action <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>

                      {/* Unread indicator */}
                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary-600 mt-1 flex-shrink-0" />
                      )}

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotif.mutate(n.id);
                        }}
                        className="absolute right-2.5 top-2.5 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-medium">
                {unreadCount} unread alert{unreadCount !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => {
                  setNotifOpen(false);
                  navigate("/assignments");
                }}
                className="text-primary-600 hover:underline font-bold"
              >
                Go to Academic Deadlines →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User avatar */}
      <button
        className="rounded-full overflow-hidden border border-gray-200 dark:border-gray-700"
        onClick={() => navigate("/settings/profile")}
        type="button"
      >
        <Avatar
          src={user?.avatar}
          name={`${user?.firstName ?? "?"} ${user?.lastName ?? ""}`}
          size="md"
        />
      </button>
    </header>
  );
}
