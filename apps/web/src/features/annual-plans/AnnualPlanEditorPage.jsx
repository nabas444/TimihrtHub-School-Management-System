import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  BookOpen,
  Save,
  Send,
  Download,
  Plus,
  Trash2,
  ArrowLeft,
  Columns,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  MoveUp,
  MoveDown,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import { useAuthStore } from "../../store/authStore";
import { Badge } from "../../components/ui/index";
import PageLoader from "../../components/ui/PageLoader";
import Modal from "../../components/ui/Modal";
import clsx from "clsx";
import toast from "react-hot-toast";

const DEFAULT_COLUMNS = [
  "Term / Period",
  "Topic / Unit",
  "Learning Objectives",
  "Teaching Activities",
  "Resources & Materials",
  "Assessment Method",
  "Duration / Weeks",
];

const DEFAULT_INITIAL_ROWS = [
  [
    "Term 1 - Week 1-2",
    "Introduction to Course & Foundations",
    "Understand fundamental concepts and core definitions",
    "Lecture, group discussion, interactive board exercises",
    "Textbook Ch. 1, projector slides, handouts",
    "Diagnostic quiz & homework worksheet",
    "2 weeks",
  ],
  [
    "Term 1 - Week 3-5",
    "Core Unit Principles & Applications",
    "Apply theories to problem solving and lab experiments",
    "Lab demonstrations, pair work, guided practice",
    "Lab equipment, workbook exercises",
    "Mid-unit quiz & lab report",
    "3 weeks",
  ],
];

