import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import clsx from "clsx";
import OfflineStatusBadge from "../shared/OfflineStatusBadge";
import { Avatar } from "../ui/index";

export default function Topbar() {
  const { user } = useAuthStore();
  const { toggleSidebar, theme, setTheme } = useUIStore();
  const { locale, setLocale, locales } = useTranslation();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () =>
      api.get("/notifications?unread=true&limit=10").then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
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
  const unreadCount = notifData?.unreadCount ?? 0;

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

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 gap-3 flex-shrink-0">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title (dynamic via document.title) */}
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

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((o) => !o)}
          className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 z-50 animate-slide-in overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => setNotifOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">
                  No new notifications
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={clsx(
                      "px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800/50",
                      !n.isRead && "bg-primary-50/50 dark:bg-primary-900/10",
                    )}
                    onClick={() => {
                      setNotifOpen(false);
                      navigate("/dashboard");
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">
                        {NOTIF_ICON[n.type] ?? "🔔"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(n.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      {!n.isRead && (
                        <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => {
                  setNotifOpen(false);
                  navigate("/dashboard");
                }}
                className="text-xs text-primary-600 hover:underline w-full text-center"
              >
                View all notifications
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
