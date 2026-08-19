import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Trash2,
  Users,
  GraduationCap,
  Search,
  Filter,
  X,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  Calendar,
  Layers,
  FileText,
  Sparkles,
  ExternalLink,
  Award,
  ChevronRight,
  FolderKanban,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { Badge, EmptyState, Pagination } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import { useAuthStore } from "../../store/authStore";
import clsx from "clsx";
import toast from "react-hot-toast";
import { format, isPast } from "date-fns";
import { evaluateDeadline, formatInSchoolTimezone } from "../../lib/deadlines";

export default function AssignmentsPage() {
  const { user, isStudent, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const timezone = user?.school?.timezone || "Africa/Addis_Ababa";

  // ── Modals & View Mode State ─────────────────────────────────────
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [addOpen, setAddOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(null);
  const [deleteConfirmAssignment, setDeleteConfirmAssignment] = useState(null);

  // ── Advanced Multi-Criteria Filter States ────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [termFilter, setTermFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL"); // "ALL" | "HOMEWORK" | "PROJECT" | "LAB" | "ESSAY"
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "ACTIVE" | "OVERDUE"
  const [sortBy, setSortBy] = useState("due-asc"); // "due-asc" | "due-desc" | "title-asc" | "title-desc" | "created-desc" | "marks-desc"

  // ── Form States ──────────────────────────────────────────────────
  const [form, setForm] = useState({
    subjectId: "",
    classId: "",
    classIds: [],
    teacherId: isTeacher() ? user?.id || "" : "",
    termId: "",
    type: "HOMEWORK",
    title: "",
    description: "",
    instructions: "",
    dueDate: "",
    totalMarks: 100,
    passingMarks: 50,
    isPublished: true,
  });
  const [submitForm, setSubmitForm] = useState({ content: "" });
  const [modalClassGradeFilter, setModalClassGradeFilter] = useState("ALL");
  const [modalClassSearch, setModalClassSearch] = useState("");

  // ── Data Fetching Queries ────────────────────────────────────────
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: [
      "assignments",
      page,
      searchQuery,
      gradeFilter,
      classFilter,
      subjectFilter,
      termFilter,
      typeFilter,
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
      if (subjectFilter !== "ALL") params.append("subjectId", subjectFilter);
      if (termFilter !== "ALL") params.append("termId", termFilter);
      if (typeFilter !== "ALL") params.append("type", typeFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (sortBy) params.append("sortBy", sortBy);

      return api.get(`/academics/assignments?${params.toString()}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  const { data: gradeLevels } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data),
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get("/academics/subjects").then((r) => r.data.data),
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
  });

  const { data: terms } = useQuery({
    queryKey: ["terms"],
    queryFn: () => api.get("/academics/terms").then((r) => r.data.data),
  });

  const { data: teachersData } = useQuery({
    queryKey: ["teachers-list"],
    queryFn: () =>
      api.get("/staff/teachers?role=TEACHER&limit=100").then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

  const teachers = teachersData ?? [];

  const sortedGradeLevels = useMemo(() => {
    return (gradeLevels ?? []).slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [gradeLevels]);

  // Filter classes based on selected grade if any
  const availableClasses = useMemo(() => {
    const raw = classes ?? [];
    if (gradeFilter === "ALL") return raw;
    return raw.filter((c) => c.gradeLevelId === gradeFilter);
  }, [classes, gradeFilter]);

  // Classes filtered inside the Add Assignment modal
  const modalFilteredClasses = useMemo(() => {
    const raw = classes ?? [];
    return raw.filter((c) => {
      if (modalClassGradeFilter !== "ALL" && c.gradeLevelId !== modalClassGradeFilter) {
        return false;
      }
      if (modalClassSearch.trim()) {
        const q = modalClassSearch.toLowerCase().trim();
        const cName = (c.name || "").toLowerCase();
        const gName = (c.gradeLevel?.name || "").toLowerCase();
        const sName = (c.section || "").toLowerCase();
        return cName.includes(q) || gName.includes(q) || sName.includes(q);
      }
      return true;
    });
  }, [classes, modalClassGradeFilter, modalClassSearch]);

  const toggleModalClassId = (classId) => {
    setForm((f) => {
      const current = f.classIds || [];
      if (current.includes(classId)) {
        const updated = current.filter((id) => id !== classId);
        return {
          ...f,
          classIds: updated,
          classId: updated.length === 1 ? updated[0] : "",
        };
      } else {
        const updated = [...current, classId];
        return {
          ...f,
          classIds: updated,
          classId: updated.length === 1 ? updated[0] : "",
        };
      }
    });
  };

  const handleSelectAllModalClasses = () => {
    const allFilteredIds = modalFilteredClasses.map((c) => c.id);
    setForm((f) => {
      const merged = Array.from(new Set([...(f.classIds || []), ...allFilteredIds]));
      return {
        ...f,
        classIds: merged,
        classId: merged.length === 1 ? merged[0] : "",
      };
    });
  };

  const handleClearModalClasses = () => {
    setForm((f) => ({
      ...f,
      classIds: [],
      classId: "",
    }));
  };

  // ── Mutations ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d) =>
      api.post("/academics/assignments", {
        ...d,
        classIds: d.classIds && d.classIds.length > 0 ? d.classIds : undefined,
        classId:
          d.classIds && d.classIds.length === 1
            ? d.classIds[0]
            : d.classId || undefined,
        teacherId: d.teacherId || (isTeacher() ? user?.id : undefined),
        type: d.type || "HOMEWORK",
        totalMarks: parseFloat(d.totalMarks) || 100,
        passingMarks: parseFloat(d.passingMarks) || 50,
        dueDate: new Date(d.dueDate).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Assignment created successfully");
      setAddOpen(false);
      setForm({
        subjectId: "",
        classId: "",
        classIds: [],
        teacherId: isTeacher() ? user?.id || "" : "",
        termId: "",
        type: "HOMEWORK",
        title: "",
        description: "",
        instructions: "",
        dueDate: "",
        totalMarks: 100,
        passingMarks: 50,
        isPublished: true,
      });
      setModalClassSearch("");
      setModalClassGradeFilter("ALL");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create assignment");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/academics/assignments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Assignment deleted");
      setDeleteConfirmAssignment(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete assignment");
    },
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, content }) =>
      api.post(`/academics/assignments/${id}/submit`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Assignment submitted successfully!");
      setSubmitOpen(null);
      setSubmitForm({ content: "" });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Submission failed");
    },
  });

  // ── Filter Helpers ───────────────────────────────────────────────
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (gradeFilter !== "ALL") count++;
    if (classFilter !== "ALL") count++;
    if (subjectFilter !== "ALL") count++;
    if (termFilter !== "ALL") count++;
    if (typeFilter !== "ALL") count++;
    if (statusFilter !== "ALL") count++;
    return count;
  }, [searchQuery, gradeFilter, classFilter, subjectFilter, termFilter, typeFilter, statusFilter]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setGradeFilter("ALL");
    setClassFilter("ALL");
    setSubjectFilter("ALL");
    setTermFilter("ALL");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setSortBy("due-asc");
    setPage(1);
  };

  const assignments = assignmentsData?.data ?? [];
  const meta = assignmentsData?.meta ?? {};
  const canCreate = isAdmin() || isTeacher();

  // Metrics summary
  const metrics = useMemo(() => {
    const raw = assignments;
    const overdueCount = raw.filter((a) => isPast(new Date(a.dueDate))).length;
    const activeCount = raw.length - overdueCount;
    const totalSubmissions = raw.reduce((sum, a) => sum + (a._count?.submissions ?? 0), 0);

    return {
      total: meta.total ?? raw.length,
      overdueCount,
      activeCount,
      totalSubmissions,
    };
  }, [assignments, meta.total]);

  const getTypeBadge = (type) => {
    switch (type) {
      case "PROJECT":
        return <Badge variant="purple">🔬 Project</Badge>;
      case "LAB":
        return <Badge variant="blue">🧪 Lab Work</Badge>;
      case "ESSAY":
        return <Badge variant="amber">📄 Essay</Badge>;
      default:
        return <Badge variant="gray">📝 Homework</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header & Stats Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-primary-600" />
            Assignments & Coursework
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Track student coursework, homework deadlines, and submission grading
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs">
            <button
              onClick={() => setViewMode("grid")}
              className={clsx(
                "p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all",
                viewMode === "grid" ? "bg-white text-primary-700 shadow-xs" : "text-gray-500 hover:text-gray-900"
              )}
              title="Grid Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={clsx(
                "p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all",
                viewMode === "table" ? "bg-white text-primary-700 shadow-xs" : "text-gray-500 hover:text-gray-900"
              )}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {canCreate && (
            <button className="btn-primary inline-flex items-center gap-1.5 shadow-sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" /> New Assignment
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Summary Pills ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Total Listed</span>
            <span className="text-lg font-black text-gray-900">{metrics.total}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Due / Active</span>
            <span className="text-lg font-black text-gray-900">{metrics.activeCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Past Deadline</span>
            <span className="text-lg font-black text-gray-900">{metrics.overdueCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Submissions</span>
            <span className="text-lg font-black text-gray-900">{metrics.totalSubmissions}</span>
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
              placeholder="Search by assignment title, subject, instructions, or teacher…"
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

            {/* Subject Dropdown */}
            <div className="flex-1 min-w-[140px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={subjectFilter}
                onChange={(e) => {
                  setSubjectFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">📚 All Subjects</option>
                {(subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Academic Term Dropdown */}
            <div className="flex-1 min-w-[130px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={termFilter}
                onChange={(e) => {
                  setTermFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">📅 All Terms</option>
                {(terms ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignment Type Dropdown */}
            <div className="flex-1 min-w-[125px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">📑 All Types</option>
                <option value="HOMEWORK">📝 Homework</option>
                <option value="PROJECT">🔬 Project</option>
                <option value="LAB">🧪 Lab Work</option>
                <option value="ESSAY">📄 Essay</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="flex-1 min-w-[120px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">⏰ All Status</option>
                <option value="ACTIVE">🟢 Active / Due</option>
                <option value="OVERDUE">🔴 Overdue</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex-1 min-w-[140px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
              >
                <option value="due-asc">Sort: Due Soonest</option>
                <option value="due-desc">Sort: Due Latest</option>
                <option value="title-asc">Sort: Title (A → Z)</option>
                <option value="title-desc">Sort: Title (Z → A)</option>
                <option value="created-desc">Sort: Recently Added</option>
                <option value="marks-desc">Sort: Highest Marks</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Active Filter Badges & Match Count ─────────────────────────── */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 font-medium">
              Showing <strong className="text-gray-900 font-bold">{assignments.length}</strong> of{" "}
              {meta.total ?? assignments.length} assignments
            </span>

            {/* Search Pill */}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery("")}>
                  <X className="w-3 h-3 hover:text-primary-900" />
                </button>
              </span>
            )}

            {/* Grade Pill */}
            {gradeFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Grade: {sortedGradeLevels.find((g) => g.id === gradeFilter)?.name}
                <button onClick={() => setGradeFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-purple-900" />
                </button>
              </span>
            )}

            {/* Class Pill */}
            {classFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Class: {availableClasses.find((c) => c.id === classFilter)?.name}
                <button onClick={() => setClassFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-blue-900" />
                </button>
              </span>
            )}

            {/* Subject Pill */}
            {subjectFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Subject: {(subjects ?? []).find((s) => s.id === subjectFilter)?.name}
                <button onClick={() => setSubjectFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-emerald-900" />
                </button>
              </span>
            )}

            {/* Term Pill */}
            {termFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Term: {(terms ?? []).find((t) => t.id === termFilter)?.name}
                <button onClick={() => setTermFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-indigo-900" />
                </button>
              </span>
            )}

            {/* Type Pill */}
            {typeFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Type: {typeFilter}
                <button onClick={() => setTypeFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-amber-900" />
                </button>
              </span>
            )}

            {/* Status Pill */}
            {statusFilter !== "ALL" && (
              <span
                className={clsx(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                  statusFilter === "OVERDUE"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                )}
              >
                Status: {statusFilter}
                <button onClick={() => setStatusFilter("ALL")}>
                  <X className="w-3 h-3" />
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

      {/* ── Content View (Grid vs Table) ─────────────────────────────────── */}
      {assignmentsLoading ? (
        <PageLoader />
      ) : assignments.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={BookOpen}
            title="No assignments found"
            description={
              activeFiltersCount > 0
                ? "No assignments match your current filter criteria. Try clearing some filters."
                : canCreate
                ? "Create the first assignment for your class using the button above."
                : "No assignments have been assigned to your class yet."
            }
          />
          {activeFiltersCount > 0 && (
            <button onClick={resetAllFilters} className="btn-secondary text-xs mt-4 inline-flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* ════ GRID CARD VIEW ════ */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((a) => {
            const deadlineEval = evaluateDeadline(a.dueDate, timezone);

            return (
              <div
                key={a.id}
                className="card p-5 hover:shadow-md transition-all duration-200 border border-gray-200 flex flex-col justify-between group bg-white"
              >
                <div>
                  {/* Badges Row */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="badge-primary badge text-[11px] font-bold">
                        {a.subject?.name}
                      </span>

                      {a.subject?.gradeLevel && (
                        <Badge variant="purple">
                          <GraduationCap className="w-3 h-3 inline mr-1" />
                          {a.subject.gradeLevel.name}
                        </Badge>
                      )}

                      {a.class && (
                        <Badge variant="blue">
                          <Users className="w-3 h-3 inline mr-1" />
                          {a.class.name}
                        </Badge>
                      )}

                      {getTypeBadge(a.type)}
                    </div>

                    {/* Timezone-aware Deadline Status Badge */}
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        deadlineEval.status === "HEALTHY" &&
                          "bg-emerald-50 text-emerald-700 border-emerald-200",
                        deadlineEval.status === "APPROACHING" &&
                          "bg-amber-50 text-amber-700 border-amber-200",
                        deadlineEval.status === "URGENT" &&
                          "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
                        deadlineEval.status === "OVERDUE" &&
                          "bg-red-100 text-red-800 border-red-300 font-extrabold"
                      )}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {deadlineEval.humanCountdown}
                    </span>
                  </div>

                  {/* Assignment Title */}
                  <Link
                    to={`/assignments/${a.id}`}
                    className="font-extrabold text-sm text-gray-900 group-hover:text-primary-600 transition-colors block line-clamp-1 mb-1"
                  >
                    {a.title}
                  </Link>

                  {/* Description */}
                  {a.description ? (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {a.description}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No description provided</p>
                  )}

                  {/* Term & Marks Meta */}
                  <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-gray-100 text-[11px] text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Due {formatInSchoolTimezone(a.dueDate, timezone)}
                    </span>
                    <span className="font-semibold text-gray-700">· {a.totalMarks} marks</span>
                    {a.term && <span className="text-gray-400">· {a.term.name}</span>}
                  </div>
                </div>

                {/* Card Footer: Submissions & Actions */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500 font-medium">
                    <strong className="text-gray-900 font-bold">{a._count?.submissions ?? 0}</strong> submissions
                  </span>

                  <div className="flex items-center gap-1.5">
                    {isStudent() && (
                      <button
                        className="btn-primary btn-sm text-xs py-1 px-2.5 inline-flex items-center gap-1"
                        onClick={() => setSubmitOpen(a)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Submit
                      </button>
                    )}

                    <Link to={`/assignments/${a.id}`} className="btn-secondary btn-sm text-xs py-1 px-2.5">
                      Details →
                    </Link>

                    {canCreate && (
                      <button
                        className="btn-ghost p-1 text-gray-400 hover:text-red-600 rounded"
                        onClick={() => setDeleteConfirmAssignment(a)}
                        title="Delete Assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                  <th className="py-3 px-4">Assignment</th>
                  <th className="py-3 px-4">Subject & Grade</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Due Date ({timezone})</th>
                  <th className="py-3 px-4">Total Marks</th>
                  <th className="py-3 px-4">Submissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((a) => {
                  const deadlineEval = evaluateDeadline(a.dueDate, timezone);

                  return (
                    <tr key={a.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/assignments/${a.id}`}
                          className="font-extrabold text-gray-900 hover:text-primary-600 block text-xs"
                        >
                          {a.title}
                        </Link>
                        {a.description && (
                          <p className="text-[11px] text-gray-400 font-normal line-clamp-1 mt-0.5">
                            {a.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-800">{a.subject?.name}</span>
                          {a.subject?.gradeLevel && (
                            <Badge variant="purple">
                              <GraduationCap className="w-3 h-3 inline mr-1" />
                              {a.subject.gradeLevel.name}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {a.class ? (
                          <Badge variant="blue">
                            <Users className="w-3 h-3 inline mr-1" />
                            {a.class.name}
                          </Badge>
                        ) : (
                          <Badge variant="gray">All Classes</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{getTypeBadge(a.type)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-700">
                            {formatInSchoolTimezone(a.dueDate, timezone)}
                          </span>
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold border",
                              deadlineEval.status === "HEALTHY" &&
                                "bg-emerald-50 text-emerald-700 border-emerald-200",
                              deadlineEval.status === "APPROACHING" &&
                                "bg-amber-50 text-amber-700 border-amber-200",
                              deadlineEval.status === "URGENT" &&
                                "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
                              deadlineEval.status === "OVERDUE" &&
                                "bg-red-100 text-red-800 border-red-300 font-extrabold"
                            )}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {deadlineEval.humanCountdown}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-900">{a.totalMarks} pts</td>
                      <td className="py-3.5 px-4 text-gray-600 font-semibold">
                        {a._count?.submissions ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isStudent() && (
                            <button
                              className="btn-primary btn-sm text-xs py-1 px-2"
                              onClick={() => setSubmitOpen(a)}
                            >
                              Submit
                            </button>
                          )}
                          <Link to={`/assignments/${a.id}`} className="btn-secondary btn-sm text-xs py-1 px-2">
                            View
                          </Link>
                          {canCreate && (
                            <button
                              className="btn-ghost p-1 text-gray-400 hover:text-red-600 rounded"
                              onClick={() => setDeleteConfirmAssignment(a)}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {meta.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={meta.totalPages ?? 1}
          onChange={setPage}
        />
      )}

      {/* ── Create Assignment Modal ────────────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create New Assignment"
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
                createMutation.isPending ||
                !form.title.trim() ||
                !form.subjectId ||
                !form.termId ||
                !form.dueDate
              }
            >
              {createMutation.isPending ? "Creating…" : "Create Assignment"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="label font-bold">Assignment Title *</label>
            <input
              className="input text-xs"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Chapter 4 Calculus Problem Set, Chemistry Lab Report…"
              required
              autoFocus
            />
          </div>

          {/* ── Responsible Teacher / Instructor Field ─────────────────────────── */}
          <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="label font-bold text-gray-900 mb-0 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-primary-600" />
                Responsible Teacher / Instructor
              </label>
              {isAdmin() ? (
                <span className="text-[10px] font-bold text-primary-700 bg-primary-100/70 px-2 py-0.5 rounded-full">
                  Admin Scope (Choose Teacher)
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Authorized Profile
                </span>
              )}
            </div>

            {isAdmin() ? (
              <div className="space-y-1">
                <select
                  className="input text-xs bg-white font-semibold"
                  value={form.teacherId}
                  onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
                >
                  <option value="">— Select Teacher (Default: Self / Admin) —</option>
                  <option value={user?.id}>
                    👨‍💼 {user?.firstName} {user?.lastName} (You — Administrator)
                  </option>
                  {teachers.length > 0 && (
                    <optgroup label="👨‍🏫 Available School Teachers">
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          👨‍🏫 {t.firstName} {t.lastName} {t.teacherProfile?.specialization ? `(Spec: ${t.teacherProfile.specialization})` : ""} {t.teacherProfile?.employeeId ? `[${t.teacherProfile.employeeId}]` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-[10px] text-gray-500">
                  As Administrator, you can assign this assignment to any teacher in the school or create it under your own account.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-blue-200 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {user?.firstName?.[0] || "T"}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs flex items-center gap-1">
                      {user?.firstName} {user?.lastName}{" "}
                      <span className="text-primary-600 font-semibold">(You)</span>
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {user?.email}
                      {user?.teacherProfile?.specialization
                        ? ` • Spec: ${user.teacherProfile.specialization}`
                        : ""}
                    </p>
                  </div>
                </div>
                <Badge variant="blue">Assigned Instructor</Badge>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Subject *</label>
              <select
                className="input text-xs"
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
                required
              >
                <option value="">— Select Subject —</option>
                {(subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.gradeLevel ? `(${s.gradeLevel.name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label font-bold">Academic Term *</label>
              <select
                className="input text-xs"
                value={form.termId}
                onChange={(e) => setForm((f) => ({ ...f, termId: e.target.value }))}
                required
              >
                <option value="">— Select Academic Term —</option>
                {(terms ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Multi-Class Selection Panel ─────────────────────────────────── */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="label font-bold text-gray-900 mb-0 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary-600" />
                Target Class(es)
                <span className="text-[11px] font-normal text-gray-500">
                  (Select one, multiple, or all)
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllModalClasses}
                  className="text-[11px] font-bold text-primary-600 hover:underline"
                >
                  Select All Filtered
                </button>
                {form.classIds?.length > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <button
                      type="button"
                      onClick={handleClearModalClasses}
                      className="text-[11px] font-bold text-red-600 hover:underline"
                    >
                      Clear All ({form.classIds.length})
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Filters Row (Grade scope + search) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                className="input py-1.5 text-xs bg-white"
                value={modalClassGradeFilter}
                onChange={(e) => setModalClassGradeFilter(e.target.value)}
              >
                <option value="ALL">🎓 All Grade Levels</option>
                {sortedGradeLevels.map((gl) => (
                  <option key={gl.id} value={gl.id}>
                    {gl.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-8 pr-7 text-xs py-1.5 w-full bg-white"
                  placeholder="Filter classes by section or name..."
                  value={modalClassSearch}
                  onChange={(e) => setModalClassSearch(e.target.value)}
                />
                {modalClassSearch && (
                  <button
                    type="button"
                    onClick={() => setModalClassSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Selected Classes Chips Preview */}
            {form.classIds?.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap p-2 bg-white rounded-xl border border-primary-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">
                  Selected ({form.classIds.length}):
                </span>
                {form.classIds.map((cid) => {
                  const matchedClass = (classes ?? []).find((c) => c.id === cid);
                  return (
                    <span
                      key={cid}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-primary-50 text-primary-800 border border-primary-200"
                    >
                      {matchedClass?.name || cid}
                      {matchedClass?.gradeLevel ? (
                        <span className="text-[10px] text-primary-600 font-normal">
                          ({matchedClass.gradeLevel.name})
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleModalClassId(cid)}
                        className="text-primary-400 hover:text-primary-800 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                ℹ️ <strong>No specific class selected:</strong> This assignment will apply to all classes enrolled in the selected subject. Check specific classes below to restrict.
              </p>
            )}

            {/* Classes Checkbox Grid */}
            <div className="border border-gray-200 rounded-xl bg-white max-h-40 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 shadow-inner">
              {modalFilteredClasses.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400 col-span-2">
                  No classes match your filter criteria
                </div>
              ) : (
                modalFilteredClasses.map((c) => {
                  const isChecked = (form.classIds || []).includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={clsx(
                        "flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all",
                        isChecked
                          ? "bg-primary-50/70 border-primary-300 text-primary-900 font-bold shadow-2xs"
                          : "border-gray-100 hover:bg-gray-50 text-gray-700 font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModalClassId(c.id)}
                          className="rounded text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                        />
                        <span className="truncate">{c.name}</span>
                      </div>
                      {c.gradeLevel && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-normal">
                          {c.gradeLevel.name}
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Assignment Type</label>
              <select
                className="input text-xs"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="HOMEWORK">📝 Homework</option>
                <option value="PROJECT">🔬 Project</option>
                <option value="LAB">🧪 Lab Work</option>
                <option value="ESSAY">📄 Essay / Report</option>
              </select>
            </div>

            <div>
              <label className="label font-bold">Due Date & Time *</label>
              <input
                className="input text-xs"
                type="datetime-local"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="label font-bold">Total Marks</label>
              <input
                className="input text-xs"
                type="number"
                min={1}
                value={form.totalMarks}
                onChange={(e) => setForm((f) => ({ ...f, totalMarks: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Summary / Description</label>
            <textarea
              className="input text-xs min-h-16 resize-none"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short summary of the assignment goals..."
            />
          </div>

          <div>
            <label className="label font-bold">Detailed Instructions (Optional)</label>
            <textarea
              className="input text-xs min-h-20 resize-none"
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              placeholder="Detailed guidelines, submission criteria, formatting requirements..."
            />
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
              />
              <div>
                <span className="font-bold text-gray-900 block text-xs">
                  Publish Immediately
                </span>
                <span className="text-[11px] text-gray-500 block">
                  Notify all enrolled students and make it visible on their dashboard.
                </span>
              </div>
            </label>
          </div>
        </div>
      </Modal>

      {/* ── Submit Assignment Modal ────────────────────────────────────────── */}
      <Modal
        open={!!submitOpen}
        onClose={() => setSubmitOpen(null)}
        title={`Submit Assignment: ${submitOpen?.title}`}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSubmitOpen(null)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() =>
                submitMutation.mutate({
                  id: submitOpen?.id,
                  content: submitForm.content,
                })
              }
              disabled={submitMutation.isPending || !submitForm.content.trim()}
            >
              {submitMutation.isPending ? "Submitting…" : "Submit Assignment"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-primary-50/70 border border-primary-200 rounded-xl text-primary-900">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{submitOpen?.subject?.name}</span>
              <span className="text-[11px] text-primary-700">
                Due: {submitOpen && format(new Date(submitOpen.dueDate), "dd MMM yyyy, HH:mm")}
              </span>
            </div>
            {submitOpen?.description && (
              <p className="text-xs text-primary-800 mt-1">{submitOpen.description}</p>
            )}
          </div>

          <div>
            <label className="label font-bold">Your Response / Submission Notes *</label>
            <textarea
              className="input text-xs min-h-32 resize-none"
              value={submitForm.content}
              onChange={(e) => setSubmitForm({ content: e.target.value })}
              placeholder="Write your answer, response notes, or cloud document links here…"
              required
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* ── Confirm Delete Assignment Modal ────────────────────────────────── */}
      <Modal
        open={!!deleteConfirmAssignment}
        onClose={() => setDeleteConfirmAssignment(null)}
        title="Confirm Delete Assignment"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteConfirmAssignment(null)}>
              Cancel
            </button>
            <button
              className="btn-primary bg-red-600 hover:bg-red-700 inline-flex items-center gap-1.5"
              onClick={() => deleteMutation.mutate(deleteConfirmAssignment.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMutation.isPending ? "Deleting…" : "Delete Assignment"}
            </button>
          </>
        }
      >
        <p className="text-xs text-gray-600">
          Are you sure you want to delete assignment{" "}
          <strong className="text-gray-900">{deleteConfirmAssignment?.title}</strong>? All student submissions and
          grades linked to this assignment will be removed.
        </p>
      </Modal>
    </div>
  );
}