export default function AnnualPlanEditorPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin, isTeacher } = useAuthStore();

  // ── Form State ──
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState(
    isAdmin() ? "SCHOOL_WIDE" : "TEACHER_SUBJECT",
  );
  const [academicYear, setAcademicYear] = useState("2024/2025");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedGradeLevelId, setSelectedGradeLevelId] = useState("");
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [rows, setRows] = useState(DEFAULT_INITIAL_ROWS);

  // Column management modal
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  // Review modal state (Admin)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");

  // ── 1. Fetch Teacher Teachings (for dropdowns) ──
  const { data: teachingsData } = useQuery({
    queryKey: ["annual-plans-my-teachings"],
    queryFn: () => api.get("/annual-plans/my-teachings").then((r) => r.data.data),
    enabled: isTeacher() || isAdmin(),
  });

  const teachings = teachingsData?.teachings || [];

  // ── 2. Fetch Existing Plan if Editing ──
  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ["annual-plan", id],
    queryFn: () => api.get(`/annual-plans/${id}`).then((r) => r.data.data.plan),
    enabled: !isNew,
  });

  useEffect(() => {
    if (planData) {
      setTitle(planData.title || "");
      setScope(planData.scope || "TEACHER_SUBJECT");
      setAcademicYear(planData.academicYear || "2024/2025");
      setSelectedSubjectId(planData.subjectId || "");
      setSelectedClassId(planData.classId || "");
      setSelectedGradeLevelId(planData.gradeLevelId || "");

      if (Array.isArray(planData.columns) && planData.columns.length > 0) {
        setColumns(planData.columns);
      }
      if (Array.isArray(planData.rows)) {
        setRows(planData.rows);
      }
    }
  }, [planData]);

  // Handle teaching selection
  const handleSelectTeaching = (e) => {
    const teachingId = e.target.value;
    if (!teachingId) {
      setSelectedSubjectId("");
      setSelectedClassId("");
      return;
    }
    const match = teachings.find((t) => t.id === teachingId);
    if (match) {
      setSelectedSubjectId(match.subjectId);
      setSelectedClassId(match.classId);
      if (!title) {
        setTitle(
          `${match.subject?.name} Annual Scheme of Work - Class ${match.class?.name}`,
        );
      }
    }
  };

  // ── 3. Mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim() || "Annual Curriculum Plan",
        scope,
        academicYear,
        subjectId: scope === "TEACHER_SUBJECT" ? selectedSubjectId || undefined : undefined,
        classId: selectedClassId || undefined,
        gradeLevelId: selectedGradeLevelId || undefined,
        columns,
        rows,
      };

      if (isNew) {
        const res = await api.post("/annual-plans", payload);
        return res.data.data.plan;
      } else {
        const res = await api.put(`/annual-plans/${id}`, payload);
        return res.data.data.plan;
      }
    },
    onSuccess: (savedPlan) => {
      toast.success(isNew ? "Annual plan created" : "Plan saved successfully");
      queryClient.invalidateQueries({ queryKey: ["annual-plans"] });
      if (isNew && savedPlan?.id) {
        navigate(`/annual-plans/${savedPlan.id}`, { replace: true });
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save annual plan");
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync();
      const targetId = isNew ? (await saveMutation.mutateAsync()).id : id;
      return api.post(`/annual-plans/${targetId}/submit`);
    },
    onSuccess: () => {
      toast.success("Annual plan submitted for administrative review");
      queryClient.invalidateQueries({ queryKey: ["annual-plans"] });
      navigate("/annual-plans");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit plan");
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      api.post(`/annual-plans/${id}/review`, {
        decision: reviewDecision,
        notes: reviewNotes,
      }),
    onSuccess: () => {
      toast.success(
        reviewDecision === "APPROVED"
          ? "Annual plan successfully approved"
          : "Revision requested and returned to author",
      );
      setIsReviewModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["annual-plans"] });
      queryClient.invalidateQueries({ queryKey: ["annual-plan", id] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to review plan");
    },
  });

  // ── 4. Table Grid Manipulations ──
  const handleCellChange = (rowIndex, colIndex, value) => {
    setRows((prev) => {
      const next = [...prev];
      const row = Array.isArray(next[rowIndex]) ? [...next[rowIndex]] : [];
      row[colIndex] = value;
      next[rowIndex] = row;
      return next;
    });
  };

  const handleAddRow = () => {
    const emptyRow = new Array(columns.length).fill("");
    setRows((prev) => [...prev, emptyRow]);
  };

  const handleDeleteRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveRow = (index, direction) => {
    setRows((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    setColumns((prev) => [...prev, newColumnName.trim()]);
    setRows((prev) => prev.map((row) => [...(Array.isArray(row) ? row : []), ""]));
    setNewColumnName("");
    setIsColumnModalOpen(false);
  };

  const handleDeleteColumn = (colIndex) => {
    if (columns.length <= 1) {
      toast.error("You must have at least one column");
      return;
    }
    setColumns((prev) => prev.filter((_, i) => i !== colIndex));
    setRows((prev) =>
      prev.map((row) =>
        Array.isArray(row) ? row.filter((_, i) => i !== colIndex) : [],
      ),
    );
  };

  const handleDownloadPdf = async () => {
    if (isNew) {
      toast.error("Please save the plan first before exporting PDF");
      return;
    }
    try {
      const safeTitle = (title || "annual-plan")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      await downloadFile(`/annual-plans/${id}/pdf`, `${safeTitle}.pdf`);
      toast.success("Annual plan PDF downloaded");
    } catch (err) {
      toast.error("Failed to download PDF");
    }
  };

  if (!isNew && planLoading) {
    return <PageLoader />;
  }

  const isAuthor = !isNew && planData?.createdById === user?.id;
  const canEdit =
    isNew ||
    isAdmin() ||
    (isAuthor && ["DRAFT", "REVISION_REQUESTED"].includes(planData?.status));

  return (
    <div className="space-y-6">
      {/* ── Top Nav & Action Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/annual-plans"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
                {isNew ? "New Scheme of Work / Annual Plan" : title || "Edit Annual Plan"}
              </h1>
              {!isNew && planData?.status && (
                <span className="text-xs">
                  {planData.status === "APPROVED" ? (
                    <Badge variant="success">APPROVED</Badge>
                  ) : planData.status === "SUBMITTED" ? (
                    <Badge variant="primary">IN REVIEW</Badge>
                  ) : planData.status === "REVISION_REQUESTED" ? (
                    <Badge variant="danger">REVISION REQUESTED</Badge>
                  ) : (
                    <Badge variant="neutral">DRAFT</Badge>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {scope === "TEACHER_SUBJECT"
                ? "Teacher Subject Scheme of Work"
                : "School-Wide Curriculum Roadmap"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {!isNew && (
            <button
              onClick={handleDownloadPdf}
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-primary-600" />
              Download PDF (A4)
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-secondary text-xs inline-flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>
          )}

          {(isNew || canEdit) && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="btn-primary text-xs inline-flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-4 h-4" />
              Submit for Review
            </button>
          )}

          {isAdmin() && !isNew && planData?.status === "SUBMITTED" && (
            <button
              onClick={() => {
                setIsReviewModalOpen(true);
                setReviewDecision("APPROVED");
                setReviewNotes("");
              }}
              className="btn-primary text-xs inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              Review / Approve
            </button>
          )}
        </div>
      </div>

      {/* ── Revision Notice Banner ── */}
      {!isNew && planData?.status === "REVISION_REQUESTED" && planData.reviewNotes && (
        <div className="card p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 dark:text-red-300">
            <strong className="block text-sm font-bold text-red-800 dark:text-red-200">
              Revision Requested by Administration
            </strong>
            <p className="mt-1">{planData.reviewNotes}</p>
          </div>
        </div>
      )}

      {/* ── Configuration Metadata Card ── */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Title */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Plan Title *
            </label>
            <input
              type="text"
              value={title}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Grade 10 Mathematics Annual Scheme of Work"
              className="input w-full font-medium"
            />
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Academic Year *
            </label>
            <select
              value={academicYear}
              disabled={!canEdit}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="input w-full"
            >
              <option value="2024/2025">2024 / 2025</option>
              <option value="2025/2026">2025 / 2026</option>
              <option value="2026/2027">2026 / 2027</option>
            </select>
          </div>

          {/* Scope Toggle (Admin only) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Plan Scope
            </label>
            {isAdmin() ? (
              <select
                value={scope}
                disabled={!canEdit}
                onChange={(e) => setScope(e.target.value)}
                className="input w-full"
              >
                <option value="TEACHER_SUBJECT">Teacher Subject Plan</option>
                <option value="SCHOOL_WIDE">School-Wide Curriculum</option>
              </select>
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                Teacher Subject Plan
              </div>
            )}
          </div>
        </div>

        {/* Quick Assignment Selector for Teachers */}
        {scope === "TEACHER_SUBJECT" && isTeacher() && teachings.length > 0 && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Quick Select from Your Assigned Subject Teachings:
            </label>
            <select
              onChange={handleSelectTeaching}
              disabled={!canEdit}
              className="input text-xs w-full sm:w-auto"
            >
              <option value="">-- Choose your assigned teaching --</option>
              {teachings.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.subject?.name} — Class {t.class?.name} (
                  {t.class?.gradeLevel?.name})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Table Grid & Columns Toolbar ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-600" />
            <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">
              Curriculum Scheme of Work Table
            </h2>
            <span className="text-xs text-gray-500">
              ({columns.length} columns · {rows.length} rows)
            </span>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsColumnModalOpen(true)}
                className="btn-secondary text-xs inline-flex items-center gap-1 py-1.5 px-3"
              >
                <Columns className="w-3.5 h-3.5" />
                Add Column
              </button>

              <button
                type="button"
                onClick={handleAddRow}
                className="btn-primary text-xs inline-flex items-center gap-1 py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Row
              </button>
            </div>
          )}
        </div>

        {/* ── Spreadsheet Grid Container ── */}
        <div className="card overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="min-w-full text-left text-xs border-collapse">
              {/* Header */}
              <thead className="bg-gray-900 text-white uppercase text-[11px] sticky top-0 z-10">
                <tr>
                  <th className="w-12 px-3 py-3 font-bold border-r border-gray-700 text-center">
                    #
                  </th>
                  {columns.map((col, cIdx) => (
                    <th
                      key={cIdx}
                      className="px-3 py-3 font-bold border-r border-gray-700 min-w-[160px]"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>{col}</span>
                        {canEdit && columns.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteColumn(cIdx)}
                            className="p-1 text-gray-400 hover:text-red-400 rounded transition-colors"
                            title="Remove Column"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {canEdit && (
                    <th className="w-20 px-3 py-3 font-bold text-center">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + 2}
                      className="text-center py-10 text-gray-400"
                    >
                      No rows added yet. Click "+ Add Row" to begin.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Row Index */}
                      <td className="px-3 py-2 text-center font-bold text-gray-400 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900">
                        {rIdx + 1}
                      </td>

                      {/* Editable Cells */}
                      {columns.map((col, cIdx) => {
                        const cellVal = Array.isArray(row)
                          ? row[cIdx] || ""
                          : row[col] || "";
                        return (
                          <td
                            key={cIdx}
                            className="p-1.5 border-r border-gray-200 dark:border-gray-800 align-top"
                          >
                            {canEdit ? (
                              <textarea
                                rows={2}
                                value={cellVal}
                                onChange={(e) =>
                                  handleCellChange(rIdx, cIdx, e.target.value)
                                }
                                placeholder={`Enter ${col}…`}
                                className="w-full text-xs p-1.5 rounded border border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 bg-transparent resize-y"
                              />
                            ) : (
                              <div className="p-1 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {cellVal || "—"}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Actions */}
                      {canEdit && (
                        <td className="px-2 py-2 text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rIdx, "up")}
                              disabled={rIdx === 0}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="Move Up"
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rIdx, "down")}
                              disabled={rIdx === rows.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="Move Down"
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(rIdx)}
                              className="p-1 text-red-400 hover:text-red-600"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ADD COLUMN MODAL ── */}
      <Modal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        title="Add Custom Column to Scheme of Work"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Column Header Title *
            </label>
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newColumnName.trim()) {
                  e.preventDefault();
                  handleAddColumn();
                }
              }}
              placeholder="e.g. Differentiation / Special Needs, Evaluation"
              className="input w-full"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setIsColumnModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddColumn}
              disabled={!newColumnName.trim()}
              className="btn-primary"
            >
              Add Column
            </button>
          </div>
        </div>
      </Modal>

      {/* ── ADMIN REVIEW MODAL ── */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Review & Approve Scheme of Work"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
              Review Decision
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReviewDecision("APPROVED")}
                className={clsx(
                  "py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5",
                  reviewDecision === "APPROVED"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold ring-1 ring-emerald-500"
                    : "border-gray-200 dark:border-gray-800 text-gray-600",
                )}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Approve Plan
              </button>

              <button
                type="button"
                onClick={() => setReviewDecision("REVISION_REQUESTED")}
                className={clsx(
                  "py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5",
                  reviewDecision === "REVISION_REQUESTED"
                    ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold ring-1 ring-red-500"
                    : "border-gray-200 dark:border-gray-800 text-gray-600",
                )}
              >
                <RotateCcw className="w-4 h-4 text-red-600" />
                Request Revision
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Reviewer Notes / Feedback
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Enter comments or revision guidance for the teacher author…"
              className="input w-full text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
              className={clsx(
                "btn-primary inline-flex items-center gap-1.5",
                reviewDecision === "APPROVED"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700",
              )}
            >
              {reviewDecision === "APPROVED" ? (
                <>
                  <Check className="w-4 h-4" /> Approve Plan
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" /> Request Revision
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
