import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  AlertTriangle,
  Star,
  Shield,
  Search,
  Filter,
  X,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Users,
  Layers,
  Calendar,
  Trash2,
  Check,
  Award,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import api from "../../lib/api";
import {
  Badge,
  EmptyState,
  Pagination,
  Avatar,
} from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import { useAuthStore } from "../../store/authStore";
import clsx from "clsx";
import { format } from "date-fns";
import toast from "react-hot-toast";

const TYPE_BADGE = {
  MERIT: "green",
  COMMENDATION: "green",
  DEMERIT: "red",
  WARNING: "yellow",
  INCIDENT: "red",
  SUSPENSION: "red",
};

const TYPE_ICON = {
  MERIT: Star,
  COMMENDATION: Star,
  DEMERIT: AlertTriangle,
  WARNING: AlertTriangle,
  INCIDENT: Shield,
  SUSPENSION: Shield,
};

export default function BehaviourPage() {
  const { user, isAdmin, isTeacher, isStudent, isParent } = useAuthStore();
  const qc = useQueryClient();
  const canReport = isAdmin() || isTeacher();
  const canViewAll = isAdmin() || isTeacher();

  // ── View Mode & Main Filter States ───────────────────────────────
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "table"
  const [addOpen, setAddOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(null);
  const [actionTakenText, setActionTakenText] = useState("");
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState(null);

  // Main Page Advanced Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "true" | "false"
  const [sortBy, setSortBy] = useState("date-desc"); // "date-desc" | "date-asc" | "points-desc" | "points-asc"

  // ── Add Record Form & Student Filter States ───────────────────────
  const [modalStudentSearch, setModalStudentSearch] = useState("");
  const [modalGradeFilter, setModalGradeFilter] = useState("ALL");
  const [modalClassFilter, setModalClassFilter] = useState("ALL");
  const [modalGenderFilter, setModalGenderFilter] = useState("ALL"); // "ALL" | "MALE" | "FEMALE"

  const [form, setForm] = useState({
    studentId: "",
    type: "MERIT",
    severity: "LOW",
    title: "",
    description: "",
    actionTaken: "",
    points: 5,
    date: new Date().toISOString().split("T")[0],
  });

  // ── Queries ──────────────────────────────────────────────────────
  const { data: gradeLevels } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data),
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
  });

  const sortedGradeLevels = useMemo(() => {
    return (gradeLevels ?? []).slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [gradeLevels]);

  const availableClasses = useMemo(() => {
    const raw = classesData ?? [];
    if (gradeFilter === "ALL") return raw;
    return raw.filter((c) => c.gradeLevelId === gradeFilter);
  }, [classesData, gradeFilter]);

  const modalAvailableClasses = useMemo(() => {
    const raw = classesData ?? [];
    if (modalGradeFilter === "ALL") return raw;
    return raw.filter((c) => c.gradeLevelId === modalGradeFilter);
  }, [classesData, modalGradeFilter]);

  // Main Behaviour Records Query
  const { data, isLoading } = useQuery({
    queryKey: [
      "behaviour",
      page,
      searchQuery,
      gradeFilter,
      classFilter,
      typeFilter,
      severityFilter,
      statusFilter,
      sortBy,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "15");
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (gradeFilter !== "ALL") params.append("gradeLevelId", gradeFilter);
      if (classFilter !== "ALL") params.append("classId", classFilter);
      if (typeFilter !== "ALL") params.append("type", typeFilter);
      if (severityFilter !== "ALL") params.append("severity", severityFilter);
      if (statusFilter !== "ALL") params.append("isResolved", statusFilter);
      if (sortBy) params.append("sortBy", sortBy);

      return api.get(`/behaviour?${params.toString()}`).then((r) => r.data);
    },
    keepPreviousData: true,
    enabled: canViewAll,
  });

  // Student list for Add Record picker (supports up to 500 loaded students)
  const { data: allStudents } = useQuery({
    queryKey: ["users", "STUDENT", "modal-pool"],
    queryFn: () => api.get("/users?role=STUDENT&limit=500").then((r) => r.data.data),
    enabled: canReport && addOpen,
  });

  // Filtered candidate students in modal
  const filteredModalStudents = useMemo(() => {
    const raw = allStudents ?? [];
    return raw.filter((s) => {
      // Grade filter
      if (modalGradeFilter !== "ALL") {
        const studentGradeId =
          s.studentProfile?.gradeLevelId || s.studentProfile?.class?.gradeLevelId;
        if (studentGradeId !== modalGradeFilter) return false;
      }
      // Class filter
      if (modalClassFilter !== "ALL") {
        if (s.studentProfile?.classId !== modalClassFilter) return false;
      }
      // Gender filter
      if (modalGenderFilter !== "ALL") {
        if (s.gender !== modalGenderFilter) return false;
      }
      // Search query
      if (modalStudentSearch.trim()) {
        const q = modalStudentSearch.toLowerCase().trim();
        const fullName = `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
        const adm = (s.studentProfile?.admissionNumber || "").toLowerCase();
        const roll = (s.studentProfile?.rollNumber || "").toLowerCase();
        const email = (s.email || "").toLowerCase();
        return (
          fullName.includes(q) ||
          adm.includes(q) ||
          roll.includes(q) ||
          email.includes(q)
        );
      }
      return true;
    });
  }, [allStudents, modalGradeFilter, modalClassFilter, modalGenderFilter, modalStudentSearch]);

  const selectedStudentObject = useMemo(() => {
    if (!form.studentId || !allStudents) return null;
    return allStudents.find((s) => s.id === form.studentId);
  }, [form.studentId, allStudents]);

  // Own summary for student view
  const { data: ownSummary, isLoading: ownSummaryLoading } = useQuery({
    queryKey: ["behaviour-summary", user?.id],
    queryFn: () =>
      api.get(`/behaviour/student/${user.id}/summary`).then((r) => r.data.data),
    enabled: isStudent() && !!user?.id,
  });

  // ── Mutations ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d) =>
      api.post("/behaviour", {
        ...d,
        points: parseInt(d.points, 10) || 0,
        date: new Date(d.date).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["behaviour"] });
      toast.success("Behaviour record added successfully");
      setAddOpen(false);
      resetModalForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to add record");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, actionTaken }) =>
      api.patch(`/behaviour/${id}/resolve`, { actionTaken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["behaviour"] });
      toast.success("Record marked as resolved");
      setResolveOpen(null);
      setActionTakenText("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to resolve record");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/behaviour/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["behaviour"] });
      toast.success("Record deleted");
      setDeleteConfirmRecord(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete record");
    },
  });

  const resetModalForm = () => {
    setForm({
      studentId: "",
      type: "MERIT",
      severity: "LOW",
      title: "",
      description: "",
      actionTaken: "",
      points: 5,
      date: new Date().toISOString().split("T")[0],
    });
    setModalStudentSearch("");
    setModalGradeFilter("ALL");
    setModalClassFilter("ALL");
    setModalGenderFilter("ALL");
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (gradeFilter !== "ALL") count++;
    if (classFilter !== "ALL") count++;
    if (typeFilter !== "ALL") count++;
    if (severityFilter !== "ALL") count++;
    if (statusFilter !== "ALL") count++;
    return count;
  }, [searchQuery, gradeFilter, classFilter, typeFilter, severityFilter, statusFilter]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setGradeFilter("ALL");
    setClassFilter("ALL");
    setTypeFilter("ALL");
    setSeverityFilter("ALL");
    setStatusFilter("ALL");
    setSortBy("date-desc");
    setPage(1);
  };

  const records = data?.data ?? [];
  const meta = data?.meta ?? {};

  // Summary Metrics
  const metrics = useMemo(() => {
    const raw = records;
    const merits = raw.filter((r) => r.type === "MERIT" || r.type === "COMMENDATION").length;
    const demerits = raw.filter((r) => r.type === "DEMERIT" || r.type === "WARNING").length;
    const incidents = raw.filter((r) => r.type === "INCIDENT" || r.type === "SUSPENSION").length;

    return {
      total: meta.total ?? raw.length,
      merits,
      demerits,
      incidents,
    };
  }, [records, meta.total]);

  // ── Parent View ──────────────────────────────────────────────────
  if (isParent()) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Behaviour Records</h1>
            <p className="page-subtitle">Merits, demerits, and incident reports</p>
          </div>
        </div>
        <EmptyState
          icon={Shield}
          title="View by child"
          description="Open your child's profile to inspect their detailed conduct reports and disciplinary logs."
        />
      </div>
    );
  }

  // ── Student View ─────────────────────────────────────────────────
  if (isStudent()) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Behaviour & Conduct</h1>
            <p className="page-subtitle">Your merits, commendations, and discipline notes</p>
          </div>
        </div>
        {ownSummaryLoading ? (
          <PageLoader />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="card card-body text-center">
                <p className="text-2xl font-black text-emerald-600">
                  {ownSummary?.merits ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-semibold">Merits Earned</p>
              </div>
              <div className="card card-body text-center">
                <p className="text-2xl font-black text-rose-600">
                  {ownSummary?.demerits ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-semibold">Demerits / Warnings</p>
              </div>
              <div className="card card-body text-center">
                <p className="text-2xl font-black text-gray-900">
                  {ownSummary?.totalPoints ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-semibold">Net Conduct Points</p>
              </div>
            </div>
            <div className="space-y-3">
              {(ownSummary?.recent ?? []).length === 0 && (
                <EmptyState
                  icon={Shield}
                  title="No behaviour records"
                  description="Your conduct log is completely clean. Keep up the good work!"
                />
              )}
              {(ownSummary?.recent ?? []).map((r) => {
                const Icon = TYPE_ICON[r.type] ?? AlertTriangle;
                return (
                  <div key={r.id} className="card p-5 flex gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        r.type === "MERIT" || r.type === "COMMENDATION"
                          ? "bg-emerald-100"
                          : "bg-rose-100"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          r.type === "MERIT" || r.type === "COMMENDATION"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={TYPE_BADGE[r.type] ?? "gray"}>{r.type}</Badge>
                        <Badge
                          variant={
                            r.severity === "LOW"
                              ? "gray"
                              : r.severity === "MEDIUM"
                              ? "yellow"
                              : "red"
                          }
                        >
                          {r.severity}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-gray-900">{r.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>{format(new Date(r.date), "dd MMM yyyy")}</span>
                        <span>
                          · by {r.reportedBy?.firstName} {r.reportedBy?.lastName}
                        </span>
                        {r.points !== 0 && (
                          <span
                            className={
                              r.points > 0
                                ? "text-emerald-600 font-medium"
                                : "text-rose-600 font-medium"
                            }
                          >
                            {r.points > 0 ? `+${r.points}` : r.points} pts
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Staff / Admin View ───────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-primary-600" />
            Student Behaviour & Discipline
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Log merits, track commendations, and handle disciplinary incident reports
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs">
            <button
              onClick={() => setViewMode("cards")}
              className={clsx(
                "p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all",
                viewMode === "cards"
                  ? "bg-white text-primary-700 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              )}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={clsx(
                "p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all",
                viewMode === "table"
                  ? "bg-white text-primary-700 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              )}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {canReport && (
            <button
              className="btn-primary inline-flex items-center gap-1.5 shadow-sm"
              onClick={() => {
                resetModalForm();
                setAddOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Log Record
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Stats Pills ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">
              Total Logs
            </span>
            <span className="text-lg font-black text-gray-900">{metrics.total}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">
              Merits & Awards
            </span>
            <span className="text-lg font-black text-emerald-600">{metrics.merits}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">
              Demerits / Warns
            </span>
            <span className="text-lg font-black text-amber-600">{metrics.demerits}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">
              Incidents
            </span>
            <span className="text-lg font-black text-rose-600">{metrics.incidents}</span>
          </div>
        </div>
      </div>

      {/* ── Advanced Search & Filter Control Panel ─────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10 pr-9 text-xs py-2 w-full bg-gray-50 focus:bg-white transition-colors"
              placeholder="Search by student name, admission number, record title, or incident description…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown Selectors Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex items-center gap-2 text-xs flex-wrap">
            {/* Grade Level Dropdown */}
            <div className="flex-1 min-w-[135px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={gradeFilter}
                onChange={(e) => {
                  setGradeFilter(e.target.value);
                  setClassFilter("ALL");
                  setPage(1);
                }}
              >
                <option value="ALL">🎓 All Grades</option>
                {sortedGradeLevels.map((gl) => (
                  <option key={gl.id} value={gl.id}>
                    {gl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Section Dropdown */}
            <div className="flex-1 min-w-[130px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">🏫 All Classes</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Dropdown */}
            <div className="flex-1 min-w-[130px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">📑 All Types</option>
                <option value="MERIT">⭐ Merit</option>
                <option value="COMMENDATION">🏅 Commendation</option>
                <option value="DEMERIT">⚠️ Demerit</option>
                <option value="WARNING">⚡ Warning</option>
                <option value="INCIDENT">🛡️ Incident</option>
                <option value="SUSPENSION">🚫 Suspension</option>
              </select>
            </div>

            {/* Severity Dropdown */}
            <div className="flex-1 min-w-[125px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">🎯 All Severities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="flex-1 min-w-[125px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Status: All</option>
                <option value="true">✅ Resolved</option>
                <option value="false">⏳ Pending / Open</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex-1 min-w-[135px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
              >
                <option value="date-desc">Sort: Date (Newest)</option>
                <option value="date-asc">Sort: Date (Oldest)</option>
                <option value="points-desc">Sort: Points (Highest)</option>
                <option value="points-asc">Sort: Points (Lowest)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Active Filter Badges ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 font-medium">
              Showing <strong className="text-gray-900 font-bold">{records.length}</strong> of{" "}
              {meta.total ?? records.length} records
            </span>

            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery("")}>
                  <X className="w-3 h-3 hover:text-primary-900" />
                </button>
              </span>
            )}

            {gradeFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Grade: {sortedGradeLevels.find((g) => g.id === gradeFilter)?.name}
                <button onClick={() => setGradeFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-purple-900" />
                </button>
              </span>
            )}

            {classFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Class: {availableClasses.find((c) => c.id === classFilter)?.name}
                <button onClick={() => setClassFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-blue-900" />
                </button>
              </span>
            )}

            {typeFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Type: {typeFilter}
                <button onClick={() => setTypeFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-amber-900" />
                </button>
              </span>
            )}

            {severityFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                Severity: {severityFilter}
                <button onClick={() => setSeverityFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-rose-900" />
                </button>
              </span>
            )}

            {statusFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Status: {statusFilter === "true" ? "Resolved" : "Pending"}
                <button onClick={() => setStatusFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-emerald-900" />
                </button>
              </span>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="text-xs text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Content View ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <PageLoader />
      ) : records.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={Shield}
            title="No behaviour records found"
            description={
              activeFiltersCount > 0
                ? "No records match your selected search and filter criteria. Try resetting filters."
                : "No behaviour or disciplinary incidents have been reported."
            }
          />
          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="btn-secondary text-xs mt-4 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* ════ CARD VIEW ════ */
        <div className="space-y-3">
          {records.map((r) => {
            const Icon = TYPE_ICON[r.type] ?? AlertTriangle;
            const isPositive = r.type === "MERIT" || r.type === "COMMENDATION";

            return (
              <div
                key={r.id}
                className="card p-5 flex flex-col sm:flex-row sm:items-start gap-4 hover:border-primary-200 transition-colors bg-white"
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={TYPE_BADGE[r.type] ?? "gray"}>{r.type}</Badge>
                      <Badge
                        variant={
                          r.severity === "LOW"
                            ? "gray"
                            : r.severity === "MEDIUM"
                            ? "yellow"
                            : "red"
                        }
                      >
                        Severity: {r.severity}
                      </Badge>
                      {r.isResolved ? (
                        <span className="badge-green badge text-[10px] font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Resolved
                        </span>
                      ) : (
                        <span className="badge-yellow badge text-[10px] font-bold inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!r.isResolved && canReport && (
                        <button
                          className="btn-secondary btn-sm text-xs py-1 px-2 text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                          onClick={() => {
                            setResolveOpen(r);
                            setActionTakenText(r.actionTaken || "");
                          }}
                        >
                          <Check className="w-3 h-3 inline mr-1" /> Resolve
                        </button>
                      )}
                      {canReport && (
                        <button
                          className="btn-ghost p-1 text-gray-400 hover:text-red-600 rounded"
                          onClick={() => setDeleteConfirmRecord(r)}
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-extrabold text-sm text-gray-900">{r.title}</h3>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{r.description}</p>

                  {r.actionTaken && (
                    <div className="mt-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-700">
                      <span className="font-bold text-gray-900 block mb-0.5">Action Taken:</span>
                      {r.actionTaken}
                    </div>
                  )}

                  {/* Footer metadata */}
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={`${r.student?.firstName} ${r.student?.lastName}`}
                        src={r.student?.avatar}
                        size="sm"
                      />
                      <span className="font-bold text-gray-800">
                        {r.student?.firstName} {r.student?.lastName}
                      </span>
                      {r.student?.studentProfile?.admissionNumber && (
                        <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                          {r.student.studentProfile.admissionNumber}
                        </span>
                      )}
                      {r.student?.studentProfile?.class && (
                        <Badge variant="blue">{r.student.studentProfile.class.name}</Badge>
                      )}
                    </div>

                    <span>· 📅 {format(new Date(r.date), "dd MMM yyyy")}</span>
                    <span>
                      · Reported by: {r.reportedBy?.firstName} {r.reportedBy?.lastName}
                    </span>
                    {r.points !== 0 && (
                      <span
                        className={
                          r.points > 0
                            ? "text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                            : "text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200"
                        }
                      >
                        {r.points > 0 ? `+${r.points}` : r.points} Points
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ════ TABLE VIEW ════ */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Class & Adm No</th>
                  <th className="py-3 px-4">Type & Severity</th>
                  <th className="py-3 px-4">Incident Title</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Points</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={`${r.student?.firstName} ${r.student?.lastName}`}
                          src={r.student?.avatar}
                          size="sm"
                        />
                        <span className="font-bold text-gray-900">
                          {r.student?.firstName} {r.student?.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.student?.studentProfile?.class && (
                          <Badge variant="blue">{r.student.studentProfile.class.name}</Badge>
                        )}
                        <span className="font-mono text-[11px] text-gray-500">
                          {r.student?.studentProfile?.admissionNumber || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={TYPE_BADGE[r.type] ?? "gray"}>{r.type}</Badge>
                        <span className="text-[11px] text-gray-500">{r.severity}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900 max-w-[200px] truncate">
                      {r.title}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {format(new Date(r.date), "dd MMM yyyy")}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      <span className={r.points >= 0 ? "text-emerald-600" : "text-rose-600"}>
                        {r.points > 0 ? `+${r.points}` : r.points}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={r.isResolved ? "green" : "yellow"}>
                        {r.isResolved ? "Resolved" : "Pending"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!r.isResolved && canReport && (
                          <button
                            className="btn-ghost p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            onClick={() => {
                              setResolveOpen(r);
                              setActionTakenText(r.actionTaken || "");
                            }}
                            title="Mark Resolved"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canReport && (
                          <button
                            className="btn-ghost p-1 text-gray-400 hover:text-red-600 rounded"
                            onClick={() => setDeleteConfirmRecord(r)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta.totalPages > 1 && (
        <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
      )}

      {/* ── Add Behaviour Record Modal with Advanced Student Filtering ───────── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Behaviour / Conduct Record"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => createMutation.mutate(form)}
              disabled={
                createMutation.isPending || !form.studentId || !form.title.trim() || !form.description.trim()
              }
            >
              {createMutation.isPending ? "Saving Record…" : "Save Record"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* ── Student Selection Sub-Panel with Advanced Filters ──────────── */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="label font-bold text-gray-900 mb-0 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-primary-600" />
                Target Student *
              </label>
              {selectedStudentObject && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, studentId: "" }))}
                  className="text-xs text-red-600 hover:underline font-semibold"
                >
                  ✕ Change Student
                </button>
              )}
            </div>

            {selectedStudentObject ? (
              /* Selected Student Highlight Card */
              <div className="p-3 bg-white rounded-xl border border-primary-200 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={`${selectedStudentObject.firstName} ${selectedStudentObject.lastName}`}
                    src={selectedStudentObject.avatar}
                    className="w-10 h-10"
                  />
                  <div>
                    <h4 className="font-extrabold text-sm text-gray-900">
                      {selectedStudentObject.firstName} {selectedStudentObject.lastName}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.2 rounded border border-gray-200 font-bold">
                        {selectedStudentObject.studentProfile?.admissionNumber || "No ADM"}
                      </span>
                      {selectedStudentObject.studentProfile?.class && (
                        <Badge variant="blue">
                          Class {selectedStudentObject.studentProfile.class.name}
                        </Badge>
                      )}
                      {selectedStudentObject.gender && (
                        <span>· {selectedStudentObject.gender === "MALE" ? "Boy 👦" : "Girl 👧"}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  <UserCheck className="w-3.5 h-3.5" /> Selected
                </div>
              </div>
            ) : (
              /* Multi-Field Filtering & Fast Student Search Picker */
              <div className="space-y-2.5">
                {/* Filter Controls Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Grade Scope Filter */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                      Filter by Grade
                    </label>
                    <select
                      className="input py-1.5 text-xs bg-white"
                      value={modalGradeFilter}
                      onChange={(e) => {
                        setModalGradeFilter(e.target.value);
                        setModalClassFilter("ALL");
                      }}
                    >
                      <option value="ALL">🎓 All Grades</option>
                      {sortedGradeLevels.map((gl) => (
                        <option key={gl.id} value={gl.id}>
                          {gl.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Class Section Filter */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                      Filter by Class
                    </label>
                    <select
                      className="input py-1.5 text-xs bg-white"
                      value={modalClassFilter}
                      onChange={(e) => setModalClassFilter(e.target.value)}
                    >
                      <option value="ALL">🏫 All Classes</option>
                      {modalAvailableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Gender Filter */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                      Filter by Gender
                    </label>
                    <select
                      className="input py-1.5 text-xs bg-white"
                      value={modalGenderFilter}
                      onChange={(e) => setModalGenderFilter(e.target.value)}
                    >
                      <option value="ALL">All Genders</option>
                      <option value="MALE">👦 Male</option>
                      <option value="FEMALE">👧 Female</option>
                    </select>
                  </div>
                </div>

                {/* Instant Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="input pl-9 pr-8 text-xs py-1.5 w-full bg-white"
                    placeholder="Quick search student by name, admission no (e.g. ADM-001), roll no, or email…"
                    value={modalStudentSearch}
                    onChange={(e) => setModalStudentSearch(e.target.value)}
                  />
                  {modalStudentSearch && (
                    <button
                      type="button"
                      onClick={() => setModalStudentSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filtered Student Selection List / Box */}
                <div className="border border-gray-200 rounded-xl bg-white max-h-48 overflow-y-auto divide-y divide-gray-100 shadow-inner">
                  {filteredModalStudents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">
                      No students match your filter criteria
                    </div>
                  ) : (
                    filteredModalStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, studentId: s.id }))}
                        className="w-full text-left p-2.5 hover:bg-primary-50/70 transition-colors flex items-center justify-between gap-2 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            name={`${s.firstName} ${s.lastName}`}
                            src={s.avatar}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs text-gray-900 group-hover:text-primary-700 truncate">
                              {s.firstName} {s.lastName}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                              <span className="font-mono bg-gray-100 px-1 py-0.2 rounded border border-gray-200 font-bold text-gray-600">
                                {s.studentProfile?.admissionNumber || "No ADM"}
                              </span>
                              {s.studentProfile?.class && (
                                <span className="text-primary-700 font-medium">
                                  {s.studentProfile.class.name}
                                </span>
                              )}
                              {s.gender && (
                                <span>· {s.gender === "MALE" ? "Male 👦" : "Female 👧"}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className="text-[11px] font-bold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center">
                          Select <ChevronRight className="w-3 h-3" />
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <p className="text-[11px] text-gray-400 text-right">
                  Showing <strong>{filteredModalStudents.length}</strong> matching candidate(s)
                </p>
              </div>
            )}
          </div>

          {/* ── Record Details ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Record Category *</label>
              <select
                className="input text-xs"
                value={form.type}
                onChange={(e) => {
                  const t = e.target.value;
                  const isPositive = t === "MERIT" || t === "COMMENDATION";
                  setForm((f) => ({
                    ...f,
                    type: t,
                    points: isPositive ? 5 : -5,
                  }));
                }}
              >
                <option value="MERIT">⭐ Merit Award (+)</option>
                <option value="COMMENDATION">🏅 Commendation (+)</option>
                <option value="DEMERIT">⚠️ Demerit (-)</option>
                <option value="WARNING">⚡ Disciplinary Warning (-)</option>
                <option value="INCIDENT">🛡️ Behaviour Incident (-)</option>
                <option value="SUSPENSION">🚫 Suspension / Critical (-)</option>
              </select>
            </div>

            <div>
              <label className="label font-bold">Severity Level *</label>
              <select
                className="input text-xs"
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
              >
                <option value="LOW">Low (Minor remark / routine note)</option>
                <option value="MEDIUM">Medium (Noticeable action)</option>
                <option value="HIGH">High (Escalated discipline)</option>
                <option value="CRITICAL">Critical (Immediate intervention)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label font-bold">Record Title / Headline *</label>
            <input
              className="input text-xs"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Outstanding Classroom Participation, Unexcused Tardiness, Science Project Excellence…"
              required
            />
          </div>

          <div>
            <label className="label font-bold">Detailed Incident / Commendation Description *</label>
            <textarea
              className="input text-xs min-h-20 resize-none"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Provide context, observations, and relevant notes regarding the student's conduct…"
              required
            />
          </div>

          <div>
            <label className="label font-bold">Action Taken / Resolution Notes (Optional)</label>
            <input
              className="input text-xs"
              value={form.actionTaken}
              onChange={(e) => setForm((f) => ({ ...f, actionTaken: e.target.value }))}
              placeholder="e.g. Verbal warning given, Parent contacted, Extra tutoring assigned…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Conduct Points Impact</label>
              <input
                className="input text-xs"
                type="number"
                value={form.points}
                onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                placeholder="+5 or -5"
              />
            </div>
            <div>
              <label className="label font-bold">Incident / Award Date *</label>
              <input
                className="input text-xs"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Resolve Record Modal ────────────────────────────────────────────── */}
      <Modal
        open={!!resolveOpen}
        onClose={() => setResolveOpen(null)}
        title="Resolve Behaviour Record"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setResolveOpen(null)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() =>
                resolveMutation.mutate({
                  id: resolveOpen.id,
                  actionTaken: actionTakenText,
                })
              }
              disabled={resolveMutation.isPending}
            >
              <Check className="w-3.5 h-3.5" />
              {resolveMutation.isPending ? "Resolving…" : "Confirm Resolution"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-gray-600">
            Marking record for{" "}
            <strong className="text-gray-900">
              {resolveOpen?.student?.firstName} {resolveOpen?.student?.lastName}
            </strong>{" "}
            (<em>{resolveOpen?.title}</em>) as resolved.
          </p>
          <div>
            <label className="label font-bold">Action Taken / Resolution Summary *</label>
            <textarea
              className="input text-xs min-h-20 resize-none"
              value={actionTakenText}
              onChange={(e) => setActionTakenText(e.target.value)}
              placeholder="Describe the counseling, parent conference, or disciplinary steps completed..."
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
      <Modal
        open={!!deleteConfirmRecord}
        onClose={() => setDeleteConfirmRecord(null)}
        title="Confirm Delete Behaviour Record"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteConfirmRecord(null)}>
              Cancel
            </button>
            <button
              className="btn-primary bg-red-600 hover:bg-red-700 inline-flex items-center gap-1.5"
              onClick={() => deleteMutation.mutate(deleteConfirmRecord.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMutation.isPending ? "Deleting…" : "Delete Record"}
            </button>
          </>
        }
      >
        <p className="text-xs text-gray-600">
          Are you sure you want to delete this behaviour entry:{" "}
          <strong className="text-gray-900">{deleteConfirmRecord?.title}</strong>? This action
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
