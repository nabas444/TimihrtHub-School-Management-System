import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import api from "../../lib/api";
import StatCard from "../../components/shared/StatCard";
import AttendanceTrendChart from "../../components/charts/AttendanceTrendChart";
import {
  RecentActivity,
  UpcomingExams,
  QuickActions,
} from "./components/index";
import PageLoader from "../../components/ui/PageLoader";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import {
  GraduationCap,
  Users,
  BookOpen,
  DollarSign,
  CalendarCheck,
  AlertTriangle,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { useEffect } from "react";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, isAdmin, isTeacher, isStudent, isParent, isFinance } =
    useAuthStore();

  useEffect(() => {
    document.title = "Dashboard — TimhirtHub";
  }, []);

  // Role-based data fetching
  const { data: adminStats, isLoading: adminLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get("/schools/dashboard").then((r) => r.data.data),
    enabled: isAdmin() || isTeacher() || isFinance(),
  });

  const { data: studentResults } = useQuery({
    queryKey: ["my-results"],
    queryFn: () => api.get("/academics/results").then((r) => r.data.data),
    enabled: isStudent(),
  });

  const { data: myAttendance } = useQuery({
    queryKey: ["my-attendance"],
    queryFn: () => api.get("/attendance/me").then((r) => r.data.data),
    enabled: isStudent(),
  });

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get("/announcements?limit=3").then((r) => r.data.data),
  });

  const firstName = user?.firstName;

  if (adminLoading && (isAdmin() || isTeacher())) return <PageLoader />;

  // ── ADMIN DASHBOARD ────────────────────────────────────────────────────────
  if (isAdmin() || isTeacher()) {
    const d = adminStats;
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {t("dashboard.greeting_morning")}, {firstName} 👋
            </h1>
            <p className="page-subtitle">{t("dashboard.subtitle_admin")}</p>
          </div>
          <QuickActions role={user?.role} />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={GraduationCap}
            label={t("dashboard.stat_total_students")}
            value={d?.users?.students ?? 0}
            color="blue"
            delta={t("dashboard.new_students_this_week")}
          />
          <StatCard
            icon={Users}
            label={t("dashboard.stat_teachers")}
            value={d?.users?.teachers ?? 0}
            color="purple"
          />
          <StatCard
            icon={CalendarCheck}
            label={t("dashboard.stat_today_present")}
            value={d?.todayAttendance?.present ?? 0}
            color="green"
            delta={`${d?.todayAttendance?.rate ?? 0}% ${t("dashboard.rate_suffix")}`}
          />
          <StatCard
            icon={DollarSign}
            label={t("dashboard.stat_overdue_fees")}
            value={d?.overdueInvoices ?? 0}
            color="red"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={ClipboardList}
            label={t("dashboard.stat_active_assignments")}
            value={d?.pendingAssignments ?? 0}
            color="amber"
          />
          <StatCard
            icon={BookOpen}
            label={t("dashboard.stat_monthly_attendance")}
            value={`${d?.monthlyAttendanceRate ?? 0}%`}
            color="green"
          />
          <StatCard
            icon={TrendingUp}
            label={t("dashboard.stat_merits")}
            value={d?.behaviour?.merits ?? 0}
            color="green"
          />
          <StatCard
            icon={AlertTriangle}
            label={t("dashboard.stat_demerits")}
            value={d?.behaviour?.demerits ?? 0}
            color="red"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={DollarSign}
            label={t("dashboard.stat_fee_collection_rate")}
            value={`${d?.feeCollection?.collectionRate ?? 0}%`}
            color="blue"
            delta={`${d?.feeCollection?.totalCollected?.toLocaleString?.() ?? 0} ${t("dashboard.collected_suffix")}`}
          />
        </div>

        {/* Charts + widgets */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AttendanceTrendChart />
          </div>
          <UpcomingExams exams={d?.upcomingExams ?? []} />
        </div>

        {/* Academic performance (pass/fail rate, best-performing & at-risk students) */}
        {d?.academicPerformance ? (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {t("dashboard.academic_performance_heading")} —{" "}
                {d.academicPerformance.termName}
              </h3>
              <span className="text-sm text-gray-500">
                {d.academicPerformance.totalStudentsGraded}{" "}
                {t("dashboard.students_graded_suffix")}
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-4 p-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {t("dashboard.pass_rate")}
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {d.academicPerformance.passFailRate?.passRate ?? 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {d.academicPerformance.passFailRate?.passed ?? 0}{" "}
                  {t("dashboard.passed_suffix")} ·{" "}
                  {d.academicPerformance.passFailRate?.failed ?? 0}{" "}
                  {t("dashboard.failed_suffix")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {t("dashboard.top_performers")}
                </p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {(d.academicPerformance.topPerformers ?? [])
                    .slice(0, 3)
                    .map((s) => (
                      <li key={s.studentId}>
                        #{s.rank ?? "–"} {s.name}{" "}
                        <span className="text-gray-400">
                          ({s.percentage?.toFixed(1)}%)
                        </span>
                      </li>
                    ))}
                  {(d.academicPerformance.topPerformers ?? []).length === 0 && (
                    <li className="text-gray-400">
                      {t("dashboard.no_data_yet")}
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {t("dashboard.at_risk_students")}
                </p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {(d.academicPerformance.atRisk ?? []).slice(0, 3).map((s) => (
                    <li key={s.studentId} className="text-red-600">
                      {s.name}{" "}
                      <span className="text-gray-400">
                        ({s.percentage?.toFixed(1)}%)
                      </span>
                    </li>
                  ))}
                  {(d.academicPerformance.atRisk ?? []).length === 0 && (
                    <li className="text-gray-400">
                      {t("dashboard.none_below_threshold")}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {/* Recent announcements */}
        {announcements?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900">
                {t("dashboard.recent_announcements")}
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {announcements.map((a) => (
                <div key={a.id} className="px-6 py-4">
                  <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                  <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                    {a.content}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(a.publishedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── FINANCE DASHBOARD ─────────────────────────────────────────────────────
  if (isFinance()) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Finance Dashboard</h1>
            <p className="page-subtitle">
              Manage fees, payments, and financial overview for your school.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatCard
            icon={DollarSign}
            label="Open invoices"
            value={adminStats?.overdueInvoices ?? 0}
            color="red"
          />
          <StatCard
            icon={TrendingUp}
            label="Collection rate"
            value={`${adminStats?.feeCollection?.collectionRate ?? 0}%`}
            color="blue"
          />
          <StatCard
            icon={Users}
            label="Total students"
            value={adminStats?.users?.students ?? 0}
            color="green"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              Recent announcements
            </h3>
            <div className="space-y-3">
              {(announcements ?? []).map((a) => (
                <div key={a.id}>
                  <p className="text-sm font-semibold text-slate-900">
                    {a.title}
                  </p>
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {a.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Quick actions</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                Use the Fees menu to review invoices, record payments, and
                export receipts.
              </p>
              <p>
                Use Billing to manage your school subscription and payment
                portal.
              </p>
              <p>Contact the admin team for policy or fee structure changes.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STUDENT DASHBOARD ──────────────────────────────────────────────────────
  if (isStudent()) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {t("dashboard.greeting_student")}, {firstName}! 📚
            </h1>
            <p className="page-subtitle">{t("dashboard.subtitle_student")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={CalendarCheck}
            label={t("nav.attendance")}
            value={`${myAttendance?.percentage ?? 0}%`}
            color={myAttendance?.percentage >= 75 ? "green" : "red"}
          />
          <StatCard
            icon={ClipboardList}
            label={t("dashboard.stat_pending_work")}
            value={
              studentResults?.submissionResults?.filter(
                (s) => s.status === "PENDING",
              ).length ?? 0
            }
            color="amber"
          />
          <StatCard
            icon={BookOpen}
            label={t("dashboard.stat_exams_this_term")}
            value={studentResults?.examResults?.length ?? 0}
            color="blue"
          />
          <StatCard
            icon={TrendingUp}
            label={t("dashboard.stat_last_grade")}
            value={
              studentResults?.examResults?.[0]
                ? `${studentResults.examResults[0].marksObtained}/${studentResults.examResults[0].exam.totalMarks}`
                : t("dashboard.not_available")
            }
            color="purple"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <RecentActivity results={studentResults} />
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold">{t("dashboard.announcements")}</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {(announcements ?? []).map((a) => (
                <div key={a.id} className="px-6 py-4">
                  <p className="font-medium text-sm text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {a.content}
                  </p>
                </div>
              ))}
              {!announcements?.length && (
                <p className="px-6 py-4 text-sm text-gray-400">
                  {t("dashboard.no_announcements")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PARENT DASHBOARD ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {t("dashboard.greeting_parent")}, {firstName} 👨‍👩‍👧
          </h1>
          <p className="page-subtitle">{t("dashboard.subtitle_parent")}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">
              {t("dashboard.recent_announcements")}
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {(announcements ?? []).map((a) => (
              <div key={a.id} className="px-6 py-4">
                <p className="font-medium text-sm text-gray-900">{a.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {a.content}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(a.publishedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
        <QuickActions role={user?.role} />
      </div>
    </div>
  );
}
