import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus,
  Clock,
  CheckSquare,
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
  MapPin,
  CheckCircle2,
  AlertCircle,
  Award,
  Edit2,
  Trash2,
  Send,
  BookOpen,
  Download,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState, Pagination } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import { useAuthStore } from "../../store/authStore";
import clsx from "clsx";
import { format, isPast } from "date-fns";
import toast from "react-hot-toast";

export default function ExamsPage() {
  const { isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const canCreate = isAdmin() || isTeacher();

  // ── Modals & View Mode State ─────────────────────────────────────
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [addOpen, setAddOpen] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const [deleteConfirmExam, setDeleteConfirmExam] = useState(null);

  // ── Advanced Multi-Criteria Filter States ────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [termFilter, setTermFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL"); // "ALL" | "QUIZ" | "MID_TERM" | "FINAL" | "MOCK" | "STANDARDIZED"
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "UPCOMING" | "COMPLETED" | "PUBLISHED" | "DRAFT"
  const [sortBy, setSortBy] = useState("date-asc"); // "date-asc" | "date-desc" | "title-asc" | "title-desc" | "marks-desc" | "created-desc"

  // ── Form States ──────────────────────────────────────────────────
  const [form, setForm] = useState({
    subjectId: "",
    classId: "",
    gradeLevelId: "",
    termId: "",
    title: "",
    examType: "MID_TERM",
    totalMarks: 100,
    passingMarks: 50,
    duration: 120,
    scheduledAt: "",
    venue: "",
    instructions: "",
  });

  // ── Data Fetching Queries ────────────────────────────────────────
  const { data: examsData, isLoading: examsLoading } = useQuery({
    queryKey: [
      "exams",
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
      if (typeFilter !== "ALL") params.append("examType", typeFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (sortBy) params.append("sortBy", sortBy);

      return api.get(`/academics/exams?${params.toString()}`).then((r) => r.data);
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

  const sortedGradeLevels = useMemo(() => {
    return (gradeLevels ?? []).slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [gradeLevels]);

  const availableClasses = useMemo(() => {
    const raw = classes ?? [];
    if (gradeFilter === "ALL") return raw;
    return raw.filter((c) => c.gradeLevelId === gradeFilter);
  }, [classes, gradeFilter]);

  // ── Mutations ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d) =>
      api.post("/academics/exams", {
        ...d,
        classId: d.classId || undefined,
        gradeLevelId: d.gradeLevelId || undefined,
        totalMarks: parseFloat(d.totalMarks) || 100,
        passingMarks: parseFloat(d.passingMarks) || 50,
        duration: parseInt(d.duration, 10) || 120,
        scheduledAt: new Date(d.scheduledAt).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam scheduled successfully");
      setAddOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create exam");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) =>
      api.patch(`/academics/exams/${id}`, {
        ...data,
        classId: data.classId || undefined,
        gradeLevelId: data.gradeLevelId || undefined,
        totalMarks: parseFloat(data.totalMarks) || 100,
        passingMarks: parseFloat(data.passingMarks) || 50,
        duration: parseInt(data.duration, 10) || 120,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam updated successfully");
      setEditExam(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update exam");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/academics/exams/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam deleted");
      setDeleteConfirmExam(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete exam");
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id) => api.patch(`/academics/exams/${id}/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam published & students notified");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to publish exam");
    },
  });

  // ── Helper Functions ─────────────────────────────────────────────
  const resetForm = () => {
    setForm({
      subjectId: "",
      classId: "",
      gradeLevelId: "",
      termId: "",
      title: "",
      examType: "MID_TERM",
      totalMarks: 100,
      passingMarks: 50,
      duration: 120,
      scheduledAt: "",
      venue: "",
      instructions: "",
    });
  };

  const handleEditOpen = (exam) => {
    setEditExam(exam);
    setForm({
      subjectId: exam.subjectId || "",
      classId: exam.classId || "",
      gradeLevelId: exam.gradeLevelId || exam.class?.gradeLevelId || "",
      termId: exam.termId || "",
      title: exam.title || "",
      examType: exam.examType || "MID_TERM",
      totalMarks: exam.totalMarks || 100,
      passingMarks: exam.passingMarks || 50,
      duration: exam.duration || 120,
      scheduledAt: exam.scheduledAt ? new Date(exam.scheduledAt).toISOString().slice(0, 16) : "",
      venue: exam.venue || "",
      instructions: exam.instructions || "",
    });
  const [downloadingMarksheetId, setDownloadingMarksheetId] = useState(null);

  const handleDownloadMarksheet = async (exam) => {
    try {
      setDownloadingMarksheetId(exam.id);
      const res = await api.get(`/academics/exams/${exam.id}/marksheet`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marksheet-${exam.subject?.code || "exam"}-${(exam.title || "sheet").replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Marksheet downloaded successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to download exam marksheet PDF");
    } finally {
      setDownloadingMarksheetId(null);
    }
  };

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
    setSortBy("date-asc");
    setPage(1);
  };

  const exams = examsData?.data ?? [];
  const meta = examsData?.meta ?? {};

  // Metrics summary
  const metrics = useMemo(() => {
    const raw = exams;
    const upcomingCount = raw.filter((e) => !isPast(new Date(e.scheduledAt))).length;
    const completedCount = raw.length - upcomingCount;
    const publishedCount = raw.filter((e) => e.isPublished).length;

    return {
      total: meta.total ?? raw.length,
      upcomingCount,
      completedCount,
      publishedCount,
    };
  }, [exams, meta.total]);

  const getExamTypeBadge = (type) => {
    switch (type) {
      case "FINAL":
        return <Badge variant="purple">🎓 Final Exam</Badge>;
      case "MID_TERM":
        return <Badge variant="blue">📝 Mid Term</Badge>;
      case "QUIZ":
        return <Badge variant="amber">⚡ Quiz</Badge>;
      case "MOCK":
        return <Badge variant="gray">🎯 Mock Exam</Badge>;
      case "STANDARDIZED":
        return <Badge variant="green">🌐 Standardized</Badge>;
      default:
        return <Badge variant="gray">{type?.replace("_", " ")}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header & Action Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-primary-600" />
            Examinations & Assessments
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Organize examination schedules, venue allocations, passing criteria, and results
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
            <button
              className="btn-primary inline-flex items-center gap-1.5 shadow-sm"
              onClick={() => {
                resetForm();
                setAddOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Schedule Exam
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
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Total Scheduled</span>
            <span className="text-lg font-black text-gray-900">{metrics.total}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Upcoming / Active</span>
            <span className="text-lg font-black text-gray-900">{metrics.upcomingCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Completed</span>
            <span className="text-lg font-black text-gray-900">{metrics.completedCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Published</span>
            <span className="text-lg font-black text-gray-900">{metrics.publishedCount}</span>
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
              placeholder="Search by exam title, subject, venue/hall, or instructions…"
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

            {/* Exam Type Dropdown */}
            <div className="flex-1 min-w-[125px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">📑 All Exam Types</option>
                <option value="MID_TERM">📝 Mid Term</option>
                <option value="FINAL">🎓 Final Exam</option>
                <option value="QUIZ">⚡ Quiz</option>
                <option value="MOCK">🎯 Mock Exam</option>
                <option value="STANDARDIZED">🌐 Standardized</option>
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
                <option value="ALL">⏰ All Status</option>
                <option value="UPCOMING">🟢 Upcoming</option>
                <option value="COMPLETED">🏁 Completed</option>
                <option value="PUBLISHED">📢 Published</option>
                <option value="DRAFT">📝 Draft / Unpublished</option>
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
                <option value="date-asc">Sort: Date (Soonest)</option>
                <option value="date-desc">Sort: Date (Latest)</option>
                <option value="title-asc">Sort: Title (A → Z)</option>
                <option value="title-desc">Sort: Title (Z → A)</option>
                <option value="marks-desc">Sort: Highest Marks</option>
                <option value="created-desc">Sort: Recently Added</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Active Filter Badges & Match Count ─────────────────────────── */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 font-medium">
              Showing <strong className="text-gray-900 font-bold">{exams.length}</strong> of{" "}
              {meta.total ?? exams.length} exams
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
                Type: {typeFilter.replace("_", " ")}
                <button onClick={() => setTypeFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-amber-900" />
                </button>
              </span>
            )}

            {/* Status Pill */}
            {statusFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-rose-900" />
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
      {examsLoading ? (
        <PageLoader />
      ) : exams.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={CheckSquare}
            title="No exams found"
            description={
              activeFiltersCount > 0
                ? "No examination records match your current search and filter criteria. Try clearing some filters."
                : canCreate
                ? "Schedule your first examination using the button above."
                : "No examinations have been scheduled for your class yet."
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
          {exams.map((e) => {
            const completed = isPast(new Date(e.scheduledAt));

            return (
              <div
                key={e.id}
                className="card p-5 hover:shadow-md transition-all duration-200 border border-gray-200 flex flex-col justify-between group bg-white"
              >
                <div>
                  {/* Badges Row */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="badge-primary badge text-[11px] font-bold">
                        {e.subject?.name}
                      </span>

                      {e.gradeLevel ? (
                        <Badge variant="purple">
                          <GraduationCap className="w-3 h-3 inline mr-1" />
                          {e.gradeLevel.name}
                        </Badge>
                      ) : e.class?.gradeLevel ? (
                        <Badge variant="purple">
                          <GraduationCap className="w-3 h-3 inline mr-1" />
                          {e.class.gradeLevel.name}
                        </Badge>
                      ) : null}

                      {e.class && (
                        <Badge variant="blue">
                          <Users className="w-3 h-3 inline mr-1" />
                          {e.class.name}
                        </Badge>
                      )}

                      {getExamTypeBadge(e.examType)}
                    </div>

                    {e.isPublished ? (
                      <span className="badge-green badge text-[10px] font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Published
                      </span>
                    ) : (
                      <span className="badge-yellow badge text-[10px] font-bold inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Draft
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-extrabold text-sm text-gray-900 group-hover:text-primary-600 transition-colors block line-clamp-1 mb-1">
                    {e.title}
                  </h3>

                  {/* Instructions snippet */}
                  {e.instructions ? (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-2">
                      {e.instructions}
                    </p>
                  ) : null}

                  {/* Schedule Details */}
                  <div className="space-y-1.5 mt-3 pt-2.5 border-t border-gray-100 text-[11px] text-gray-500">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 font-semibold text-gray-700">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {format(new Date(e.scheduledAt), "dd MMM yyyy, HH:mm")}
                      </span>
                      {completed ? (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          Completed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Upcoming
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-gray-500 flex-wrap">
                      <span>⏱️ {e.duration} mins</span>
                      <span>· 🎯 {e.totalMarks} marks (Pass: {e.passingMarks})</span>
                      {e.term && <span>· 📅 {e.term.name}</span>}
                    </div>

                    {e.venue && (
                      <div className="flex items-center gap-1 text-primary-700 font-medium pt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-primary-500" />
                        <span>Venue: {e.venue}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500 font-medium">
                    <strong className="text-gray-900 font-bold">{e._count?.results ?? 0}</strong> results recorded
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      className="btn-ghost p-1 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded text-xs inline-flex items-center gap-1"
                      onClick={() => handleDownloadMarksheet(e)}
                      disabled={downloadingMarksheetId === e.id}
                      title="Download PDF Marksheet"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline text-[11px] font-semibold">
                        {downloadingMarksheetId === e.id ? "Downloading…" : "Marksheet"}
                      </span>
                    </button>

                    {canCreate && !e.isPublished && (
                      <button
                        className="btn-primary btn-sm text-xs py-1 px-2.5 inline-flex items-center gap-1"
                        onClick={() => publishMutation.mutate(e.id)}
                        disabled={publishMutation.isPending}
                      >
                        <Send className="w-3 h-3" /> Publish
                      </button>
                    )}

                    {canCreate && (
                      <>
                        <button
                          className="btn-ghost p-1 text-gray-400 hover:text-primary-600 rounded"
                          onClick={() => handleEditOpen(e)}
                          title="Edit Exam"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="btn-ghost p-1 text-gray-400 hover:text-red-600 rounded"
                          onClick={() => setDeleteConfirmExam(e)}
                          title="Delete Exam"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
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
                  <th className="py-3 px-4">Exam Assessment</th>
                  <th className="py-3 px-4">Subject & Grade</th>
                  <th className="py-3 px-4">Target Class</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Duration & Marks</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {exams.map((e) => {
                  const completed = isPast(new Date(e.scheduledAt));

                  return (
                    <tr key={e.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-extrabold text-gray-900 text-xs">{e.title}</p>
                        {e.venue && (
                          <p className="text-[11px] text-gray-400 font-normal mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {e.venue}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-800">{e.subject?.name}</span>
                          {e.gradeLevel ? (
                            <Badge variant="purple">
                              <GraduationCap className="w-3 h-3 inline mr-1" />
                              {e.gradeLevel.name}
                            </Badge>
                          ) : e.class?.gradeLevel ? (
                            <Badge variant="purple">
                              <GraduationCap className="w-3 h-3 inline mr-1" />
                              {e.class.gradeLevel.name}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {e.class ? (
                          <Badge variant="blue">
                            <Users className="w-3 h-3 inline mr-1" />
                            {e.class.name}
                          </Badge>
                        ) : (
                          <Badge variant="gray">All Classes</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{getExamTypeBadge(e.examType)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-700">
                            {format(new Date(e.scheduledAt), "dd MMM yyyy, HH:mm")}
                          </span>
                          {completed ? (
                            <span className="badge-gray badge text-[10px]">Past</span>
                          ) : (
                            <span className="badge-green badge text-[10px]">Upcoming</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-gray-900">{e.totalMarks} pts</span>
                        <span className="text-gray-400 text-[11px] block">{e.duration} mins · Pass: {e.passingMarks}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={e.isPublished ? "green" : "yellow"}>
                          {e.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="btn-ghost p-1 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                            onClick={() => handleDownloadMarksheet(e)}
                            disabled={downloadingMarksheetId === e.id}
                            title="Download PDF Marksheet"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                          </button>

                          {canCreate && !e.isPublished && (
                            <button
                              className="btn-primary btn-sm text-xs py-1 px-2"
                              onClick={() => publishMutation.mutate(e.id)}
                            >
                              Publish
                            </button>
                          )}
                          {canCreate && (
                            <>
                              <button
                                className="btn-ghost p-1 text-gray-400 hover:text-primary-600 rounded"
                                onClick={() => handleEditOpen(e)}
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="btn-ghost p-1 text-gray-400 hover:text-red-600 rounded"
                                onClick={() => setDeleteConfirmExam(e)}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
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

      {/* ── Schedule / Edit Exam Modal ──────────────────────────────────────── */}
      <Modal
        open={addOpen || !!editExam}
        onClose={() => {
          setAddOpen(false);
          setEditExam(null);
        }}
        title={editExam ? `Edit Exam: ${editExam.title}` : "Schedule Examination"}
        size="lg"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                setAddOpen(false);
                setEditExam(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() =>
                editExam
                  ? updateMutation.mutate({ id: editExam.id, data: form })
                  : createMutation.mutate(form)
              }
              disabled={
                editExam
                  ? updateMutation.isPending || !form.title.trim() || !form.subjectId || !form.termId || !form.scheduledAt
                  : createMutation.isPending || !form.title.trim() || !form.subjectId || !form.termId || !form.scheduledAt
              }
            >
              {editExam
                ? updateMutation.isPending
                  ? "Updating…"
                  : "Save Changes"
                : createMutation.isPending
                ? "Scheduling…"
                : "Schedule Exam"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="label font-bold">Exam Assessment Title *</label>
            <input
              className="input text-xs"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Term 1 Calculus Assessment, Chemistry Lab Practical Exam…"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Grade Level (Optional)</label>
              <select
                className="input text-xs"
                value={form.gradeLevelId}
                onChange={(e) => {
                  const glId = e.target.value;
                  setForm((f) => ({ ...f, gradeLevelId: glId, classId: "" }));
                }}
              >
                <option value="">— Select Grade Level —</option>
                {sortedGradeLevels.map((gl) => (
                  <option key={gl.id} value={gl.id}>
                    {gl.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label font-bold">Target Class (Optional)</label>
              <select
                className="input text-xs"
                value={form.classId}
                onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
              >
                <option value="">— All Classes for Subject —</option>
                {(classes ?? [])
                  .filter((c) => !form.gradeLevelId || c.gradeLevelId === form.gradeLevelId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ""}
                    </option>
                  ))}
              </select>
            </div>

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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Academic Term *</label>
              <select
                className="input text-xs"
                value={form.termId}
                onChange={(e) => setForm((f) => ({ ...f, termId: e.target.value }))}
                required
              >
                <option value="">— Select Term —</option>
                {(terms ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label font-bold">Exam Type</label>
              <select
                className="input text-xs"
                value={form.examType}
                onChange={(e) => setForm((f) => ({ ...f, examType: e.target.value }))}
              >
                <option value="MID_TERM">📝 Mid Term</option>
                <option value="FINAL">🎓 Final Exam</option>
                <option value="QUIZ">⚡ Quiz</option>
                <option value="MOCK">🎯 Mock Exam</option>
                <option value="STANDARDIZED">🌐 Standardized</option>
              </select>
            </div>

            <div>
              <label className="label font-bold">Scheduled Date & Time *</label>
              <input
                className="input text-xs"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            <div>
              <label className="label font-bold">Passing Marks</label>
              <input
                className="input text-xs"
                type="number"
                min={0}
                value={form.passingMarks}
                onChange={(e) => setForm((f) => ({ ...f, passingMarks: e.target.value }))}
              />
            </div>

            <div>
              <label className="label font-bold">Duration (Minutes)</label>
              <input
                className="input text-xs"
                type="number"
                min={1}
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Venue / Examination Hall</label>
            <input
              className="input text-xs"
              value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              placeholder="e.g. Main Auditorium, Science Hall 2, Room 304, or Online CBT…"
            />
          </div>

          <div>
            <label className="label font-bold">Instructions / Candidate Guidelines (Optional)</label>
            <textarea
              className="input text-xs min-h-16 resize-none"
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              placeholder="e.g. Bring scientific calculator, no electronic devices allowed, arrive 15 minutes prior..."
            />
          </div>
        </div>
      </Modal>

      {/* ── Confirm Delete Exam Modal ────────────────────────────────────────── */}
      <Modal
        open={!!deleteConfirmExam}
        onClose={() => setDeleteConfirmExam(null)}
        title="Confirm Delete Exam"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteConfirmExam(null)}>
              Cancel
            </button>
            <button
              className="btn-primary bg-red-600 hover:bg-red-700 inline-flex items-center gap-1.5"
              onClick={() => deleteMutation.mutate(deleteConfirmExam.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMutation.isPending ? "Deleting…" : "Delete Exam"}
            </button>
          </>
        }
      >
        <p className="text-xs text-gray-600">
          Are you sure you want to delete exam{" "}
          <strong className="text-gray-900">{deleteConfirmExam?.title}</strong>? All student marks and results recorded
          for this exam will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}
