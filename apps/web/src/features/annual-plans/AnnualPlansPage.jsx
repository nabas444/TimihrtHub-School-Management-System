import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  BookOpen,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Eye,
  Edit,
  Trash2,
  Download,
  FileText,
  Layers,
  Sparkles,
  Check,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import { useAuthStore } from "../../store/authStore";
import { Badge, EmptyState, Avatar } from "../../components/ui/index";
import PageLoader from "../../components/ui/PageLoader";
import Modal from "../../components/ui/Modal";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function AnnualPlansPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, isAdmin, isTeacher } = useAuthStore();

  const [activeAdminTab, setActiveAdminTab] = useState("all"); // 'all' | 'review_queue' | 'school_wide'
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [academicYearFilter, setAcademicYearFilter] = useState("2024/2025");

  // Review modal state (Admin)
  const [reviewingPlan, setReviewingPlan] = useState(null);
  const [reviewDecision, setReviewDecision] = useState("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");

  // ── 1. Fetch Plans ───────────────────────────────────────────────────────
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["annual-plans", statusFilter, academicYearFilter, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (academicYearFilter) params.append("academicYear", academicYearFilter);
      if (searchQuery) params.append("search", searchQuery);

      return api.get(`/annual-plans?${params.toString()}`).then((r) => r.data.data);
    },
  });

  const rawPlans = plansData?.plans ?? [];

  // ── 2. Filter Plans by Role & Tab ────────────────────────────────────────
  const filteredPlans = useMemo(() => {
    return rawPlans.filter((plan) => {
      if (isAdmin()) {
        if (activeAdminTab === "review_queue") {
          return plan.status === "SUBMITTED";
        }
        if (activeAdminTab === "school_wide") {
          return plan.scope === "SCHOOL_WIDE";
        }
      }
      return true;
    });
  }, [rawPlans, activeAdminTab, isAdmin]);

  const pendingReviewCount = rawPlans.filter((p) => p.status === "SUBMITTED").length;

  // ── 3. Submit Plan Mutation (Teacher) ────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: (planId) => api.post(`/annual-plans/${planId}/submit`),
    onSuccess: () => {
      toast.success("Annual plan submitted for administrative review");
      queryClient.invalidateQueries({ queryKey: ["annual-plans"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit annual plan");
    },
  });

  // ── 4. Review Plan Mutation (Admin) ──────────────────────────────────────
  const reviewMutation = useMutation({
    mutationFn: ({ planId, decision, notes }) =>
      api.post(`/annual-plans/${planId}/review`, { decision, notes }),
    onSuccess: (_, variables) => {
      toast.success(
        variables.decision === "APPROVED"
          ? "Annual plan successfully approved"
          : "Revision requested and returned to author",
      );
      setReviewingPlan(null);
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["annual-plans"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to review annual plan");
    },
  });

  // ── 5. Delete Plan Mutation ──────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (planId) => api.delete(`/annual-plans/${planId}`),
    onSuccess: () => {
      toast.success("Annual plan deleted");
      queryClient.invalidateQueries({ queryKey: ["annual-plans"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete plan");
    },
  });

  // ── 6. Download PDF ──────────────────────────────────────────────────────
  const handleDownloadPdf = async (plan) => {
    try {
      const safeTitle = plan.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const filename = `annual-plan-${safeTitle}.pdf`;
      await downloadFile(`/annual-plans/${plan.id}/pdf`, filename);
      toast.success("Annual plan PDF downloaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to download PDF");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
        return <Badge variant="success">APPROVED</Badge>;
      case "SUBMITTED":
        return <Badge variant="primary">IN REVIEW</Badge>;
      case "REVISION_REQUESTED":
        return <Badge variant="danger">NEEDS REVISION</Badge>;
      default:
        return <Badge variant="neutral">DRAFT</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary-600" />
            Annual Curriculum & Schemes of Work
          </h1>
          <p className="page-subtitle">
            Author, structure, review, and print yearly academic scheme of work plans and school-wide curriculum roadmaps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/annual-plans/new"
            className="btn-primary inline-flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {isAdmin() ? "Create Annual Plan" : "Create Subject Plan"}
          </Link>
        </div>
      </div>

      {/* ── Admin Tabs ── */}
      {isAdmin() && (
        <div className="border-b border-gray-200 dark:border-gray-800">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveAdminTab("all")}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors",
                activeAdminTab === "all"
                  ? "border-primary-600 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white",
              )}
            >
              <Layers className="w-4 h-4" />
              All Plans ({rawPlans.length})
            </button>

            <button
              onClick={() => setActiveAdminTab("review_queue")}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors relative",
                activeAdminTab === "review_queue"
                  ? "border-primary-600 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white",
              )}
            >
              <Clock className="w-4 h-4" />
              Teacher Review Queue
              {pendingReviewCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 animate-pulse">
                  {pendingReviewCount} pending
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveAdminTab("school_wide")}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors",
                activeAdminTab === "school_wide"
                  ? "border-primary-600 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white",
              )}
            >
              <Sparkles className="w-4 h-4" />
              School-Wide Plans
            </button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search plan title or subject…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 w-full"
            />
          </div>

          {/* Academic Year */}
          <div>
            <select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              className="input w-full"
            >
              <option value="2024/2025">2024 / 2025</option>
              <option value="2025/2026">2025 / 2026</option>
              <option value="2026/2027">2026 / 2027</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-full"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted / In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REVISION_REQUESTED">Needs Revision</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Plans List / Table ── */}
      {plansLoading ? (
        <PageLoader />
      ) : filteredPlans.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={BookOpen}
            title="No annual curriculum plans found"
            description={
              isTeacher()
                ? "You haven't created any subject annual plans yet for this academic year."
                : "No plans match your selected tab or filter criteria."
            }
            action={
              <Link
                to="/annual-plans/new"
                className="btn-primary inline-flex items-center gap-2 mt-4"
              >
                <Plus className="w-4 h-4" /> Create New Plan
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => {
            const authorName = [
              plan.createdBy?.firstName,
              plan.createdBy?.middleName,
              plan.createdBy?.lastName,
            ]
              .filter(Boolean)
              .join(" ");

            const isSchoolWide = plan.scope === "SCHOOL_WIDE";
            const isAuthor = plan.createdById === user?.id;
            const canEdit =
              isAdmin() ||
              (isAuthor &&
                ["DRAFT", "REVISION_REQUESTED"].includes(plan.status));
            const canSubmit =
              isAuthor &&
              ["DRAFT", "REVISION_REQUESTED"].includes(plan.status);

            const numCols = Array.isArray(plan.columns) ? plan.columns.length : 0;
            const numRows = Array.isArray(plan.rows) ? plan.rows.length : 0;

            return (
              <div
                key={plan.id}
                className="card p-5 flex flex-col justify-between hover:shadow-md transition-shadow border-t-4 border-t-primary-600 relative overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Top Bar: Status & Scope */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      {isSchoolWide ? (
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      ) : (
                        <BookOpen className="w-3.5 h-3.5 text-primary-600" />
                      )}
                      {isSchoolWide
                        ? "School-Wide Plan"
                        : plan.subject?.name || "Subject Plan"}
                    </span>
                    {getStatusBadge(plan.status)}
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white leading-snug">
                    <Link
                      to={`/annual-plans/${plan.id}`}
                      className="hover:text-primary-600 transition-colors"
                    >
                      {plan.title}
                    </Link>
                  </h3>

                  {/* Metadata */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>
                      Author:{" "}
                      <strong className="text-gray-700 dark:text-gray-300">
                        {authorName || "Faculty"}
                      </strong>{" "}
                      {plan.createdBy?.role ? `(${plan.createdBy.role})` : ""}
                    </p>
                    <p>
                      Academic Year:{" "}
                      <strong className="text-gray-700 dark:text-gray-300">
                        {plan.academicYear}
                      </strong>{" "}
                      · Grid: {numCols} cols × {numRows} rows
                    </p>
                  </div>

                  {/* Revision Notes Alert */}
                  {plan.status === "REVISION_REQUESTED" && plan.reviewNotes && (
                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-red-700 dark:text-red-300">
                      <strong>Revision note:</strong> {plan.reviewNotes}
                    </div>
                  )}

                  {/* Approved note */}
                  {plan.status === "APPROVED" && plan.reviewedBy && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Approved by {plan.reviewedBy.firstName} {plan.reviewedBy.lastName}
                    </p>
                  )}
                </div>

                {/* Bottom Actions Bar */}
                <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {/* View / Edit */}
                    <Link
                      to={`/annual-plans/${plan.id}`}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 hover:text-gray-900 transition-colors"
                      title={canEdit ? "Edit Plan" : "View Plan"}
                    >
                      {canEdit ? (
                        <Edit className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Link>

                    {/* Download PDF */}
                    <button
                      onClick={() => handleDownloadPdf(plan)}
                      className="p-1.5 rounded-md hover:bg-primary-50 text-primary-600 transition-colors"
                      title="Download PDF (A4)"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Delete (if permitted) */}
                    {(isAdmin() || (isAuthor && plan.status !== "APPROVED")) && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to delete this annual plan?",
                            )
                          ) {
                            deleteMutation.mutate(plan.id);
                          }
                        }}
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                        title="Delete Plan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Action CTA: Submit or Review */}
                  <div className="flex items-center gap-1.5">
                    {canSubmit && (
                      <button
                        onClick={() => submitMutation.mutate(plan.id)}
                        disabled={submitMutation.isPending}
                        className="btn-primary py-1 px-2.5 text-xs inline-flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Submit
                      </button>
                    )}

                    {isAdmin() && plan.status === "SUBMITTED" && (
                      <button
                        onClick={() => {
                          setReviewingPlan(plan);
                          setReviewDecision("APPROVED");
                          setReviewNotes("");
                        }}
                        className="btn-primary py-1 px-2.5 text-xs inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADMIN REVIEW MODAL ── */}
      {reviewingPlan && (
        <Modal
          isOpen={!!reviewingPlan}
          onClose={() => setReviewingPlan(null)}
          title={`Review Annual Plan: ${reviewingPlan.title}`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Submitted by{" "}
              <strong>
                {reviewingPlan.createdBy?.firstName}{" "}
                {reviewingPlan.createdBy?.lastName}
              </strong>{" "}
              for{" "}
              <strong>
                {reviewingPlan.subject?.name || reviewingPlan.title}
              </strong>{" "}
              ({reviewingPlan.academicYear}).
            </p>

            {/* Decision Toggle */}
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

            {/* Notes / Feedback */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Reviewer Notes & Feedback (Optional if approved, recommended for revisions)
              </label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Enter feedback or requested modifications for the teacher…"
                className="input w-full text-xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setReviewingPlan(null)}
                className="btn-secondary"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  reviewMutation.mutate({
                    planId: reviewingPlan.id,
                    decision: reviewDecision,
                    notes: reviewNotes,
                  })
                }
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
                    <RotateCcw className="w-4 h-4" /> Send Revision Request
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
