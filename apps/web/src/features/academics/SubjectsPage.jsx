import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  BookOpen,
  Trash2,
  Edit2,
  GraduationCap,
  Search,
  Filter,
  X,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  Circle,
  Sparkles,
  Users,
  Award,
  BookMarked,
  Clock,
  Layers,
  CheckSquare,
  Square,
  Globe,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import clsx from "clsx";
import toast from "react-hot-toast";

export function SubjectsPage() {
  const qc = useQueryClient();

  // ── Modals & Editing State ───────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deleteConfirmSubject, setDeleteConfirmSubject] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"

  // ── Advanced Filters State ───────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL"); // "ALL" | "CORE" | "ELECTIVE"
  const [creditFilter, setCreditFilter] = useState("ALL"); // "ALL" | "1-2" | "3" | "4+"
  const [teachingFilter, setTeachingFilter] = useState("ALL"); // "ALL" | "ASSIGNED" | "UNASSIGNED"
  const [sortBy, setSortBy] = useState("name-asc"); // "name-asc" | "name-desc" | "grade-asc" | "grade-desc" | "code-asc" | "classes-desc" | "credits-desc"

  // ── Subject Create / Edit Form State ─────────────────────────────
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    gradeLevelIds: [], // string[] of selected GradeLevel IDs
    creditHours: 3,
    isCore: true,
  });

  // ── Data Fetching ────────────────────────────────────────────────
  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get("/academics/subjects").then((r) => r.data.data),
  });

  const { data: gradeLevels, isLoading: gradesLoading } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data),
  });

  const sortedGradeLevels = useMemo(() => {
    return (gradeLevels ?? []).slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [gradeLevels]);

  // ── Mutations ────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (d) => {
      const payload = {
        name: d.name.trim(),
        code: d.code.trim().toUpperCase(),
        description: d.description?.trim() || "",
        creditHours: parseInt(d.creditHours) || 3,
        gradeLevelIds: d.gradeLevelIds || [],
        gradeLevelId: d.gradeLevelIds?.length === 1 ? d.gradeLevelIds[0] : null,
        isCore: Boolean(d.isCore),
      };

      if (editingSubject?.id) {
        return api.patch(`/academics/subjects/${editingSubject.id}`, payload);
      }
      return api.post("/academics/subjects", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(editingSubject ? "Subject updated successfully" : "Subject created successfully");
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save subject");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/academics/subjects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject deleted");
      setDeleteConfirmSubject(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete subject");
    },
  });

  // ── Modal Handlers ───────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingSubject(null);
    let initialGradeIds = [];
    if (gradeFilter !== "ALL" && gradeFilter !== "UNASSIGNED") {
      initialGradeIds = [gradeFilter];
    }
    setForm({
      name: "",
      code: "",
      description: "",
      gradeLevelIds: initialGradeIds,
      creditHours: 3,
      isCore: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (subject) => {
    setEditingSubject(subject);
    setForm({
      name: subject.name,
      code: subject.code,
      description: subject.description || "",
      gradeLevelIds: subject.gradeLevelId ? [subject.gradeLevelId] : [],
      creditHours: subject.creditHours ?? 3,
      isCore: subject.isCore ?? true,
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSubject(null);
    setForm({
      name: "",
      code: "",
      description: "",
      gradeLevelIds: [],
      creditHours: 3,
      isCore: true,
    });
  };

  // ── Multi-Select Grade Scope Helpers ─────────────────────────────
  const toggleGradeSelection = (gradeId) => {
    setForm((prev) => {
      const exists = prev.gradeLevelIds.includes(gradeId);
      if (exists) {
        return { ...prev, gradeLevelIds: prev.gradeLevelIds.filter((id) => id !== gradeId) };
      } else {
        return { ...prev, gradeLevelIds: [...prev.gradeLevelIds, gradeId] };
      }
    });
  };

  const selectAllGrades = () => {
    setForm((prev) => ({
      ...prev,
      gradeLevelIds: sortedGradeLevels.map((g) => g.id),
    }));
  };

  const clearAllGrades = () => {
    setForm((prev) => ({
      ...prev,
      gradeLevelIds: [],
    }));
  };

  const selectPresetGrades = (minLevel, maxLevel) => {
    const matchedIds = sortedGradeLevels
      .filter((g) => (g.level ?? 0) >= minLevel && (g.level ?? 0) <= maxLevel)
      .map((g) => g.id);

    setForm((prev) => ({
      ...prev,
      gradeLevelIds: matchedIds,
    }));
  };

  // ── Advanced Filter & Search Logic ───────────────────────────────
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (gradeFilter !== "ALL") count++;
    if (typeFilter !== "ALL") count++;
    if (creditFilter !== "ALL") count++;
    if (teachingFilter !== "ALL") count++;
    return count;
  }, [searchQuery, gradeFilter, typeFilter, creditFilter, teachingFilter]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setGradeFilter("ALL");
    setTypeFilter("ALL");
    setCreditFilter("ALL");
    setTeachingFilter("ALL");
    setSortBy("name-asc");
  };

  const filteredAndSortedSubjects = useMemo(() => {
    const raw = subjects ?? [];

    const filtered = raw.filter((s) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.name?.toLowerCase().includes(q);
        const matchesCode = s.code?.toLowerCase().includes(q);
        const matchesDesc = s.description?.toLowerCase().includes(q);
        const matchesGrade = s.gradeLevel?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesc && !matchesGrade) {
          return false;
        }
      }

      // 2. Grade Level filter
      if (gradeFilter !== "ALL") {
        if (gradeFilter === "UNASSIGNED") {
          if (s.gradeLevelId) return false;
        } else if (s.gradeLevelId && s.gradeLevelId !== gradeFilter) {
          return false;
        }
      }

      // 3. Subject Type filter
      if (typeFilter === "CORE" && !s.isCore) return false;
      if (typeFilter === "ELECTIVE" && s.isCore) return false;

      // 4. Credit Hours filter
      if (creditFilter === "1-2" && (s.creditHours > 2 || !s.creditHours)) return false;
      if (creditFilter === "3" && s.creditHours !== 3) return false;
      if (creditFilter === "4+" && (s.creditHours < 4 || !s.creditHours)) return false;

      // 5. Teaching Status filter
      const classesCount = s.teachings?.length ?? 0;
      if (teachingFilter === "ASSIGNED" && classesCount === 0) return false;
      if (teachingFilter === "UNASSIGNED" && classesCount > 0) return false;

      return true;
    });

    // Sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name-desc":
          return (b.name || "").localeCompare(a.name || "");
        case "code-asc":
          return (a.code || "").localeCompare(b.code || "");
        case "grade-asc":
          return (a.gradeLevel?.level ?? 999) - (b.gradeLevel?.level ?? 999);
        case "grade-desc":
          return (b.gradeLevel?.level ?? -1) - (a.gradeLevel?.level ?? -1);
        case "classes-desc":
          return (b.teachings?.length ?? 0) - (a.teachings?.length ?? 0);
        case "credits-desc":
          return (b.creditHours ?? 0) - (a.creditHours ?? 0);
        default:
          return 0;
      }
    });
  }, [subjects, searchQuery, gradeFilter, typeFilter, creditFilter, teachingFilter, sortBy]);

  // Quick Metrics
  const stats = useMemo(() => {
    const raw = subjects ?? [];
    const coreCount = raw.filter((s) => s.isCore).length;
    const electiveCount = raw.filter((s) => !s.isCore).length;
    const gradesCovered = new Set(raw.filter((s) => s.gradeLevelId).map((s) => s.gradeLevelId)).size;
    const totalTeachings = raw.reduce((sum, s) => sum + (s.teachings?.length ?? 0), 0);

    return {
      total: raw.length,
      coreCount,
      electiveCount,
      gradesCovered,
      totalTeachings,
    };
  }, [subjects]);

  return (
    <div className="space-y-6">
      {/* ── Page Header & Stats Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-primary-600" />
            Curriculum & Subjects
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure school subjects, multi-grade curriculum sharing, and credit distributions
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

          <button className="btn-primary inline-flex items-center gap-1.5 shadow-sm" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        </div>
      </div>

      {/* ── Stats Summary Pills ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Total Subjects</span>
            <span className="text-lg font-black text-gray-900">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Grades Covered</span>
            <span className="text-lg font-black text-gray-900">
              {stats.gradesCovered} <span className="text-xs text-gray-400 font-normal">/ {sortedGradeLevels.length}</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Core Subjects</span>
            <span className="text-lg font-black text-gray-900">
              {stats.coreCount} <span className="text-xs text-gray-400 font-normal">({stats.electiveCount} Electives)</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Class Teachings</span>
            <span className="text-lg font-black text-gray-900">{stats.totalTeachings}</span>
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
              placeholder="Search by subject name, code (e.g. MATH10, BIO11), or keywords…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Filter Dropdown Selectors */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2 text-xs flex-wrap">
            {/* Grade Level Dropdown */}
            <div className="flex-1 min-w-[150px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
              >
                <option value="ALL">🎓 All Grade Levels</option>
                {sortedGradeLevels.map((gl) => (
                  <option key={gl.id} value={gl.id}>
                    {gl.name}
                  </option>
                ))}
                <option value="UNASSIGNED">General / Multi-Grade</option>
              </select>
            </div>

            {/* Category / Type Dropdown */}
            <div className="flex-1 min-w-[130px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">🏷️ All Categories</option>
                <option value="CORE">⭐ Core Only</option>
                <option value="ELECTIVE">📖 Elective Only</option>
              </select>
            </div>

            {/* Credit Hours Dropdown */}
            <div className="flex-1 min-w-[120px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={creditFilter}
                onChange={(e) => setCreditFilter(e.target.value)}
              >
                <option value="ALL">⏱️ All Credits</option>
                <option value="1-2">1 - 2 Credits</option>
                <option value="3">3 Credits (Standard)</option>
                <option value="4+">4+ Credits</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex-1 min-w-[140px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name-asc">Sort: Name (A → Z)</option>
                <option value="name-desc">Sort: Name (Z → A)</option>
                <option value="code-asc">Sort: Code (A → Z)</option>
                <option value="grade-asc">Sort: Grade (Low → High)</option>
                <option value="grade-desc">Sort: Grade (High → Low)</option>
                <option value="classes-desc">Sort: Most Classes</option>
                <option value="credits-desc">Sort: High Credits</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Active Filter Badges & Match Count ─────────────────────────── */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 font-medium">
              Showing <strong className="text-gray-900 font-bold">{filteredAndSortedSubjects.length}</strong> of{" "}
              {stats.total} subjects
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
                Grade: {gradeFilter === "UNASSIGNED" ? "General / Multi" : sortedGradeLevels.find((g) => g.id === gradeFilter)?.name}
                <button onClick={() => setGradeFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-purple-900" />
                </button>
              </span>
            )}

            {/* Type Pill */}
            {typeFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Category: {typeFilter === "CORE" ? "Core Only" : "Electives Only"}
                <button onClick={() => setTypeFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-blue-900" />
                </button>
              </span>
            )}

            {/* Credit Pill */}
            {creditFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Credits: {creditFilter}
                <button onClick={() => setCreditFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-amber-900" />
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
      {subjectsLoading || gradesLoading ? (
        <PageLoader />
      ) : filteredAndSortedSubjects.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={BookOpen}
            title="No matching subjects found"
            description={
              activeFiltersCount > 0
                ? "No subjects match your current search and filter criteria. Try clearing some filters."
                : "No subjects have been configured for your school yet."
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
          {filteredAndSortedSubjects.map((s) => {
            const teachingsCount = s.teachings?.length ?? 0;

            return (
              <div
                key={s.id}
                className="card p-5 hover:shadow-md transition-all duration-200 border border-gray-200 flex flex-col justify-between group bg-white"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/60 border border-primary-200 text-primary-700 flex items-center justify-center flex-shrink-0 shadow-xs">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-gray-900 group-hover:text-primary-600 transition-colors">
                          {s.name}
                        </h3>
                        <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                          {s.code}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-ghost p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                        onClick={() => handleOpenEdit(s)}
                        title="Edit Subject"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn-ghost p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        onClick={() => setDeleteConfirmSubject(s)}
                        title="Delete Subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Badges Bar */}
                  <div className="flex items-center gap-1.5 flex-wrap my-2.5">
                    {s.gradeLevel ? (
                      <Badge variant="purple">
                        <GraduationCap className="w-3 h-3 inline mr-1" />
                        {s.gradeLevel.name}
                      </Badge>
                    ) : (
                      <Badge variant="purple">
                        <Layers className="w-3 h-3 inline mr-1" /> Multi-Grade / All
                      </Badge>
                    )}

                    {s.isCore ? (
                      <Badge variant="blue">⭐ Core</Badge>
                    ) : (
                      <Badge variant="amber">📖 Elective</Badge>
                    )}

                    <Badge variant="gray">
                      <Clock className="w-3 h-3 inline mr-0.5" /> {s.creditHours ?? 3} cr
                    </Badge>
                  </div>

                  {/* Description */}
                  {s.description ? (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mt-1">
                      {s.description}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic mt-1">No description provided</p>
                  )}
                </div>

                {/* Card Footer: Teaching Allocations */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <strong>{teachingsCount}</strong> {teachingsCount === 1 ? "class assigned" : "classes assigned"}
                  </span>
                  <span
                    className="text-[11px] font-semibold text-primary-600 hover:underline cursor-pointer"
                    onClick={() => handleOpenEdit(s)}
                  >
                    Manage →
                  </span>
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
                  <th className="py-3 px-4">Subject Code</th>
                  <th className="py-3 px-4">Subject Name</th>
                  <th className="py-3 px-4">Grade Level Scope</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Credit Hours</th>
                  <th className="py-3 px-4">Classes Assigned</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSortedSubjects.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary-700">
                      <span className="bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
                        {s.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-gray-900">
                      <div>
                        {s.name}
                        {s.description && (
                          <p className="text-[11px] text-gray-400 font-normal line-clamp-1 mt-0.5">
                            {s.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {s.gradeLevel ? (
                        <Badge variant="purple">
                          <GraduationCap className="w-3 h-3 inline mr-1" />
                          {s.gradeLevel.name}
                        </Badge>
                      ) : (
                        <Badge variant="purple">
                          <Layers className="w-3 h-3 inline mr-1" /> Multi-Grade / All
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {s.isCore ? (
                        <Badge variant="blue">⭐ Core</Badge>
                      ) : (
                        <Badge variant="amber">📖 Elective</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-700">
                      {s.creditHours ?? 3} hrs
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {s.teachings?.length ?? 0} classes
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="btn-ghost p-1.5 text-gray-400 hover:text-primary-600 rounded"
                          onClick={() => handleOpenEdit(s)}
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="btn-ghost p-1.5 text-gray-400 hover:text-red-600 rounded"
                          onClick={() => setDeleteConfirmSubject(s)}
                          title="Delete"
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
        </div>
      )}

      {/* ── Add / Edit Subject Modal with Multi-Select Grade Scope ─────────── */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingSubject ? `Edit Subject: ${editingSubject.name}` : "Add New Subject"}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={handleCloseModal}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.name.trim() || !form.code.trim()}
            >
              {saveMutation.isPending ? "Saving…" : editingSubject ? "Save Changes" : "Create Subject"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Subject Name and Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Subject Name *</label>
              <input
                className="input text-xs"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mathematics, Biology, English Literature…"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label font-bold">Subject Code *</label>
              <input
                className="input font-mono text-xs uppercase"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. MATH10, BIO11, ENG-CORE"
                required
              />
            </div>
          </div>

          {/* ════ MULTI-SELECT GRADE LEVEL SCOPE SELECTOR ════ */}
          <div className="space-y-2.5 p-3.5 bg-gray-50/90 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <label className="font-extrabold text-gray-900 block text-xs flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  Grade Level Scope (Multi-Selectable)
                </label>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Select all grade levels that will take this subject, or choose a quick preset.
                </p>
              </div>

              {/* Selection Count Badge */}
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                {form.gradeLevelIds.length === 0
                  ? "Universal (All Grades)"
                  : form.gradeLevelIds.length === sortedGradeLevels.length
                  ? "All Grades Selected"
                  : `${form.gradeLevelIds.length} Grades Selected`}
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">
                Quick Presets:
              </span>
              <button
                type="button"
                onClick={selectAllGrades}
                className={clsx(
                  "px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all inline-flex items-center gap-1",
                  form.gradeLevelIds.length === sortedGradeLevels.length && sortedGradeLevels.length > 0
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                )}
              >
                <Globe className="w-3 h-3" /> All Grades (1–12)
              </button>

              <button
                type="button"
                onClick={() => selectPresetGrades(1, 5)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 transition-all"
              >
                Primary (1–5)
              </button>

              <button
                type="button"
                onClick={() => selectPresetGrades(6, 8)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 transition-all"
              >
                Middle (6–8)
              </button>

              <button
                type="button"
                onClick={() => selectPresetGrades(9, 12)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 transition-all"
              >
                High School (9–12)
              </button>

              {form.gradeLevelIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllGrades}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-all ml-auto"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Selectable Grade Level Chips Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1.5 max-h-48 overflow-y-auto pr-1">
              {sortedGradeLevels.map((gl) => {
                const isSelected = form.gradeLevelIds.includes(gl.id);

                return (
                  <button
                    key={gl.id}
                    type="button"
                    onClick={() => toggleGradeSelection(gl.id)}
                    className={clsx(
                      "flex items-center gap-2 p-2 rounded-xl text-left border transition-all cursor-pointer select-none",
                      isSelected
                        ? "bg-purple-50/90 border-purple-500 text-purple-950 font-bold shadow-xs ring-1 ring-purple-400/40"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                    )}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                    <span className="text-xs truncate">{gl.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Summary Text */}
            <div className="text-[11px] text-gray-600 bg-white p-2 rounded-lg border border-gray-200">
              {form.gradeLevelIds.length === 0 ? (
                <span className="flex items-center gap-1.5 text-gray-500">
                  <Layers className="w-3.5 h-3.5 text-gray-400" />
                  <strong>Universal Subject:</strong> Available to all grade levels in the school.
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-purple-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                  <span>
                    <strong>Applied to {form.gradeLevelIds.length} Grade{form.gradeLevelIds.length > 1 ? "s" : ""}:</strong>{" "}
                    {sortedGradeLevels
                      .filter((g) => form.gradeLevelIds.includes(g.id))
                      .map((g) => g.name)
                      .join(", ")}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Credit Hours & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Credit Hours (Weekly)</label>
              <input
                className="input text-xs"
                type="number"
                min={1}
                max={15}
                value={form.creditHours}
                onChange={(e) => setForm((f) => ({ ...f, creditHours: e.target.value }))}
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 bg-gray-50 rounded-xl border border-gray-200 w-full mt-5">
                <input
                  type="checkbox"
                  checked={form.isCore}
                  onChange={(e) => setForm((f) => ({ ...f, isCore: e.target.checked }))}
                  className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <div>
                  <span className="font-bold text-gray-900 block text-xs">Core Subject (Mandatory)</span>
                  <span className="text-[10px] text-gray-500 block">Required for all enrolled students</span>
                </div>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label font-bold">Course Description & Learning Objectives</label>
            <textarea
              className="input text-xs min-h-20 resize-none"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief summary of learning objectives, curriculum, and key topics…"
            />
          </div>
        </div>
      </Modal>

      {/* ── Confirm Delete Subject Modal ───────────────────────────────────── */}
      <Modal
        open={!!deleteConfirmSubject}
        onClose={() => setDeleteConfirmSubject(null)}
        title="Confirm Delete Subject"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteConfirmSubject(null)}>
              Cancel
            </button>
            <button
              className="btn-primary bg-red-600 hover:bg-red-700 inline-flex items-center gap-1.5"
              onClick={() => deleteMutation.mutate(deleteConfirmSubject.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMutation.isPending ? "Deleting…" : "Delete Subject"}
            </button>
          </>
        }
      >
        <p className="text-xs text-gray-600">
          Are you sure you want to delete subject{" "}
          <strong className="text-gray-900">{deleteConfirmSubject?.name}</strong> (
          <code className="font-mono text-xs">{deleteConfirmSubject?.code}</code>)? This will remove it from the
          school curriculum.
        </p>
      </Modal>
    </div>
  );
}

export default SubjectsPage;
