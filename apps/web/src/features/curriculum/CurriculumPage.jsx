import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Plus,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Edit2,
  Trash2,
  History,
  FileText,
  Paperclip,
  ExternalLink,
  ChevronRight,
  Filter,
  Calendar,
  Sparkles,
  Award,
} from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, EmptyState } from "../../components/ui/index";
import CurriculumUnitModal from "./components/CurriculumUnitModal";
import StandardModal from "./components/StandardModal";
import UnitVersionHistoryModal from "./components/UnitVersionHistoryModal";
import UnitReviewModal from "./components/UnitReviewModal";
import toast from "react-hot-toast";
import clsx from "clsx";

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", bg: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted for Review", bg: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved Live", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REVISION_REQUESTED: { label: "Revision Requested", bg: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function CurriculumPage() {
  const { user, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const canAdmin = isAdmin();
  const canEdit = isAdmin() || isTeacher();

  // Tab: "scope" | "units" | "review" | "standards"
  const [activeTab, setActiveTab] = useState("scope");

  // Filters for Scope & Sequence
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedGradeLevelId, setSelectedGradeLevelId] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("2024/2025");
  const [selectedCurriculumId, setSelectedCurriculumId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [standardModalOpen, setStandardModalOpen] = useState(false);
  const [editingStandard, setEditingStandard] = useState(null);
  const [historyModalUnit, setHistoryModalUnit] = useState(null);
  const [reviewModalUnit, setReviewModalUnit] = useState(null);

  // Queries
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects-list"],
    queryFn: () => api.get("/academics/subjects").then((r) => r.data.data || []),
  });

  const { data: gradeLevels = [] } = useQuery({
    queryKey: ["grade-levels-list"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data || []),
  });

  const { data: curriculums = [] } = useQuery({
    queryKey: ["lookup-curriculums"],
    queryFn: () => api.get("/lookup-values?type=CURRICULUM").then((r) => r.data.data || []),
  });

  // Effective filter defaults
  const effectiveSubjectId = selectedSubjectId || (subjects[0]?.id || "");
  const effectiveGradeId = selectedGradeLevelId || (gradeLevels[0]?.id || "");

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: [
      "curriculum-units",
      activeTab === "scope" ? effectiveSubjectId : selectedSubjectId,
      activeTab === "scope" ? effectiveGradeId : selectedGradeLevelId,
      selectedAcademicYear,
      selectedCurriculumId,
      statusFilter,
      searchQuery,
    ],
    queryFn: () => {
      let url = "/curriculum/units?";
      if (activeTab === "scope") {
        if (effectiveSubjectId) url += `subjectId=${effectiveSubjectId}&`;
        if (effectiveGradeId) url += `gradeLevelId=${effectiveGradeId}&`;
      } else {
        if (selectedSubjectId) url += `subjectId=${selectedSubjectId}&`;
        if (selectedGradeLevelId) url += `gradeLevelId=${selectedGradeLevelId}&`;
      }
      if (selectedAcademicYear) url += `academicYear=${selectedAcademicYear}&`;
      if (selectedCurriculumId) url += `curriculumId=${selectedCurriculumId}&`;
      if (statusFilter !== "ALL") url += `status=${statusFilter}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      return api.get(url).then((r) => r.data.data || []);
    },
    enabled: !!effectiveSubjectId || activeTab !== "scope",
  });

  const { data: standards = [], isLoading: standardsLoading } = useQuery({
    queryKey: ["curriculum-standards", selectedSubjectId, selectedGradeLevelId, selectedCurriculumId],
    queryFn: () => {
      let url = "/curriculum/standards?";
      if (selectedSubjectId) url += `subjectId=${selectedSubjectId}&`;
      if (selectedGradeLevelId) url += `gradeLevelId=${selectedGradeLevelId}&`;
      if (selectedCurriculumId) url += `curriculumId=${selectedCurriculumId}&`;
      return api.get(url).then((r) => r.data.data || []);
    },
  });

  // Unit Mutations
  const submitUnitMutation = useMutation({
    mutationFn: (unitId) => api.post(`/curriculum/units/${unitId}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curriculum-units"] });
      toast.success("Unit submitted for administrative review");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit unit");
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: (unitId) => api.delete(`/curriculum/units/${unitId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curriculum-units"] });
      toast.success("Curriculum unit deleted");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete unit");
    },
  });

  const deleteStandardMutation = useMutation({
    mutationFn: (id) => api.delete(`/curriculum/standards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curriculum-standards"] });
      toast.success("Learning standard deleted");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete standard");
    },
  });

  // Submitted units awaiting review
  const pendingReviewUnits = units.filter((u) => u.status === "SUBMITTED");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Curriculum Mapping & Standards</h1>
          <p className="page-subtitle">
            Structured curriculum units, learning outcomes catalog, review workflows, and scope & sequence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button
                className="btn-secondary inline-flex items-center gap-1.5"
                onClick={() => {
                  setEditingStandard(null);
                  setStandardModalOpen(true);
                }}
              >
                <Layers className="w-4 h-4" /> + New Standard
              </button>
              <button
                className="btn-primary inline-flex items-center gap-1.5"
                onClick={() => {
                  setEditingUnit(null);
                  setUnitModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" /> Create Unit
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab("scope")}
          className={clsx(
            "pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
            activeTab === "scope"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-900",
          )}
        >
          <BookOpen className="w-4 h-4" /> Scope & Sequence
        </button>

        <button
          onClick={() => setActiveTab("units")}
          className={clsx(
            "pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
            activeTab === "units"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-900",
          )}
        >
          <FileText className="w-4 h-4" /> {isTeacher() && !canAdmin ? "My Curriculum Units" : "All Units"}
          <span className="bg-gray-100 text-gray-600 text-[11px] px-2 py-0.5 rounded-full font-bold">
            {units.length}
          </span>
        </button>

        {canAdmin && (
          <button
            onClick={() => setActiveTab("review")}
            className={clsx(
              "pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
              activeTab === "review"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-900",
            )}
          >
            <CheckCircle2 className="w-4 h-4 text-amber-500" /> Review Queue
            {pendingReviewUnits.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                {pendingReviewUnits.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab("standards")}
          className={clsx(
            "pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
            activeTab === "standards"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-900",
          )}
        >
          <Layers className="w-4 h-4" /> Standards Catalog ({standards.length})
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: SCOPE & SEQUENCE (The Structured Syllabus Replacement) */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "scope" && (
        <div className="space-y-6">
          {/* Scope Controls */}
          <div className="card p-4 bg-white border border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="label font-bold">Subject</label>
              <select
                className="input text-xs"
                value={effectiveSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label font-bold">Grade Level</label>
              <select
                className="input text-xs"
                value={effectiveGradeId}
                onChange={(e) => setSelectedGradeLevelId(e.target.value)}
              >
                {gradeLevels.map((gl) => (
                  <option key={gl.id} value={gl.id}>
                    {gl.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label font-bold">Academic Year</label>
              <input
                className="input text-xs"
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                placeholder="2024/2025"
              />
            </div>

            {curriculums.length > 0 && (
              <div>
                <label className="label font-bold">Curriculum Framework</label>
                <select
                  className="input text-xs"
                  value={selectedCurriculumId}
                  onChange={(e) => setSelectedCurriculumId(e.target.value)}
                >
                  <option value="">All / Default</option>
                  {curriculums.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.value}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Scope Units Flow */}
          {unitsLoading ? (
            <PageLoader />
          ) : units.length === 0 ? (
            <div className="card p-12 text-center bg-white border border-gray-200 space-y-3">
              <EmptyState
                icon={BookOpen}
                title="No curriculum units mapped for this course yet"
                description="Structure the learning sequence by adding ordered units with learning outcomes, duration, and assessment methods."
              />
              {canEdit && (
                <button
                  className="btn-primary inline-flex items-center gap-1.5"
                  onClick={() => {
                    setEditingUnit(null);
                    setUnitModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> Create Unit 1
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-gray-900">
                  Year-at-a-Glance Teaching Sequence ({units.length} Units • {units.reduce((acc, u) => acc + (u.durationWeeks || 0), 0)} Estimated Weeks)
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {units.map((u, index) => {
                  const statusStyle = STATUS_CONFIG[u.status] || STATUS_CONFIG.DRAFT;
                  const objectives = Array.isArray(u.learningObjectives) ? u.learningObjectives : [];
                  const resources = Array.isArray(u.keyResources) ? u.keyResources : [];
                  const unitStandards = Array.isArray(u.standards) ? u.standards : [];

                  return (
                    <div
                      key={u.id}
                      className="card bg-white border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all overflow-hidden"
                    >
                      <div className="p-4 bg-gradient-to-r from-gray-50 via-white to-gray-50/50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-primary-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
                            {u.unitNumber}
                          </span>
                          <div>
                            <h4 className="font-extrabold text-base text-gray-900 leading-tight">
                              {u.title}
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {u.subject?.name} • {u.gradeLevel?.name} {u.durationWeeks && `• ${u.durationWeeks} Weeks`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={clsx(
                              "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                              statusStyle.bg,
                            )}
                          >
                            {statusStyle.label}
                          </span>
                          {u.currentVersion > 1 && (
                            <button
                              className="btn-ghost btn-sm text-xs p-1 text-gray-500 hover:text-primary-600"
                              onClick={() => setHistoryModalUnit(u)}
                              title="Version History"
                            >
                              <History className="w-4 h-4" /> v{u.currentVersion}
                            </button>
                          )}
                          {canEdit && (
                            <button
                              className="btn-ghost btn-sm text-xs p-1 text-gray-500 hover:text-primary-600"
                              onClick={() => {
                                setEditingUnit(u);
                                setUnitModalOpen(true);
                              }}
                              title="Edit Unit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                        {/* Overview & Standards */}
                        <div className="space-y-3">
                          {u.description && (
                            <div>
                              <span className="font-bold text-gray-700 block mb-1">Unit Description:</span>
                              <p className="text-gray-600 leading-relaxed">{u.description}</p>
                            </div>
                          )}

                          {unitStandards.length > 0 && (
                            <div>
                              <span className="font-bold text-gray-700 block mb-1">Targeted Learning Outcomes:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {unitStandards.map((st) => (
                                  <span
                                    key={st.id}
                                    className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md font-mono text-[10px]"
                                    title={st.title}
                                  >
                                    {st.code}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Objectives List */}
                        <div className="space-y-2">
                          <span className="font-bold text-gray-700 block">Core Competencies & Objectives:</span>
                          {objectives.length === 0 ? (
                            <span className="text-gray-400 italic">No specific objectives listed.</span>
                          ) : (
                            <ul className="space-y-1 text-gray-600">
                              {objectives.map((obj, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-primary-600 font-bold mt-0.5">•</span>
                                  <span>{obj}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Assessment & Resources */}
                        <div className="space-y-3 p-3 bg-gray-50/70 rounded-xl border border-gray-100">
                          {u.assessmentMethod && (
                            <div>
                              <span className="font-bold text-gray-700 block mb-0.5">Assessment Evidence:</span>
                              <p className="text-gray-600">{u.assessmentMethod}</p>
                            </div>
                          )}

                          {resources.length > 0 && (
                            <div>
                              <span className="font-bold text-gray-700 block mb-1">Attached Materials & Links:</span>
                              <div className="space-y-1">
                                {resources.map((res, i) => (
                                  <a
                                    key={i}
                                    href={res.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-primary-600 hover:underline truncate"
                                  >
                                    <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                    <span className="truncate">{res.name}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: UNITS MANAGEMENT TABLE */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "units" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  className="input text-xs pl-8 w-48"
                  placeholder="Search units..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="input text-xs w-36"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="REVISION_REQUESTED">Revision Requested</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Subject & Grade</th>
                  <th>Duration</th>
                  <th>Standards</th>
                  <th>Status</th>
                  <th>Author</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={BookOpen}
                        title="No curriculum units found"
                        description="Create your first unit to map standards and lesson pacing."
                      />
                    </td>
                  </tr>
                ) : (
                  units.map((u) => {
                    const statusStyle = STATUS_CONFIG[u.status] || STATUS_CONFIG.DRAFT;
                    const isAuthor = u.createdById === user?.id;

                    return (
                      <tr key={u.id}>
                        <td>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">
                              Unit {u.unitNumber}: {u.title}
                            </div>
                            <div className="text-[11px] text-gray-400 line-clamp-1">
                              {u.description || "No description provided"}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-xs font-semibold text-gray-900">
                            {u.subject?.name}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {u.gradeLevel?.name} ({u.academicYear})
                          </div>
                        </td>
                        <td className="text-xs text-gray-600">
                          {u.durationWeeks ? `${u.durationWeeks} weeks` : "—"}
                        </td>
                        <td>
                          <Badge variant="indigo">
                            {Array.isArray(u.standards) ? u.standards.length : 0} Outcomes
                          </Badge>
                        </td>
                        <td>
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded-full text-[11px] font-bold border",
                              statusStyle.bg,
                            )}
                          >
                            {statusStyle.label}
                          </span>
                        </td>
                        <td className="text-xs text-gray-500">
                          {u.createdBy?.firstName} {u.createdBy?.lastName}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {u.versionCount > 0 && (
                              <button
                                className="btn-ghost p-1 text-gray-400 hover:text-primary-600 rounded"
                                onClick={() => setHistoryModalUnit(u)}
                                title="Version History"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(isAuthor || canAdmin) && (u.status === "DRAFT" || u.status === "REVISION_REQUESTED") && (
                              <button
                                className="btn-primary btn-sm text-xs py-1 px-2 inline-flex items-center gap-1"
                                onClick={() => submitUnitMutation.mutate(u.id)}
                                disabled={submitUnitMutation.isPending}
                                title="Submit to Admin"
                              >
                                <Send className="w-3 h-3" /> Submit
                              </button>
                            )}

                            {canAdmin && u.status === "SUBMITTED" && (
                              <button
                                className="btn-secondary btn-sm text-xs py-1 px-2 text-amber-700 bg-amber-50 border-amber-200"
                                onClick={() => setReviewModalUnit(u)}
                              >
                                Review
                              </button>
                            )}

                            {canEdit && (
                              <button
                                className="btn-ghost p-1 text-gray-400 hover:text-primary-600 rounded"
                                onClick={() => {
                                  setEditingUnit(u);
                                  setUnitModalOpen(true);
                                }}
                                title="Edit Unit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {(canAdmin || (isAuthor && u.status !== "APPROVED")) && (
                              <button
                                className="btn-ghost p-1 text-gray-400 hover:text-red-600 rounded"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this curriculum unit?")) {
                                    deleteUnitMutation.mutate(u.id);
                                  }
                                }}
                                title="Delete Unit"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: ADMIN REVIEW QUEUE */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "review" && canAdmin && (
        <div className="space-y-4">
          <div className="page-header">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Curriculum Review Queue</h3>
              <p className="page-subtitle">
                Inspect and approve submitted curriculum units from department teachers.
              </p>
            </div>
          </div>

          {pendingReviewUnits.length === 0 ? (
            <div className="card p-12 text-center bg-white border border-gray-200">
              <EmptyState
                icon={CheckCircle2}
                title="All curriculum reviews complete"
                description="No curriculum units are currently waiting in the review queue."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingReviewUnits.map((u) => (
                <div
                  key={u.id}
                  className="card p-4 bg-white border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="yellow">Awaiting Review</Badge>
                      <span className="font-bold text-gray-900 text-sm">
                        Unit {u.unitNumber}: {u.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Subject: <strong>{u.subject?.name}</strong> • Grade: <strong>{u.gradeLevel?.name}</strong> • Author: <strong>{u.createdBy?.firstName} {u.createdBy?.lastName}</strong> • Duration: <strong>{u.durationWeeks} weeks</strong>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {u.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      className="btn-primary inline-flex items-center gap-1.5"
                      onClick={() => setReviewModalUnit(u)}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Review & Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: STANDARDS CATALOG */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "standards" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <select
                className="input text-xs w-48"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>

              <select
                className="input text-xs w-40"
                value={selectedGradeLevelId}
                onChange={(e) => setSelectedGradeLevelId(e.target.value)}
              >
                <option value="">All Grade Levels</option>
                {gradeLevels.map((gl) => (
                  <option key={gl.id} value={gl.id}>
                    {gl.name}
                  </option>
                ))}
              </select>
            </div>

            {canEdit && (
              <button
                className="btn-primary inline-flex items-center gap-1.5"
                onClick={() => {
                  setEditingStandard(null);
                  setStandardModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" /> Add Standard / Outcome
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Outcome Title / Statement</th>
                  <th>Subject & Grade</th>
                  <th>Category / Strand</th>
                  <th>Units Linked</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {standards.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={Layers}
                        title="No standards found"
                        description="Define the learning outcomes catalog for your school's curriculum frameworks."
                      />
                    </td>
                  </tr>
                ) : (
                  standards.map((st) => (
                    <tr key={st.id}>
                      <td>
                        <span className="font-mono font-bold text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          {st.code}
                        </span>
                      </td>
                      <td>
                        <div className="font-semibold text-gray-900 text-xs">{st.title}</div>
                        {st.description && (
                          <div className="text-[11px] text-gray-400 line-clamp-1">
                            {st.description}
                          </div>
                        )}
                      </td>
                      <td className="text-xs text-gray-700">
                        {st.subject?.name} {st.gradeLevel ? `(${st.gradeLevel.name})` : ""}
                      </td>
                      <td>
                        {st.category ? (
                          <Badge variant="gray">{st.category}</Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="text-xs text-gray-600 font-semibold">
                        {st.unitCount || 0} Units
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              className="btn-ghost p-1 text-gray-400 hover:text-primary-600 rounded"
                              onClick={() => {
                                setEditingStandard(st);
                                setStandardModalOpen(true);
                              }}
                              title="Edit Standard"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canAdmin && (
                            <button
                              className="btn-ghost p-1 text-gray-400 hover:text-red-600 rounded"
                              onClick={() => {
                                if (confirm("Delete this learning standard?")) {
                                  deleteStandardMutation.mutate(st.id);
                                }
                              }}
                              title="Delete Standard"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <CurriculumUnitModal
        open={unitModalOpen}
        onClose={() => {
          setUnitModalOpen(false);
          setEditingUnit(null);
        }}
        unit={editingUnit}
        defaultSubjectId={effectiveSubjectId}
        defaultGradeLevelId={effectiveGradeId}
        defaultAcademicYear={selectedAcademicYear}
      />

      <StandardModal
        open={standardModalOpen}
        onClose={() => {
          setStandardModalOpen(false);
          setEditingStandard(null);
        }}
        standard={editingStandard}
        defaultSubjectId={effectiveSubjectId}
        defaultGradeLevelId={effectiveGradeId}
      />

      <UnitVersionHistoryModal
        open={!!historyModalUnit}
        onClose={() => setHistoryModalUnit(null)}
        unit={historyModalUnit}
      />

      <UnitReviewModal
        open={!!reviewModalUnit}
        onClose={() => setReviewModalUnit(null)}
        unit={reviewModalUnit}
      />
    </div>
  );
}
