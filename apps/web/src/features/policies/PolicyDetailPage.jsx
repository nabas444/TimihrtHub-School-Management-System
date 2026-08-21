import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  History,
  FileText,
  Calendar,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  Globe,
  Upload,
  Send,
  Plus,
  Edit2,
  ExternalLink,
  ArrowLeft,
  Clock,
  ShieldCheck,
} from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import PageLoader from "../../components/ui/PageLoader";
import { Badge } from "../../components/ui/index";
import PolicyModal from "./components/PolicyModal";
import PolicyVersionModal from "./components/PolicyVersionModal";
import AcknowledgmentModal from "./components/AcknowledgmentModal";
import AcknowledgmentReportModal from "./components/AcknowledgmentReportModal";
import toast from "react-hot-toast";
import clsx from "clsx";

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", bg: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted for Review", bg: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved (Ready to Publish)", bg: "bg-purple-50 text-purple-700 border-purple-200" },
  REVISION_REQUESTED: { label: "Revision Requested", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  PUBLISHED: { label: "Live & Distributed", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ARCHIVED: { label: "Archived", bg: "bg-gray-100 text-gray-400 border-gray-200" },
};

export default function PolicyDetailPage() {
  const { id } = useParams();
  const { user, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const canAdmin = isAdmin();
  const canEdit = isAdmin() || isTeacher();

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Selected Version for Viewing (defaults to current live version)
  const [selectedVersionId, setSelectedVersionId] = useState(null);

  const { data: policy, isLoading } = useQuery({
    queryKey: ["policy", id],
    queryFn: () => api.get(`/policies/${id}`).then((r) => r.data.data),
  });

  const versions = policy?.versions || [];
  const currentVer = versions.find((v) => v.id === (selectedVersionId || policy?.currentVersionId)) || policy?.currentVersion || versions[0];

  const isReviewDue = policy?.nextReviewDate && new Date(policy.nextReviewDate) <= new Date();

  // Publish Mutation
  const publishMutation = useMutation({
    mutationFn: (versionId) => api.post(`/policies/${id}/publish`, { versionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy", id] });
      qc.invalidateQueries({ queryKey: ["policies"] });
      toast.success("Policy published and distributed to targeted recipients!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to publish policy");
    },
  });

  // Submit Version Mutation
  const submitVersionMutation = useMutation({
    mutationFn: (vId) => api.post(`/policies/versions/${vId}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy", id] });
      toast.success("Policy revision submitted for administrative approval");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit revision");
    },
  });

  // Approve Version Mutation
  const approveVersionMutation = useMutation({
    mutationFn: ({ vId, decision }) =>
      api.post(`/policies/versions/${vId}/review`, { decision }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["policy", id] });
      toast.success(
        variables.decision === "APPROVED"
          ? "Policy version approved"
          : "Revision requested",
      );
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update review status");
    },
  });

  if (isLoading) return <PageLoader />;
  if (!policy) return <div className="p-12 text-center text-gray-500">Policy not found.</div>;

  const statusStyle = STATUS_CONFIG[policy.status] || STATUS_CONFIG.DRAFT;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/policies"
          className="btn-ghost btn-sm text-xs inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Policies
        </Link>

        <div className="flex items-center gap-2">
          {canAdmin && (
            <button
              className="btn-secondary btn-sm inline-flex items-center gap-1.5 text-xs"
              onClick={() => setReportModalOpen(true)}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Acknowledgment Report
            </button>
          )}

          {canEdit && (
            <>
              <button
                className="btn-secondary btn-sm inline-flex items-center gap-1.5 text-xs"
                onClick={() => setVersionModalOpen(true)}
              >
                <Plus className="w-4 h-4" /> Draft New Revision
              </button>
              <button
                className="btn-secondary btn-sm inline-flex items-center gap-1.5 text-xs"
                onClick={() => setEditModalOpen(true)}
              >
                <Edit2 className="w-4 h-4" /> Edit Details
              </button>
            </>
          )}

          <button
            className="btn-primary btn-sm inline-flex items-center gap-1.5 text-xs"
            onClick={() => setAckModalOpen(true)}
          >
            <CheckCircle2 className="w-4 h-4" /> Acknowledge Policy
          </button>
        </div>
      </div>

      {/* Main Header Banner */}
      <div className="card p-6 bg-white border border-gray-200 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="indigo">{policy.category.replace(/_/g, " ")}</Badge>
              <span
                className={clsx(
                  "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                  statusStyle.bg,
                )}
              >
                {statusStyle.label}
              </span>
              {policy.isPubliclyVisible && (
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Public
                </span>
              )}
            </div>

            <h1 className="text-xl font-extrabold text-gray-900 leading-snug">
              {policy.title}
            </h1>
            {policy.summary && (
              <p className="text-xs text-gray-600 leading-relaxed">{policy.summary}</p>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="flex sm:flex-col items-end gap-2 text-right">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1">
              <div className="text-gray-500">
                Staff Owner: <strong>{policy.owner?.firstName} {policy.owner?.lastName}</strong>
              </div>
              <div className="text-gray-500">
                Target Audience: <strong>{policy.targetAudience.replace(/_/g, " ")}</strong>
              </div>
              <div className={clsx("font-semibold", isReviewDue ? "text-red-600" : "text-gray-600")}>
                Next Review: {policy.nextReviewDate ? new Date(policy.nextReviewDate).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Document Viewer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Version Header Toolbar */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-gray-900">
                  Version {currentVer?.versionNumber || "1.0"}
                </span>
                <span className="text-xs text-gray-500">
                  • Published {currentVer?.publishedAt ? new Date(currentVer.publishedAt).toLocaleDateString() : "Draft"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {currentVer?.attachmentUrl && (
                  <a
                    href={currentVer.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5 py-1 px-2.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Download Attached PDF
                  </a>
                )}

                {canAdmin && (currentVer?.status === "APPROVED" || currentVer?.status === "DRAFT") && (
                  <button
                    className="btn-primary btn-sm text-xs py-1 px-2.5 inline-flex items-center gap-1"
                    onClick={() => publishMutation.mutate(currentVer.id)}
                    disabled={publishMutation.isPending}
                  >
                    <Send className="w-3 h-3" /> Publish & Distribute
                  </button>
                )}
              </div>
            </div>

            {/* Document Content */}
            <div className="p-6 prose max-w-none text-xs text-gray-800 leading-relaxed font-sans whitespace-pre-wrap">
              {currentVer?.content || "No content found for this version."}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Revision History & Compliance */}
        <div className="space-y-6">
          {/* Version History List */}
          <div className="card p-4 bg-white border border-gray-200 rounded-2xl space-y-3">
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
              <History className="w-4 h-4 text-primary-600" />
              Version History ({versions.length})
            </h3>

            <div className="divide-y divide-gray-100">
              {versions.map((ver) => {
                const isSelected = (selectedVersionId || policy.currentVersionId) === ver.id;
                const isLive = policy.currentVersionId === ver.id;

                return (
                  <div
                    key={ver.id}
                    onClick={() => setSelectedVersionId(ver.id)}
                    className={clsx(
                      "py-3 px-2 rounded-xl cursor-pointer transition-all space-y-1",
                      isSelected ? "bg-primary-50/70 border border-primary-200" : "hover:bg-gray-50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-gray-900">
                          v{ver.versionNumber}
                        </span>
                        {isLive && (
                          <Badge variant="green">Current Live</Badge>
                        )}
                        <span className="text-[10px] text-gray-500 font-medium">
                          ({ver.status})
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(ver.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {ver.changeSummary && (
                      <p className="text-[11px] text-gray-600 line-clamp-2">
                        {ver.changeSummary}
                      </p>
                    )}

                    <div className="text-[10px] text-gray-400 pt-1 flex items-center justify-between">
                      <span>By: {ver.createdBy?.firstName} {ver.createdBy?.lastName}</span>
                      {canAdmin && ver.status === "SUBMITTED" && (
                        <div className="flex items-center gap-1">
                          <button
                            className="btn-primary btn-sm text-[10px] py-0.5 px-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              approveVersionMutation.mutate({ vId: ver.id, decision: "APPROVED" });
                            }}
                          >
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PolicyModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        policy={policy}
      />

      <PolicyVersionModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        policy={policy}
      />

      <AcknowledgmentModal
        open={ackModalOpen}
        onClose={() => setAckModalOpen(false)}
        policy={policy}
      />

      <AcknowledgmentReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        policyId={policy.id}
      />
    </div>
  );
}
