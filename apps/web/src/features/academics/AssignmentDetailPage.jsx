import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import { Badge, Avatar, EmptyState } from "../../components/ui/index";
import PageLoader from "../../components/ui/PageLoader";
import Modal from "../../components/ui/Modal";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  CheckCircle2,
  XCircle,
  FileText,
  Send,
  Sparkles,
  BookOpen,
  Calendar,
  Eye,
  Award,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { evaluateDeadline, formatInSchoolTimezone } from "../../lib/deadlines";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function AssignmentDetailPage() {
  const { id } = useParams();
  const { user, isStudent, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();

  const [statusTab, setStatusTab] = useState("ALL"); // "ALL" | "SUBMITTED" | "NOT_SUBMITTED" | "LATE" | "GRADED"
  const [gradeOpen, setGradeOpen] = useState(null);
  const [viewSubmissionOpen, setViewSubmissionOpen] = useState(null);
  const [gradeForm, setGradeForm] = useState({ marksObtained: "", feedback: "" });
  const [submitForm, setSubmitForm] = useState({ content: "" });

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignment", id],
    queryFn: () => api.get(`/academics/assignments/${id}`).then((r) => r.data.data),
  });

  const gradeMutation = useMutation({
    mutationFn: ({ subId, ...d }) =>
      api.patch(`/academics/assignments/submissions/${subId}/grade`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment", id] });
      toast.success("Grade saved successfully!");
      setGradeOpen(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save grade");
    },
  });

  const submitMutation = useMutation({
    mutationFn: (d) => api.post(`/academics/assignments/${id}/submit`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment", id] });
      toast.success("Assignment submitted successfully!");
      setSubmitForm({ content: "" });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit assignment");
    },
  });

  const isStaff = isAdmin() || isTeacher();
  const timezone = user?.school?.timezone || "Africa/Addis_Ababa";

  // Compute deadline status
  const deadlineEval = useMemo(() => {
    if (!assignment) return null;
    return evaluateDeadline(assignment.dueDate, timezone);
  }, [assignment, timezone]);

  // Roster breakdown
  const fullRoster = useMemo(() => {
    if (!assignment?.fullRoster) {
      return (assignment?.submissions ?? []).map((s) => ({
        studentId: s.student?.id,
        student: s.student,
        submissionId: s.id,
        status: s.status,
        submittedAt: s.submittedAt,
        marksObtained: s.marksObtained,
        feedback: s.feedback,
        content: s.content,
      }));
    }
    return assignment.fullRoster;
  }, [assignment]);

  const filteredRoster = useMemo(() => {
    if (statusTab === "ALL") return fullRoster;
    if (statusTab === "NOT_SUBMITTED")
      return fullRoster.filter((r) => r.status === "NOT_SUBMITTED");
    if (statusTab === "SUBMITTED")
      return fullRoster.filter((r) => r.status === "SUBMITTED");
    if (statusTab === "LATE")
      return fullRoster.filter((r) => r.status === "LATE");
    if (statusTab === "GRADED")
      return fullRoster.filter((r) => r.status === "GRADED");
    return fullRoster;
  }, [fullRoster, statusTab]);

  const counts = useMemo(() => {
    const total = fullRoster.length;
    const submitted = fullRoster.filter((r) => r.status !== "NOT_SUBMITTED").length;
    const notSubmitted = fullRoster.filter((r) => r.status === "NOT_SUBMITTED").length;
    const late = fullRoster.filter((r) => r.status === "LATE").length;
    const graded = fullRoster.filter((r) => r.status === "GRADED").length;
    const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;
    return { total, submitted, notSubmitted, late, graded, rate };
  }, [fullRoster]);

  // Find current student submission if viewing as student
  const mySubmission = useMemo(() => {
    if (!isStudent() || !assignment) return null;
    return (assignment.submissions ?? []).find((s) => s.studentId === user?.id) || null;
  }, [isStudent, assignment, user]);

  if (isLoading) return <PageLoader />;
  if (!assignment)
    return (
      <div className="text-center text-gray-400 py-16">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        Assignment not found
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        to="/assignments"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Assignments
      </Link>

      {/* ── Assignment Main Overview Card ──────────────────────────────────── */}
      <div className="card p-6 bg-white border border-gray-200">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="blue">{assignment.subject?.name}</Badge>
            {assignment.class && (
              <Badge variant="purple">Class {assignment.class.name}</Badge>
            )}
            <Badge variant="gray">{assignment.type || "HOMEWORK"}</Badge>

            {/* Timezone-aware Deadline Status Badge */}
            {deadlineEval && (
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border",
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
                <Clock className="w-3 h-3" />
                {deadlineEval.humanCountdown}
              </span>
            )}
          </div>

          <div className="text-right text-xs text-gray-500">
            <span>Total: </span>
            <strong className="text-gray-900 text-sm">{assignment.totalMarks} pts</strong>
          </div>
        </div>

        <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
          {assignment.title}
        </h1>

        {assignment.description && (
          <p className="text-sm text-gray-600 mb-3">{assignment.description}</p>
        )}

        {assignment.instructions && (
          <div className="mt-4 p-4 bg-primary-50/60 rounded-2xl border border-primary-100">
            <p className="text-xs font-bold text-primary-900 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary-600" />
              Detailed Instructions
            </p>
            <p className="text-xs text-primary-800 whitespace-pre-wrap leading-relaxed">
              {assignment.instructions}
            </p>
          </div>
        )}

        {/* Metadata Footer */}
        <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            Due:{" "}
            <strong className="text-gray-800 font-bold">
              {formatInSchoolTimezone(assignment.dueDate, timezone)}
            </strong>
          </span>
          <span>•</span>
          <span>
            Created by:{" "}
            <strong className="text-gray-800 font-bold">
              {assignment.createdBy?.firstName} {assignment.createdBy?.lastName}
            </strong>
          </span>
          {assignment.allowLate && (
            <>
              <span>•</span>
              <span className="text-emerald-600 font-semibold">Late Submissions Allowed</span>
            </>
          )}
        </div>
      </div>

      {/* ── STUDENT VIEW: SUBMISSION PORTAL ─────────────────────────────────── */}
      {isStudent() && (
        <div className="card p-6 bg-white border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-primary-600" />
              Your Assignment Submission
            </h2>
            {mySubmission ? (
              <Badge
                variant={
                  mySubmission.status === "GRADED"
                    ? "green"
                    : mySubmission.status === "LATE"
                    ? "red"
                    : "blue"
                }
              >
                {mySubmission.status === "GRADED"
                  ? "Graded"
                  : mySubmission.status === "LATE"
                  ? "Submitted Late"
                  : "Submitted"}
              </Badge>
            ) : deadlineEval?.isOverdue ? (
              <Badge variant="red">Overdue</Badge>
            ) : (
              <Badge variant="yellow">Pending Submission</Badge>
            )}
          </div>

          {mySubmission ? (
            <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Submitted at:</span>
                <strong className="text-gray-900">
                  {formatInSchoolTimezone(mySubmission.submittedAt, timezone)}
                </strong>
              </div>

              {mySubmission.content && (
                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <p className="text-gray-400 font-semibold mb-1">Your Submission Content:</p>
                  <p className="text-gray-800 whitespace-pre-wrap">{mySubmission.content}</p>
                </div>
              )}

              {mySubmission.marksObtained != null && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-emerald-900">Teacher Grade:</span>
                    <strong className="text-emerald-800 text-sm">
                      {mySubmission.marksObtained} / {assignment.totalMarks} pts
                    </strong>
                  </div>
                  {mySubmission.feedback && (
                    <p className="text-emerald-700 mt-1 italic">
                      &ldquo;{mySubmission.feedback}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Write your response, solution notes, or cloud document links below and submit before the deadline.
              </p>
              <textarea
                className="input text-xs min-h-32 resize-none"
                value={submitForm.content}
                onChange={(e) => setSubmitForm({ content: e.target.value })}
                placeholder="Type your answer, response text, or reference URLs here…"
                required
              />
              <div className="flex justify-end">
                <button
                  className="btn-primary inline-flex items-center gap-1.5"
                  onClick={() => submitMutation.mutate({ content: submitForm.content })}
                  disabled={submitMutation.isPending || !submitForm.content.trim()}
                >
                  <Send className="w-4 h-4" />
                  {submitMutation.isPending ? "Submitting…" : "Submit Assignment"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TEACHER / ADMIN VIEW: FULL ROSTER SUBMISSION BREAKDOWN ───────────── */}
      {isStaff && (
        <div className="card bg-white border border-gray-200 overflow-hidden">
          {/* Header & Metrics */}
          <div className="p-5 border-b border-gray-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  Class Submission Progress & Roster
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Track which students submitted on time, submitted late, or have not submitted yet
                </p>
              </div>

              {/* Progress Bar Badge */}
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${counts.rate}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-700">{counts.rate}%</span>
              </div>
            </div>

            {/* Metric Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {[
                { id: "ALL", label: `All Students (${counts.total})` },
                { id: "SUBMITTED", label: `Submitted (${counts.submitted})` },
                { id: "NOT_SUBMITTED", label: `Missing / Not Submitted (${counts.notSubmitted})` },
                { id: "LATE", label: `Late Submissions (${counts.late})` },
                { id: "GRADED", label: `Graded (${counts.graded})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusTab(tab.id)}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap",
                    statusTab === tab.id
                      ? "bg-primary-600 text-white shadow-xs"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto">
            {filteredRoster.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No students match this submission filter.
              </div>
            ) : (
              <table className="table w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-200">
                    <th className="py-3 px-4 font-bold text-gray-700">Student</th>
                    <th className="py-3 px-4 font-bold text-gray-700">Submission Status</th>
                    <th className="py-3 px-4 font-bold text-gray-700">Submitted Time ({timezone})</th>
                    <th className="py-3 px-4 font-bold text-gray-700">Score</th>
                    <th className="py-3 px-4 font-bold text-gray-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRoster.map((r) => {
                    const isSubmitted = r.status !== "NOT_SUBMITTED";
                    return (
                      <tr key={r.studentId} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={`${r.student?.firstName} ${r.student?.lastName}`}
                              src={r.student?.avatar}
                              size="sm"
                            />
                            <div>
                              <p className="font-bold text-gray-900">
                                {r.student?.firstName} {r.student?.lastName}
                              </p>
                              <p className="text-[10px] text-gray-400">{r.student?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {r.status === "GRADED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <CheckCircle2 className="w-3 h-3 text-purple-600" /> Graded
                            </span>
                          )}
                          {r.status === "SUBMITTED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Submitted (On-Time)
                            </span>
                          )}
                          {r.status === "LATE" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                              <Clock className="w-3 h-3 text-red-600" /> Submitted Late
                            </span>
                          )}
                          {r.status === "NOT_SUBMITTED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                              <XCircle className="w-3 h-3 text-gray-400" /> Not Submitted
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                          {r.submittedAt
                            ? formatInSchoolTimezone(r.submittedAt, timezone)
                            : "—"}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {r.marksObtained != null ? (
                            <span className="text-emerald-700">
                              {r.marksObtained} / {assignment.totalMarks}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isSubmitted && r.content && (
                              <button
                                className="btn-ghost p-1.5 text-gray-500 hover:text-primary-600"
                                title="View Submission"
                                onClick={() => setViewSubmissionOpen(r)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isSubmitted && (
                              <button
                                className="btn-primary btn-sm inline-flex items-center gap-1 py-1 px-2.5 text-xs"
                                onClick={() => {
                                  setGradeOpen(r);
                                  setGradeForm({
                                    marksObtained: r.marksObtained ?? "",
                                    feedback: r.feedback ?? "",
                                  });
                                }}
                              >
                                <Award className="w-3 h-3" />
                                {r.status === "GRADED" ? "Regrade" : "Grade"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── View Submission Content Modal ──────────────────────────────────── */}
      <Modal
        open={!!viewSubmissionOpen}
        onClose={() => setViewSubmissionOpen(null)}
        title={`Submission: ${viewSubmissionOpen?.student?.firstName} ${viewSubmissionOpen?.student?.lastName}`}
        size="md"
        footer={
          <button className="btn-secondary" onClick={() => setViewSubmissionOpen(null)}>
            Close
          </button>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Submitted Date:</p>
            <p className="font-semibold text-gray-800">
              {viewSubmissionOpen?.submittedAt
                ? formatInSchoolTimezone(viewSubmissionOpen.submittedAt, timezone)
                : "—"}
            </p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-1">
            <p className="text-[10px] text-gray-400 font-bold uppercase">Submission Content:</p>
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {viewSubmissionOpen?.content || "No text content submitted."}
            </p>
          </div>
        </div>
      </Modal>

      {/* ── Grade Submission Modal ─────────────────────────────────────────── */}
      <Modal
        open={!!gradeOpen}
        onClose={() => setGradeOpen(null)}
        title={`Grade Submission — ${gradeOpen?.student?.firstName} ${gradeOpen?.student?.lastName}`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setGradeOpen(null)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() =>
                gradeMutation.mutate({
                  subId: gradeOpen?.submissionId,
                  marksObtained: parseFloat(gradeForm.marksObtained),
                  feedback: gradeForm.feedback,
                })
              }
              disabled={gradeMutation.isPending || gradeForm.marksObtained === ""}
            >
              {gradeMutation.isPending ? "Saving…" : "Save Grade"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          {gradeOpen?.content && (
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
              <span className="font-bold block text-gray-500 text-[10px] uppercase">
                Student Content:
              </span>
              {gradeOpen.content}
            </div>
          )}
          <div>
            <label className="label font-bold">
              Score (out of {assignment.totalMarks}) *
            </label>
            <input
              className="input text-xs font-mono"
              type="number"
              min="0"
              max={assignment.totalMarks}
              step="0.5"
              value={gradeForm.marksObtained}
              onChange={(e) =>
                setGradeForm((f) => ({ ...f, marksObtained: e.target.value }))
              }
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label font-bold">Feedback / Remarks</label>
            <textarea
              className="input text-xs min-h-20 resize-none"
              value={gradeForm.feedback}
              onChange={(e) => setGradeForm((f) => ({ ...f, feedback: e.target.value }))}
              placeholder="Good effort! Review Chapter 4 question 2…"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
