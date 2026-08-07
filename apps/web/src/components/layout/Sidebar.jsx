import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { useChatStore } from "../../store/chatStore";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  Calendar,
  MessageSquare,
  Megaphone,
  CalendarCheck,
  DollarSign,
  Library,
  FileText,
  Brain,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  AlertTriangle,
  Clock,
  UserCog,
  CreditCard,
  GraduationCap,
} from "lucide-react";
import clsx from "clsx";

const NAV_CONFIG = {
  ADMIN: [
    {
      section: "nav.section_overview",
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: "nav.dashboard" },
      ],
    },
    {
      section: "nav.section_academic",
      items: [
        { to: "/students", icon: GraduationCap, label: "nav.students" },
        { to: "/classes", icon: Users, label: "nav.classes" },
        { to: "/subjects", icon: BookOpen, label: "nav.subjects" },
        { to: "/assignments", icon: ClipboardList, label: "nav.assignments" },
        { to: "/exams", icon: CheckSquare, label: "nav.exams" },
        { to: "/grades", icon: BookOpen, label: "nav.grades" },
        { to: "/timetable", icon: Calendar, label: "nav.timetable" },
        { to: "/attendance", icon: CalendarCheck, label: "nav.attendance" },
        { to: "/behaviour", icon: AlertTriangle, label: "nav.behaviour" },
      ],
    },
    {
      section: "nav.section_communication",
      items: [
        { to: "/chat", icon: MessageSquare, label: "nav.chat", badge: "chat" },
        { to: "/announcements", icon: Megaphone, label: "nav.announcements" },
        { to: "/meetings", icon: Clock, label: "nav.meetings" },
      ],
    },
    {
      section: "nav.section_management",
      items: [
        { to: "/fees", icon: DollarSign, label: "nav.fees" },
        { to: "/library", icon: Library, label: "nav.library" },
        { to: "/staff", icon: UserCog, label: "nav.staff_hr" },
        { to: "/files", icon: FileText, label: "nav.files" },
        { to: "/ai", icon: Brain, label: "nav.ai_insights" },
      ],
    },
    {
      section: "nav.section_settings",
      items: [
        { to: "/settings/profile", icon: Settings, label: "nav.profile" },
        { to: "/settings/school", icon: UserCog, label: "nav.school_config" },
        { to: "/settings/billing", icon: CreditCard, label: "nav.billing" },
      ],
    },
  ],

  TEACHER: [
    {
      section: "nav.section_overview",
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: "nav.dashboard" },
      ],
    },
    {
      section: "nav.section_academic",
      items: [
        { to: "/students", icon: GraduationCap, label: "nav.my_students" },
        { to: "/assignments", icon: ClipboardList, label: "nav.assignments" },
        { to: "/exams", icon: CheckSquare, label: "nav.exams" },
        { to: "/grades", icon: BookOpen, label: "nav.grades" },
        { to: "/timetable", icon: Calendar, label: "nav.timetable" },
        { to: "/attendance", icon: CalendarCheck, label: "nav.attendance" },
        { to: "/behaviour", icon: AlertTriangle, label: "nav.behaviour" },
      ],
    },
    {
      section: "nav.section_communication",
      items: [
        { to: "/chat", icon: MessageSquare, label: "nav.chat", badge: "chat" },
        { to: "/announcements", icon: Megaphone, label: "nav.announcements" },
        { to: "/meetings", icon: Clock, label: "nav.meetings" },
      ],
    },
    {
      section: "nav.section_resources",
      items: [
        { to: "/files", icon: FileText, label: "nav.files" },
        { to: "/library", icon: Library, label: "nav.library" },
        {
          to: "/staff/leave",
          icon: CalendarCheck,
          label: "nav.leave_requests",
        },
      ],
    },
    {
      section: "nav.section_settings",
      items: [
        { to: "/settings/profile", icon: Settings, label: "nav.profile" },
      ],
    },
  ],

  FINANCE: [
    {
      section: "nav.section_overview",
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: "nav.dashboard" },
      ],
    },
    {
      section: "nav.section_finance",
      items: [
        { to: "/fees", icon: DollarSign, label: "nav.fees" },
        { to: "/settings/billing", icon: CreditCard, label: "nav.billing" },
      ],
    },
    {
      section: "nav.section_communication",
      items: [
        { to: "/chat", icon: MessageSquare, label: "nav.chat", badge: "chat" },
        { to: "/announcements", icon: Megaphone, label: "nav.announcements" },
      ],
    },
    {
      section: "nav.section_settings",
      items: [
        { to: "/settings/profile", icon: Settings, label: "nav.profile" },
      ],
    },
  ],

  STUDENT: [
    {
      section: "nav.section_overview",
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: "nav.dashboard" },
      ],
    },
    {
      section: "nav.section_my_learning",
      items: [
        { to: "/assignments", icon: ClipboardList, label: "nav.assignments" },
        { to: "/exams", icon: CheckSquare, label: "nav.exams" },
        { to: "/grades", icon: BookOpen, label: "nav.my_grades" },
        { to: "/timetable", icon: Calendar, label: "nav.timetable" },
        { to: "/attendance", icon: CalendarCheck, label: "nav.attendance" },
      ],
    },
    {
      section: "nav.section_connect",
      items: [
        { to: "/chat", icon: MessageSquare, label: "nav.chat", badge: "chat" },
        { to: "/announcements", icon: Megaphone, label: "nav.announcements" },
      ],
    },
    {
      section: "nav.section_resources",
      items: [
        { to: "/files", icon: FileText, label: "nav.resources" },
        { to: "/library", icon: Library, label: "nav.library" },
        { to: "/fees", icon: DollarSign, label: "nav.my_fees" },
        { to: "/ai", icon: Brain, label: "nav.ai_tutor" },
      ],
    },
    {
      section: "nav.section_settings",
      items: [
        { to: "/settings/profile", icon: Settings, label: "nav.profile" },
      ],
    },
  ],

  PARENT: [
    {
      section: "nav.section_overview",
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: "nav.dashboard" },
      ],
    },
    {
      section: "nav.section_child_progress",
      items: [
        { to: "/grades", icon: BookOpen, label: "nav.grades" },
        { to: "/attendance", icon: CalendarCheck, label: "nav.attendance" },
        { to: "/assignments", icon: ClipboardList, label: "nav.assignments" },
        { to: "/behaviour", icon: AlertTriangle, label: "nav.behaviour" },
      ],
    },
    {
      section: "nav.section_communicate",
      items: [
        {
          to: "/chat",
          icon: MessageSquare,
          label: "nav.messages",
          badge: "chat",
        },
        { to: "/announcements", icon: Megaphone, label: "nav.announcements" },
        { to: "/meetings", icon: Clock, label: "nav.meetings" },
      ],
    },
    {
      section: "nav.section_admin",
      items: [{ to: "/fees", icon: DollarSign, label: "nav.fees_payments" }],
    },
    {
      section: "nav.section_settings",
      items: [
        { to: "/settings/profile", icon: Settings, label: "nav.profile" },
      ],
    },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, collapseSidebar, sidebarOpen } = useUIStore();
  const { totalUnread } = useChatStore();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const navItems = NAV_CONFIG[user?.role] ?? NAV_CONFIG.STUDENT;
  const unread = totalUnread();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside
      className={clsx(
        "flex flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800",
        "transition-all duration-300 z-30 flex-shrink-0",
        "fixed lg:relative h-full",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        sidebarCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        {!sidebarCollapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-lg">
              TimhirtHub
            </span>
          </Link>
        )}
        <button
          onClick={collapseSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 ml-auto"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-hide">
        {navItems.map((section) => (
          <div key={section.section}>
            {!sidebarCollapsed && (
              <p className="nav-section">{t(section.section)}</p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(isActive ? "nav-item-active" : "nav-item", "relative")
                }
                title={sidebarCollapsed ? t(item.label) : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="flex-1">{t(item.label)}</span>
                )}
                {item.badge === "chat" && unread > 0 && (
                  <span
                    className={clsx(
                      "bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-bold",
                      sidebarCollapsed
                        ? "absolute top-1 right-1 w-4 h-4 text-[10px]"
                        : "w-5 h-5",
                    )}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User profile footer */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-3 flex-shrink-0">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-400 truncate capitalize">
                {user?.role?.toLowerCase()}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
              title={t("common.logout")}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex justify-center"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
