import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  Plus,
  Download,
  Users,
  Clock,
  ShieldAlert,
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  FileText,
  Search,
  Filter,
  Save,
  Trash2,
  Check,
  ArrowRight,
  Sparkles,
  HelpCircle,
  GraduationCap,
  Briefcase,
  Building2,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import StatCard from "../../components/shared/StatCard";
import AttendanceTrendChart from "../../components/charts/AttendanceTrendChart";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, Avatar, EmptyState } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import { useAuthStore } from "../../store/authStore";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import clsx from "clsx";
import toast from "react-hot-toast";

// ── Student Attendance Sheet PDF Downloader ─────────────────────────────────
function AttendanceSheetDownload() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [downloading, setDownloading] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
  });

  const handleDownload = async () => {
    if (!classId) {
      toast.error(t("attendance.overview.sheet_select_class_first"));
      return;
    }
    setDownloading(true);
    try {
      await downloadFile(
        `/attendance/class/${classId}/sheet?startDate=${startDate}&endDate=${endDate}`,
        `attendance-sheet-${startDate}-to-${endDate}.pdf`,
      );
    } catch {
      toast.error(t("attendance.overview.sheet_download_error"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card p-5 bg-white border border-gray-200 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          {t("attendance.class_label")}
        </label>
        <select
          className="input text-xs"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">{t("attendance.overview.sheet_select_class_option")}</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          {t("attendance.overview.from_label")}
        </label>
        <input
          type="date"
          className="input text-xs"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          {t("attendance.overview.to_label")}
        </label>
        <input
          type="date"
          className="input text-xs"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      <button
        className="btn-secondary text-xs inline-flex items-center gap-1.5"
        onClick={handleDownload}
        disabled={downloading}
      >
        <Download className="w-4 h-4" />{" "}
        {downloading
          ? t("attendance.overview.preparing")
          : t("attendance.overview.download_sheet_button")}
      </button>
    </div>
  );
}

export default function AttendancePage() {
  const { t } = useTranslation();
  const { user, isStudent, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();

  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Admin Tab: "STAFF_DAILY" | "STAFF_ANALYTICS" | "PENALTIES_RULES" | "STUDENT_REPORTS"
  const [adminTab, setAdminTab] = useState(isAdmin() ? "STAFF_DAILY" : "STUDENT");

  // Filter States
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [staffSearch, setStaffSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL"); // "ALL" | "TEACHER" | "FINANCE" | "ADMIN"
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "UNRECORDED"
  const [viewMode, setViewMode] = useState("GROUPED"); // "GROUPED" | "FLAT"

  const [analyticsRange, setAnalyticsRange] = useState({
    startDate: thirtyDaysAgoStr,
    endDate: todayStr,
  });

  // Modal States
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [selectedStaffForPenalty, setSelectedStaffForPenalty] = useState(null);
  const [penaltyForm, setPenaltyForm] = useState({
    type: "SALARY_DEDUCTION",
    reason: "",
    amount: "500",
    currency: "ETB",
    demeritPoints: "5",
    actionNotes: "",
  });

  const [editAttendanceModal, setEditAttendanceModal] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState({
    status: "PRESENT",
    checkInTime: "08:00",
    checkOutTime: "16:30",
    expectedTime: "08:00",
    lateMinutes: 0,
    notes: "",
  });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ["my-attendance"],
    queryFn: () => api.get("/attendance/me").then((r) => r.data.data),
    enabled: isStudent(),
  });

  const { data: staffDailyData, isLoading: staffDailyLoading } = useQuery({
    queryKey: [
      "staff-attendance-daily",
      selectedDate,
      staffSearch,
      activeCategory,
    ],
    queryFn: () =>
      api
        .get(
          `/attendance/staff?date=${selectedDate}&search=${encodeURIComponent(
            staffSearch,
          )}&category=${activeCategory}`,
        )
        .then((r) => r.data.data),
    enabled: isAdmin() && adminTab === "STAFF_DAILY",
  });

  const { data: staffAnalyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: [
      "staff-punctuality-analytics",
      analyticsRange.startDate,
      analyticsRange.endDate,
      staffSearch,
      activeCategory,
    ],
    queryFn: () =>
      api
        .get(
          `/attendance/staff/analytics?startDate=${
            analyticsRange.startDate
          }&endDate=${analyticsRange.endDate}&search=${encodeURIComponent(
            staffSearch,
          )}&category=${activeCategory}`,
        )
        .then((r) => r.data.data),
    enabled: isAdmin() && adminTab === "STAFF_ANALYTICS",
  });

  const { data: penaltiesData, isLoading: penaltiesLoading } = useQuery({
    queryKey: ["staff-penalties"],
    queryFn: () => api.get("/attendance/staff/penalties").then((r) => r.data.data),
    enabled: isAdmin() && adminTab === "PENALTIES_RULES",
  });

  const { data: deadlinesSummary } = useQuery({
    queryKey: ["deadlines-summary"],
    queryFn: () => api.get("/deadlines/summary").then((r) => r.data.data),
    enabled: isAdmin() && adminTab === "STUDENT_REPORTS",
  });

  // ── Filtered Roster for Staff Daily View ────────────────────────────────────
  const filteredRoster = useMemo(() => {
    const rawList = staffDailyData?.roster ?? [];
    return rawList.filter((item) => {
      // Category filter
      if (activeCategory !== "ALL" && item.category !== activeCategory) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      // Client-side instant keyword match
      if (staffSearch.trim()) {
        const q = staffSearch.toLowerCase();
        const fullName = `${item.staff?.firstName || ""} ${
          item.staff?.lastName || ""
        }`.toLowerCase();
        const email = (item.staff?.email || "").toLowerCase();
        const empId = (item.employeeId || "").toLowerCase();
        const dept = (item.department || "").toLowerCase();
        const notes = (item.notes || "").toLowerCase();
        if (
          !fullName.includes(q) &&
          !email.includes(q) &&
          !empId.includes(q) &&
          !dept.includes(q) &&
          !notes.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [staffDailyData?.roster, activeCategory, statusFilter, staffSearch]);

  // Group roster by category
  const groupedRoster = useMemo(() => {
    const groups = {
      TEACHER: {
        title: "👨‍🏫 Teachers & Academic Faculty",
        icon: GraduationCap,
        items: [],
      },
      FINANCE: {
        title: "💰 Finance & Accounting Staff",
        icon: Briefcase,
        items: [],
      },
      ADMIN: {
        title: "🏛️ Administration & HR Management",
        icon: Building2,
        items: [],
      },
    };

    for (const item of filteredRoster) {
      if (groups[item.category]) {
        groups[item.category].items.push(item);
      } else {
        groups.ADMIN.items.push(item);
      }
    }
    return groups;
  }, [filteredRoster]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const recordAttendanceMutation = useMutation({
    mutationFn: (d) => api.post("/attendance/staff", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-attendance-daily"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Staff attendance record saved");
      setEditAttendanceModal(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save attendance");
    },
  });

  const batchRecordMutation = useMutation({
    mutationFn: (d) => api.post("/attendance/staff/batch", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-attendance-daily"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Batch attendance updated successfully");
    },
  });

  const issuePenaltyMutation = useMutation({
    mutationFn: (d) => api.post("/attendance/staff/penalties", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-penalties"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Disciplinary penalty issued successfully!");
      setPenaltyModalOpen(false);
      setPenaltyForm({
        type: "SALARY_DEDUCTION",
        reason: "",
        amount: "500",
        currency: "ETB",
        demeritPoints: "5",
        actionNotes: "",
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to issue penalty");
    },
  });

  const updatePenaltyStatusMutation = useMutation({
    mutationFn: ({ id, ...d }) =>
      api.patch(`/attendance/staff/penalties/${id}/status`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-penalties"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Penalty status updated");
    },
  });

  const deletePenaltyMutation = useMutation({
    mutationFn: (id) => api.delete(`/attendance/staff/penalties/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-penalties"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Penalty record removed");
    },
  });

  // Handle Quick Status Update
  const handleQuickStatus = (staffId, status) => {
    recordAttendanceMutation.mutate({
      staffId,
      date: selectedDate,
      status,
      checkInTime: status === "PRESENT" ? "08:00" : status === "LATE" ? "08:20" : null,
      expectedTime: "08:00",
      lateMinutes: status === "LATE" ? 20 : 0,
    });
  };

  // Mark all visible staff as Present
  const handleMarkAllPresent = () => {
    if (filteredRoster.length === 0) return;
    const records = filteredRoster.map((item) => ({
      staffId: item.staffId,
      status: "PRESENT",
      checkInTime: item.checkInTime || "08:00",
      expectedTime: "08:00",
      lateMinutes: 0,
    }));
    batchRecordMutation.mutate({ date: selectedDate, records });
  };

  // Handle opening penalty modal from analytics table
  const handleOpenPenaltyForStaff = (staffAssessment) => {
    setSelectedStaffForPenalty(staffAssessment.staff);
    setPenaltyForm({
      type: "SALARY_DEDUCTION",
      reason: `Chronic lateness and punctuality infraction (${staffAssessment.lateDays} late arrivals, ${staffAssessment.totalLateMinutes} total late mins, score: ${staffAssessment.punctualityScore}%).`,
      amount: "500",
      currency: "ETB",
      demeritPoints: "5",
      actionNotes: "Penalty assessed from monthly punctuality analytics.",
    });
    setPenaltyModalOpen(true);
  };

  if (myLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t("attendance.overview.title")}</h1>
          <p className="page-subtitle">
            {isStudent()
              ? t("attendance.overview.subtitle_student")
              : isAdmin()
              ? "Monitor faculty presence, staff punctuality analytics, disciplinary rules, and student attendance reports"
              : "Mark class attendance, review attendance trends, and export student reports"}
          </p>
        </div>

        {/* ONLY Teachers take student attendance */}
        {isTeacher() && (
          <div className="flex items-center gap-2">
            <Link to="/attendance/mark" className="btn-primary">
              <Plus className="w-4 h-4" /> {t("attendance.page_title")}
            </Link>
          </div>
        )}
      </div>

      {/* ── Admin Tab Switcher ──────────────────────────────────────────────── */}
      {isAdmin() && (
        <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto text-xs">
          {[
            { id: "STAFF_DAILY", label: "👔 Staff Presence & Register", icon: Clock },
            {
              id: "STAFF_ANALYTICS",
              label: "📊 Staff Punctuality Analytics & Assessment",
              icon: TrendingUp,
            },
            {
              id: "PENALTIES_RULES",
              label: "⚖️ Rules & Disciplinary Penalties",
              icon: ShieldAlert,
            },
            {
              id: "STUDENT_REPORTS",
              label: "📈 Student Attendance Reports & Analytics",
              icon: BarChart3,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id)}
                className={clsx(
                  "px-3.5 py-2 rounded-xl font-bold transition-all inline-flex items-center gap-1.5 whitespace-nowrap",
                  adminTab === tab.id
                    ? "bg-primary-600 text-white shadow-xs"
                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200",
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          1. STUDENT / TEACHER VIEW
         ══════════════════════════════════════════════════════════════════════════ */}
      {isStudent() && myData && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={CalendarCheck}
              label={t("attendance.overview.total_days")}
              value={myData.total}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label={t("attendance.present")}
              value={myData.present}
              color="green"
            />
            <StatCard
              icon={AlertTriangle}
              label={t("attendance.absent")}
              value={myData.absent}
              color="red"
            />
            <StatCard
              icon={CalendarCheck}
              label={t("attendance.overview.rate")}
              value={`${myData.percentage}%`}
              color={myData.percentage >= 75 ? "green" : "red"}
            />
          </div>

          {myData.percentage < 75 && (
            <div className="card card-body bg-red-50 border border-red-200">
              <p className="text-red-700 text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />{" "}
                {t("attendance.overview.below_threshold_warning")}
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold">
                {t("attendance.overview.recent_records")}
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {myData.recentRecords.map((r, i) => (
                <div
                  key={i}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <span className="text-sm text-gray-700">
                    {new Date(r.date).toLocaleDateString("en", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    {r.note && (
                      <span className="text-xs text-gray-400">{r.note}</span>
                    )}
                    <Badge
                      variant={
                        r.status === "PRESENT"
                          ? "green"
                          : r.status === "LATE"
                          ? "yellow"
                          : r.status === "EXCUSED"
                          ? "blue"
                          : "red"
                      }
                    >
                      {r.status === "PRESENT"
                        ? t("attendance.present")
                        : r.status === "LATE"
                        ? t("attendance.late")
                        : r.status === "EXCUSED"
                        ? t("attendance.excused")
                        : t("attendance.absent")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Teacher View */}
      {isTeacher() && (
        <div className="space-y-6">
          <AttendanceTrendChart />
          <AttendanceSheetDownload />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          2. STAFF PRESENCE & DAILY REGISTER TAB (Admin Only)
         ══════════════════════════════════════════════════════════════════════════ */}
      {isAdmin() && adminTab === "STAFF_DAILY" && (
        <div className="space-y-6">
          {/* Stat Cards for Today */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase block">
                Total Staff
              </span>
              <span className="text-2xl font-black text-gray-900">
                {staffDailyData?.totalStaff ?? 0}
              </span>
            </div>
            <div className="card p-4 bg-emerald-50 border border-emerald-200">
              <span className="text-xs font-bold text-emerald-800 uppercase block">
                Present On Time
              </span>
              <span className="text-2xl font-black text-emerald-900">
                {staffDailyData?.counts?.present ?? 0}
              </span>
            </div>
            <div className="card p-4 bg-amber-50 border border-amber-200">
              <span className="text-xs font-bold text-amber-800 uppercase block">
                Late Arrivals
              </span>
              <span className="text-2xl font-black text-amber-900">
                {staffDailyData?.counts?.late ?? 0}
              </span>
            </div>
            <div className="card p-4 bg-rose-50 border border-rose-200">
              <span className="text-xs font-bold text-rose-800 uppercase block">
                Absent / Unrecorded
              </span>
              <span className="text-2xl font-black text-rose-900">
                {(staffDailyData?.counts?.absent ?? 0) +
                  (staffDailyData?.counts?.unrecorded ?? 0)}
              </span>
            </div>
          </div>

          {/* Category Tabs: Teachers, Finance, Admin */}
          <div className="card p-3 bg-gray-50/80 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                <button
                  onClick={() => setActiveCategory("ALL")}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl font-extrabold transition-all inline-flex items-center gap-1.5",
                    activeCategory === "ALL"
                      ? "bg-primary-600 text-white shadow-xs"
                      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
                  )}
                >
                  <Users className="w-3.5 h-3.5" /> All Staff (
                  {staffDailyData?.totalStaff ?? 0})
                </button>

                <button
                  onClick={() => setActiveCategory("TEACHER")}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl font-extrabold transition-all inline-flex items-center gap-1.5",
                    activeCategory === "TEACHER"
                      ? "bg-primary-600 text-white shadow-xs"
                      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
                  )}
                >
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />{" "}
                  Teachers (
                  {staffDailyData?.categories?.TEACHER?.total ?? 0})
                </button>

                <button
                  onClick={() => setActiveCategory("FINANCE")}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl font-extrabold transition-all inline-flex items-center gap-1.5",
                    activeCategory === "FINANCE"
                      ? "bg-primary-600 text-white shadow-xs"
                      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
                  )}
                >
                  <Briefcase className="w-3.5 h-3.5 text-emerald-500" /> Finance (
                  {staffDailyData?.categories?.FINANCE?.total ?? 0})
                </button>

                <button
                  onClick={() => setActiveCategory("ADMIN")}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl font-extrabold transition-all inline-flex items-center gap-1.5",
                    activeCategory === "ADMIN"
                      ? "bg-primary-600 text-white shadow-xs"
                      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
                  )}
                >
                  <Building2 className="w-3.5 h-3.5 text-purple-500" /> Admins & HR (
                  {staffDailyData?.categories?.ADMIN?.total ?? 0})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setViewMode(viewMode === "GROUPED" ? "FLAT" : "GROUPED")
                  }
                  className="btn-ghost btn-sm text-xs text-gray-600 inline-flex items-center gap-1 border border-gray-200 bg-white"
                  title="Toggle Categorical Grouping"
                >
                  <Layers className="w-3.5 h-3.5" />
                  {viewMode === "GROUPED" ? "Grouped View" : "Flat List View"}
                </button>

                <button
                  onClick={handleMarkAllPresent}
                  disabled={batchRecordMutation.isPending || filteredRoster.length === 0}
                  className="btn-primary btn-sm text-xs inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark Filtered as Present
                </button>
              </div>
            </div>

            {/* Advanced Multi-Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  className="input text-xs pl-8 font-medium"
                  placeholder="Search by name, email, employee ID, specialization, department…"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
                {staffSearch && (
                  <button
                    onClick={() => setStaffSearch("")}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-gray-600 whitespace-nowrap">
                  Date:
                </span>
                <input
                  type="date"
                  className="input text-xs font-bold flex-1"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-gray-600 whitespace-nowrap">
                  Status:
                </span>
                <select
                  className="input text-xs flex-1"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Presence Statuses</option>
                  <option value="PRESENT">Present (On Time)</option>
                  <option value="LATE">Late Arrivals</option>
                  <option value="ABSENT">Absent (Unexcused)</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="EXCUSED">Excused</option>
                  <option value="UNRECORDED">Unrecorded Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Staff Attendance Register Table */}
          {staffDailyLoading ? (
            <PageLoader />
          ) : filteredRoster.length === 0 ? (
            <div className="card p-12 text-center bg-white border border-gray-200 space-y-2">
              <Users className="w-10 h-10 text-gray-300 mx-auto" />
              <h3 className="font-bold text-gray-700">No staff members found</h3>
              <p className="text-xs text-gray-400">
                Try clearing your search query or selecting a different role filter.
              </p>
              <button
                className="btn-secondary btn-sm text-xs inline-flex items-center gap-1 mt-2"
                onClick={() => {
                  setStaffSearch("");
                  setStatusFilter("ALL");
                  setActiveCategory("ALL");
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
              </button>
            </div>
          ) : viewMode === "GROUPED" && activeCategory === "ALL" ? (
            // ── Grouped Categorical Sections ─────────────────────────────────
            <div className="space-y-5">
              {Object.entries(groupedRoster).map(([catKey, catGroup]) => {
                if (catGroup.items.length === 0) return null;
                const CatIcon = catGroup.icon;
                return (
                  <div
                    key={catKey}
                    className="card bg-white border border-gray-200 overflow-hidden"
                  >
                    <div className="p-3.5 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between">
                      <h4 className="font-extrabold text-xs text-gray-900 flex items-center gap-2">
                        <CatIcon className="w-4 h-4 text-primary-600" />
                        {catGroup.title} ({catGroup.items.length})
                      </h4>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">
                        {catGroup.items.filter((i) => i.status === "PRESENT").length}{" "}
                        Present •{" "}
                        {catGroup.items.filter((i) => i.status === "LATE").length} Late
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="table w-full text-left text-xs">
                        <thead>
                          <tr className="bg-gray-50/40 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                            <th className="py-2.5 px-4">Faculty / Staff</th>
                            <th className="py-2.5 px-4">Department / Subject</th>
                            <th className="py-2.5 px-4">Presence Status</th>
                            <th className="py-2.5 px-4">Check-In / Expected</th>
                            <th className="py-2.5 px-4">Lateness</th>
                            <th className="py-2.5 px-4">Notes</th>
                            <th className="py-2.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {catGroup.items.map((item) => (
                            <tr key={item.staffId} className="hover:bg-gray-50/60">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <Avatar
                                    name={`${item.staff?.firstName} ${item.staff?.lastName}`}
                                    src={item.staff?.avatar}
                                    size="sm"
                                  />
                                  <div>
                                    <p className="font-bold text-gray-900">
                                      {item.staff?.firstName} {item.staff?.lastName}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                      ID: {item.employeeId} • {item.staff?.email}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-gray-700 font-medium">
                                {item.department}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={clsx(
                                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                                    item.status === "PRESENT" &&
                                      "bg-emerald-50 text-emerald-700 border-emerald-200",
                                    item.status === "LATE" &&
                                      "bg-amber-50 text-amber-700 border-amber-200",
                                    item.status === "ABSENT" &&
                                      "bg-rose-50 text-rose-700 border-rose-200",
                                    item.status === "EXCUSED" &&
                                      "bg-blue-50 text-blue-700 border-blue-200",
                                    item.status === "UNRECORDED" &&
                                      "bg-gray-100 text-gray-500 border-gray-200",
                                  )}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono">
                                {item.checkInTime ? (
                                  <span className="font-bold text-gray-900">
                                    {item.checkInTime}{" "}
                                    <span className="text-gray-400 font-normal text-[10px]">
                                      (exp: {item.expectedTime})
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold">
                                {item.lateMinutes > 0 ? (
                                  <span className="text-amber-700">
                                    +{item.lateMinutes}m
                                  </span>
                                ) : item.status === "PRESENT" ? (
                                  <span className="text-emerald-700">0m</span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-gray-500 max-w-44 truncate">
                                {item.notes || "—"}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleQuickStatus(item.staffId, "PRESENT")}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                    title="Mark Present"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleQuickStatus(item.staffId, "LATE")}
                                    className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                                    title="Mark Late (+20m)"
                                  >
                                    <AlertCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleQuickStatus(item.staffId, "ABSENT")}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                    title="Mark Absent"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    className="btn-secondary btn-sm text-[10px] py-0.5 px-2 ml-1"
                                    onClick={() => {
                                      setEditAttendanceModal(item);
                                      setAttendanceForm({
                                        status:
                                          item.status !== "UNRECORDED"
                                            ? item.status
                                            : "PRESENT",
                                        checkInTime: item.checkInTime || "08:00",
                                        checkOutTime: item.checkOutTime || "16:30",
                                        expectedTime: item.expectedTime || "08:00",
                                        lateMinutes: item.lateMinutes || 0,
                                        notes: item.notes || "",
                                      });
                                    }}
                                  >
                                    Edit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // ── Unified Flat Table ──────────────────────────────────────────
            <div className="card bg-white border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">Faculty / Staff Member</th>
                      <th className="py-3 px-4">Category & Department</th>
                      <th className="py-3 px-4">Presence Status</th>
                      <th className="py-3 px-4">Check-In / Expected</th>
                      <th className="py-3 px-4">Lateness</th>
                      <th className="py-3 px-4">Notes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRoster.map((item) => (
                      <tr key={item.staffId} className="hover:bg-gray-50/60">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={`${item.staff?.firstName} ${item.staff?.lastName}`}
                              src={item.staff?.avatar}
                              size="sm"
                            />
                            <div>
                              <p className="font-bold text-gray-900">
                                {item.staff?.firstName} {item.staff?.lastName}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                ID: {item.employeeId} • {item.staff?.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              item.category === "TEACHER"
                                ? "indigo"
                                : item.category === "FINANCE"
                                ? "green"
                                : "purple"
                            }
                          >
                            {item.category}
                          </Badge>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {item.department}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={clsx(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                              item.status === "PRESENT" &&
                                "bg-emerald-50 text-emerald-700 border-emerald-200",
                              item.status === "LATE" &&
                                "bg-amber-50 text-amber-700 border-amber-200",
                              item.status === "ABSENT" &&
                                "bg-rose-50 text-rose-700 border-rose-200",
                              item.status === "EXCUSED" &&
                                "bg-blue-50 text-blue-700 border-blue-200",
                              item.status === "UNRECORDED" &&
                                "bg-gray-100 text-gray-500 border-gray-200",
                            )}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {item.checkInTime ? (
                            <span className="font-bold text-gray-900">
                              {item.checkInTime}{" "}
                              <span className="text-gray-400 font-normal text-[10px]">
                                (exp: {item.expectedTime})
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {item.lateMinutes > 0 ? (
                            <span className="text-amber-700">
                              +{item.lateMinutes}m
                            </span>
                          ) : item.status === "PRESENT" ? (
                            <span className="text-emerald-700">0m</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 max-w-44 truncate">
                          {item.notes || "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleQuickStatus(item.staffId, "PRESENT")}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Mark Present"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleQuickStatus(item.staffId, "LATE")}
                              className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                              title="Mark Late (+20m)"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleQuickStatus(item.staffId, "ABSENT")}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                              title="Mark Absent"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              className="btn-secondary btn-sm text-[10px] py-0.5 px-2 ml-1"
                              onClick={() => {
                                setEditAttendanceModal(item);
                                setAttendanceForm({
                                  status:
                                    item.status !== "UNRECORDED"
                                      ? item.status
                                      : "PRESENT",
                                  checkInTime: item.checkInTime || "08:00",
                                  checkOutTime: item.checkOutTime || "16:30",
                                  expectedTime: item.expectedTime || "08:00",
                                  lateMinutes: item.lateMinutes || 0,
                                  notes: item.notes || "",
                                });
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          3. STAFF PUNCTUALITY ANALYTICS & ASSESSMENT TAB (Admin Only)
         ══════════════════════════════════════════════════════════════════════════ */}
      {isAdmin() && adminTab === "STAFF_ANALYTICS" && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase block">
                Total Late Incidents
              </span>
              <span className="text-2xl font-black text-amber-600">
                {staffAnalyticsData?.overview?.totalLateArrivals ?? 0}
              </span>
            </div>
            <div className="card p-4 bg-white border border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase block">
                Unexcused Absences
              </span>
              <span className="text-2xl font-black text-rose-600">
                {staffAnalyticsData?.overview?.totalUnexcusedAbsences ?? 0}
              </span>
            </div>
            <div className="card p-4 bg-white border border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase block">
                Total Late Time Lost
              </span>
              <span className="text-2xl font-black text-gray-900">
                {staffAnalyticsData?.overview?.totalLateMinutes ?? 0} mins
              </span>
            </div>
            <div className="card p-4 bg-rose-50 border border-rose-200">
              <span className="text-xs font-bold text-rose-800 uppercase block">
                Flagged for Penalty
              </span>
              <span className="text-2xl font-black text-rose-900">
                {staffAnalyticsData?.overview?.flaggedForPenaltyCount ?? 0}
              </span>
            </div>
          </div>

          {/* Date Range & Search */}
          <div className="card p-4 bg-white border border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <div className="flex items-center gap-1 text-xs">
                <span className="font-bold text-gray-700">Assessment Range:</span>
                <input
                  type="date"
                  className="input text-xs font-bold"
                  value={analyticsRange.startDate}
                  onChange={(e) =>
                    setAnalyticsRange((r) => ({
                      ...r,
                      startDate: e.target.value,
                    }))
                  }
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  className="input text-xs font-bold"
                  value={analyticsRange.endDate}
                  onChange={(e) =>
                    setAnalyticsRange((r) => ({ ...r, endDate: e.target.value }))
                  }
                />
              </div>

              <div className="relative min-w-64 flex-1">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  className="input text-xs pl-8"
                  placeholder="Filter by name, email, employee ID, specialization…"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Assessment Leaderboard Table */}
          <div className="card bg-white border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary-600" />
                  Staff Punctuality & Performance Assessment Report
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Evaluate individual faculty attendance, chronic lateness, and apply salary deductions or disciplinary actions.
                </p>
              </div>
            </div>

            {analyticsLoading ? (
              <PageLoader />
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">Faculty / Staff Member</th>
                      <th className="py-3 px-4">Role & Category</th>
                      <th className="py-3 px-4">Recorded Days</th>
                      <th className="py-3 px-4">Punctuality Score</th>
                      <th className="py-3 px-4">Late Arrivals</th>
                      <th className="py-3 px-4">Total Late Mins</th>
                      <th className="py-3 px-4">Absences</th>
                      <th className="py-3 px-4">Risk Status</th>
                      <th className="py-3 px-4">Penalties Applied</th>
                      <th className="py-3 px-4 text-right">Decision / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(staffAnalyticsData?.staffAssessments ?? []).map((s) => (
                      <tr key={s.staffId} className="hover:bg-gray-50/60">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={`${s.staff?.firstName} ${s.staff?.lastName}`}
                              src={s.staff?.avatar}
                              size="sm"
                            />
                            <div>
                              <p className="font-bold text-gray-900">
                                {s.staff?.firstName} {s.staff?.lastName}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                Emp ID: {s.employeeId} • {s.staff?.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              s.category === "TEACHER"
                                ? "indigo"
                                : s.category === "FINANCE"
                                ? "green"
                                : "purple"
                            }
                          >
                            {s.category}
                          </Badge>
                          <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-32">
                            {s.department}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-gray-700">
                          {s.totalRecordedDays} days
                        </td>
                        <td className="py-3 px-4 font-mono font-extrabold">
                          <span
                            className={clsx(
                              s.punctualityScore >= 90
                                ? "text-emerald-700"
                                : s.punctualityScore >= 75
                                ? "text-amber-700"
                                : "text-rose-700",
                            )}
                          >
                            {s.punctualityScore}%
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {s.lateDays > 0 ? (
                            <span className="font-bold text-amber-700">
                              {s.lateDays} times
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {s.totalLateMinutes > 0 ? (
                            <span className="font-bold text-gray-900">
                              {s.totalLateMinutes} mins
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {s.absentDays > 0 ? (
                            <span className="font-bold text-rose-700">
                              {s.absentDays} days
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                              s.riskLevel === "CLEAN" &&
                                "bg-emerald-50 text-emerald-700 border-emerald-200",
                              s.riskLevel === "AT_RISK" &&
                                "bg-amber-50 text-amber-700 border-amber-200",
                              s.riskLevel === "FLAGGED_FOR_PENALTY" &&
                                "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
                            )}
                          >
                            {s.riskLevel === "CLEAN"
                              ? "🟢 Good Standing"
                              : s.riskLevel === "AT_RISK"
                              ? "🟡 At-Risk"
                              : "🔴 Flagged / Disciplinary"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {s.penaltiesCount > 0 ? (
                            <span className="font-bold text-rose-700">
                              {s.penaltiesCount} ({s.totalSalaryDeductions} ETB)
                            </span>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            className={clsx(
                              "btn-sm text-xs py-1 px-2.5 inline-flex items-center gap-1",
                              s.riskLevel === "FLAGGED_FOR_PENALTY"
                                ? "btn-danger"
                                : "btn-secondary",
                            )}
                            onClick={() => handleOpenPenaltyForStaff(s)}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            Apply Penalty
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          4. RULES & DISCIPLINARY PENALTIES TAB (Admin Only)
         ══════════════════════════════════════════════════════════════════════════ */}
      {isAdmin() && adminTab === "PENALTIES_RULES" && (
        <div className="space-y-6">
          {/* Configured Disciplinary Rules Card */}
          <div className="card p-5 bg-white border border-gray-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary-600" />
                  School Disciplinary Rules & Penalty Policy
                </h3>
                <p className="text-xs text-gray-500">
                  Standard policy thresholds and punishment actions enforced across all faculty and staff.
                </p>
              </div>

              <button
                className="btn-primary inline-flex items-center gap-1.5 text-xs"
                onClick={() => {
                  setSelectedStaffForPenalty(null);
                  setPenaltyModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Issue Disciplinary Penalty
              </button>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                <span className="font-bold text-amber-900 block">
                  Rule 1: 1–2 Late Arrivals
                </span>
                <p className="text-amber-800">
                  Soft system reminder & attendance notification. No financial penalty.
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs space-y-1">
                <span className="font-bold text-orange-900 block">
                  Rule 2: 3–4 Late Arrivals
                </span>
                <p className="text-orange-800">
                  Formal Warning Letter issued and demerit points (-5 pts) logged to HR file.
                </p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs space-y-1">
                <span className="font-bold text-rose-900 block">
                  Rule 3: 5+ Lates or Unexcused Absence
                </span>
                <p className="text-rose-800">
                  <strong>Salary Deduction</strong> (Half-day rate or custom amount) deducted from monthly payroll.
                </p>
              </div>
            </div>
          </div>

          {/* Disciplinary Penalties Log Table */}
          <div className="card bg-white border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-600" />
                Disciplinary Actions & Salary Deductions Log
              </h3>
            </div>

            {penaltiesLoading ? (
              <PageLoader />
            ) : (penaltiesData ?? []).length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No disciplinary penalties or deductions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Penalty Type</th>
                      <th className="py-3 px-4">Reason / Infraction</th>
                      <th className="py-3 px-4">Salary Deduction</th>
                      <th className="py-3 px-4">Issued By</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {penaltiesData.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/60">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={`${p.staff?.firstName} ${p.staff?.lastName}`}
                              src={p.staff?.avatar}
                              size="xs"
                            />
                            <div>
                              <p className="font-bold text-gray-900">
                                {p.staff?.firstName} {p.staff?.lastName}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {p.staff?.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              p.type === "SALARY_DEDUCTION"
                                ? "red"
                                : p.type === "WARNING_LETTER"
                                ? "yellow"
                                : "purple"
                            }
                          >
                            {p.type.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800 max-w-64 truncate">
                          {p.reason}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {p.amount > 0 ? (
                            <span className="text-rose-700">
                              -{p.amount} {p.currency}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {p.issuedBy?.firstName} {p.issuedBy?.lastName}
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-mono">
                          {new Date(p.effectiveDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              p.status === "APPLIED" &&
                                "bg-amber-50 text-amber-800 border-amber-200",
                              p.status === "DEDUCTED_FROM_PAYROLL" &&
                                "bg-rose-50 text-rose-800 border-rose-200",
                              p.status === "RESOLVED" &&
                                "bg-emerald-50 text-emerald-800 border-emerald-200",
                              p.status === "WAIVED" &&
                                "bg-gray-100 text-gray-600 border-gray-200",
                            )}
                          >
                            {p.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status === "APPLIED" && (
                              <>
                                <button
                                  className="btn-ghost p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                  title="Mark as Deducted from Payroll"
                                  onClick={() =>
                                    updatePenaltyStatusMutation.mutate({
                                      id: p.id,
                                      status: "DEDUCTED_FROM_PAYROLL",
                                    })
                                  }
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  className="btn-ghost p-1 text-gray-400 hover:text-gray-600 rounded"
                                  title="Waive Penalty"
                                  onClick={() =>
                                    updatePenaltyStatusMutation.mutate({
                                      id: p.id,
                                      status: "WAIVED",
                                    })
                                  }
                                >
                                  Waive
                                </button>
                              </>
                            )}
                            <button
                              className="btn-ghost p-1 text-gray-300 hover:text-red-600 rounded"
                              title="Delete Record"
                              onClick={() => deletePenaltyMutation.mutate(p.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          5. STUDENT ATTENDANCE REPORTS & ANALYTICS TAB (Admin View Only)
         ══════════════════════════════════════════════════════════════════════════ */}
      {isAdmin() && adminTab === "STUDENT_REPORTS" && (
        <div className="space-y-6">
          {/* Informational Banner */}
          <div className="p-4 bg-primary-50/70 border border-primary-100 rounded-2xl flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-extrabold text-xs text-primary-900">
                Student Attendance Reports & Analytics
              </h3>
              <p className="text-xs text-primary-800 mt-0.5 leading-relaxed">
                Student daily attendance is taken directly by assigned teachers for their respective classes. As an administrator, you can view real-time class attendance completion status, trend charts, and download full attendance report sheets below.
              </p>
            </div>
          </div>

          {/* Today's Teacher Attendance Submission Compliance */}
          {deadlinesSummary?.summary?.attendance && (
            <div className="card p-5 bg-white border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-primary-600" />
                  Today's Teacher Class Attendance Submissions
                </h4>
                <span className="text-[11px] text-gray-500 font-semibold">
                  Reported:{" "}
                  <strong className="text-emerald-700">
                    {deadlinesSummary.summary.attendance.markedPeriods ?? 0}
                  </strong>{" "}
                  / {deadlinesSummary.summary.attendance.totalPeriods ?? 0} Periods
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl text-xs">
                {(deadlinesSummary.summary.attendance.items ?? []).map((item) => (
                  <div key={item.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-gray-900">
                        Class {item.className} • {item.subjectName}
                      </span>
                      <p className="text-[10px] text-gray-500">
                        Teacher: <strong className="text-gray-700">{item.teacherName}</strong> • Period: {item.startTime} to {item.cutoffTime}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        item.status === "COMPLETED" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        item.status === "OVERDUE" && "bg-rose-50 text-rose-700 border-rose-200",
                        item.status === "APPROACHING" && "bg-amber-50 text-amber-700 border-amber-200",
                        item.status === "SCHEDULED" && "bg-gray-50 text-gray-600 border-gray-200"
                      )}
                    >
                      {item.status === "COMPLETED"
                        ? "✓ Submitted by Teacher"
                        : item.status === "OVERDUE"
                        ? "🔴 Overdue"
                        : item.status === "APPROACHING"
                        ? "🟡 Window Active"
                        : "Scheduled"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attendance Trend Chart */}
          <AttendanceTrendChart />

          {/* Printable Attendance Sheet Generator */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-primary-600" />
              Download Class Attendance Reports (PDF)
            </h4>
            <AttendanceSheetDownload />
          </div>
        </div>
      )}

      {/* ── Edit Staff Attendance Modal ────────────────────────────────────── */}
      <Modal
        open={!!editAttendanceModal}
        onClose={() => setEditAttendanceModal(null)}
        title={`Record Staff Attendance — ${editAttendanceModal?.staff?.firstName} ${editAttendanceModal?.staff?.lastName}`}
        size="sm"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setEditAttendanceModal(null)}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() =>
                recordAttendanceMutation.mutate({
                  staffId: editAttendanceModal?.staffId,
                  date: selectedDate,
                  status: attendanceForm.status,
                  checkInTime: attendanceForm.checkInTime,
                  checkOutTime: attendanceForm.checkOutTime,
                  expectedTime: attendanceForm.expectedTime,
                  lateMinutes: parseInt(attendanceForm.lateMinutes, 10) || 0,
                  notes: attendanceForm.notes,
                })
              }
              disabled={recordAttendanceMutation.isPending}
            >
              <Save className="w-3.5 h-3.5" />
              {recordAttendanceMutation.isPending ? "Saving…" : "Save Record"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Attendance Status *</label>
            <select
              className="input text-xs"
              value={attendanceForm.status}
              onChange={(e) =>
                setAttendanceForm((f) => ({ ...f, status: e.target.value }))
              }
            >
              <option value="PRESENT">PRESENT (On Time)</option>
              <option value="LATE">LATE (Arrived past expected time)</option>
              <option value="ABSENT">ABSENT (Unexcused)</option>
              <option value="HALF_DAY">HALF DAY</option>
              <option value="ON_LEAVE">ON LEAVE (Authorized)</option>
              <option value="EXCUSED">EXCUSED</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label font-bold">Expected Time</label>
              <input
                type="time"
                className="input text-xs"
                value={attendanceForm.expectedTime}
                onChange={(e) =>
                  setAttendanceForm((f) => ({
                    ...f,
                    expectedTime: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="label font-bold">Check-In Time</label>
              <input
                type="time"
                className="input text-xs"
                value={attendanceForm.checkInTime}
                onChange={(e) => {
                  const checkIn = e.target.value;
                  const [expH, expM] = attendanceForm.expectedTime
                    .split(":")
                    .map(Number);
                  const [inH, inM] = checkIn.split(":").map(Number);
                  const diff = inH * 60 + inM - (expH * 60 + expM);
                  setAttendanceForm((f) => ({
                    ...f,
                    checkInTime: checkIn,
                    lateMinutes: Math.max(0, diff),
                    status: diff > 0 ? "LATE" : "PRESENT",
                  }));
                }}
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Late by (Minutes)</label>
            <input
              type="number"
              min="0"
              className="input text-xs font-mono"
              value={attendanceForm.lateMinutes}
              onChange={(e) =>
                setAttendanceForm((f) => ({
                  ...f,
                  lateMinutes: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </div>

          <div>
            <label className="label font-bold">Inconvenience / Reason Notes</label>
            <textarea
              className="input text-xs min-h-16 resize-none"
              placeholder="e.g. Heavy traffic, medical appointment, car breakdown…"
              value={attendanceForm.notes}
              onChange={(e) =>
                setAttendanceForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>
      </Modal>

      {/* ── Issue Disciplinary Penalty / Punishment Modal ────────────────────── */}
      <Modal
        open={penaltyModalOpen}
        onClose={() => setPenaltyModalOpen(false)}
        title={
          selectedStaffForPenalty
            ? `Issue Disciplinary Penalty — ${selectedStaffForPenalty.firstName} ${selectedStaffForPenalty.lastName}`
            : "Issue Staff Disciplinary Penalty"
        }
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setPenaltyModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-danger inline-flex items-center gap-1.5"
              onClick={() =>
                issuePenaltyMutation.mutate({
                  staffId: selectedStaffForPenalty?.id,
                  type: penaltyForm.type,
                  reason: penaltyForm.reason,
                  amount: parseFloat(penaltyForm.amount) || 0,
                  currency: penaltyForm.currency,
                  demeritPoints: parseInt(penaltyForm.demeritPoints, 10) || 0,
                  actionNotes: penaltyForm.actionNotes,
                })
              }
              disabled={
                issuePenaltyMutation.isPending ||
                !penaltyForm.reason.trim() ||
                !selectedStaffForPenalty
              }
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {issuePenaltyMutation.isPending
                ? "Issuing Penalty…"
                : "Confirm & Apply Penalty"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {selectedStaffForPenalty ? (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar
                  name={`${selectedStaffForPenalty.firstName} ${selectedStaffForPenalty.lastName}`}
                  size="sm"
                />
                <div>
                  <span className="font-bold text-gray-900 block">
                    {selectedStaffForPenalty.firstName}{" "}
                    {selectedStaffForPenalty.lastName}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {selectedStaffForPenalty.email}
                  </span>
                </div>
              </div>
              <Badge variant="purple">{selectedStaffForPenalty.role}</Badge>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-xl text-amber-800">
              Please select a staff member from the Analytics table to assess penalties.
            </div>
          )}

          <div>
            <label className="label font-bold">Penalty / Punishment Type *</label>
            <select
              className="input text-xs"
              value={penaltyForm.type}
              onChange={(e) =>
                setPenaltyForm((f) => ({ ...f, type: e.target.value }))
              }
            >
              <option value="SALARY_DEDUCTION">
                💰 Salary Deduction (Deduct from payroll)
              </option>
              <option value="WARNING_LETTER">
                ⚠️ Formal Warning Letter (Logged to file)
              </option>
              <option value="DEMERIT_SCORE">
                📉 Demerit Points / Performance Demerit
              </option>
              <option value="LEAVE_DEDUCTION">
                🏖️ Compensatory Leave Day Deduction
              </option>
              <option value="SUSPENSION">
                🚫 Suspension / Temporary Relievement
              </option>
              <option value="CUSTOM">⚖️ Custom Disciplinary Action</option>
            </select>
          </div>

          <div>
            <label className="label font-bold">Reason & Infraction Details *</label>
            <textarea
              className="input text-xs min-h-20 resize-none"
              placeholder="Detail the lateness incidents, unexcused absence dates, or policy breach…"
              value={penaltyForm.reason}
              onChange={(e) =>
                setPenaltyForm((f) => ({ ...f, reason: e.target.value }))
              }
              required
            />
          </div>

          {penaltyForm.type === "SALARY_DEDUCTION" && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-rose-50/60 rounded-xl border border-rose-100">
              <div>
                <label className="label font-bold text-rose-900">
                  Deduction Amount *
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  className="input text-xs font-mono font-bold"
                  value={penaltyForm.amount}
                  onChange={(e) =>
                    setPenaltyForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="label font-bold text-rose-900">Currency</label>
                <input
                  className="input text-xs font-bold"
                  value={penaltyForm.currency}
                  onChange={(e) =>
                    setPenaltyForm((f) => ({ ...f, currency: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          <div>
            <label className="label font-bold">Demerit Points</label>
            <input
              type="number"
              min="0"
              className="input text-xs font-mono"
              value={penaltyForm.demeritPoints}
              onChange={(e) =>
                setPenaltyForm((f) => ({
                  ...f,
                  demeritPoints: e.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="label font-bold">Action / Admin Remarks</label>
            <input
              className="input text-xs"
              placeholder="e.g. Issued after 3rd late arrival in October."
              value={penaltyForm.actionNotes}
              onChange={(e) =>
                setPenaltyForm((f) => ({ ...f, actionNotes: e.target.value }))
              }
            />
          </div>

          <div className="p-2.5 bg-primary-50 rounded-xl text-[11px] text-primary-800 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
            <span>
              An urgent in-app disciplinary notification will automatically be dispatched to this staff member.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
