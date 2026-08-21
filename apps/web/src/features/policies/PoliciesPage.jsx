import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Shield,
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  ExternalLink,
  Users,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  History,
  Check,
  Layers,
} from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, EmptyState } from "../../components/ui/index";
import PolicyModal from "./components/PolicyModal";
import AcknowledgmentModal from "./components/AcknowledgmentModal";
import AcknowledgmentReportModal from "./components/AcknowledgmentReportModal";
import toast from "react-hot-toast";
import clsx from "clsx";

const CATEGORIES = [
  { value: "ALL", label: "All Categories" },
  { value: "SAFEGUARDING", label: "Safeguarding & Child Protection" },
  { value: "CODE_OF_CONDUCT", label: "Code of Conduct & Ethics" },
  { value: "ASSESSMENT", label: "Assessment & Academic Integrity" },
  { value: "ADMISSIONS", label: "Admissions & Enrollment" },
  { value: "HEALTH_SAFETY", label: "Health, Safety & First Aid" },
  { value: "DATA_PROTECTION", label: "Data Protection & Privacy" },
  { value: "ANTI_BULLYING", label: "Anti-Bullying & Inclusion" },
  { value: "HR_EMPLOYMENT", label: "Staff HR & Employment" },
  { value: "OTHER", label: "Other School Policies" },
];

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", bg: "bg-gray-100 text-gray-700 border-gray-200" },
  SUBMITTED: { label: "Submitted for Review", bg: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", bg: "bg-purple-50 text-purple-700 border-purple-200" },
  REVISION_REQUESTED: { label: "Revision Requested", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  PUBLISHED: { label: "Published & Live", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function PoliciesPage() {
  const { user, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const canAdmin = isAdmin();
  const canEdit = isAdmin() || isTeacher();

  // Tab: "library" | "my-acks" | "review-due"
  const [activeTab, setActiveTab] = useState("library");

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewDueFilter, setReviewDueFilter] = useState(false);

  // Modals
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [ackModalItem, setAckModalItem] = useState(null);
  const [reportModalPolicyId, setReportModalPolicyId] = useState(null);

  // Policy List Query
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ["policies", categoryFilter, statusFilter, searchQuery, reviewDueFilter],
    queryFn: () => {
      let url = "/policies?";
      if (categoryFilter !== "ALL") url += `category=${categoryFilter}&`;
      if (statusFilter !== "ALL") url += `status=${statusFilter}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      if (reviewDueFilter) url += `reviewDueSoon=true&`;
      return api.get(url).then((r) => r.data.data || []);
    },
  });

  // Pending Acknowledgments for Current User
  const { data: pendingAcks = [], isLoading: acksLoading } = useQuery({
    queryKey: ["my-acknowledgments"],
    queryFn: () => api.get("/policies/my-acknowledgments").then((r) => r.data.data || []),
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Policies & School Governance</h1>
          <p className="page-subtitle">
            School governance documents, safeguarding compliance, version control, and digital acknowledgment tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => {
                setEditingPolicy(null);
                setPolicyModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Create Policy Document
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab("library")}
          className={clsx(
            "pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
            activeTab === "library"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-900",
          )}
        >
          <Shield className="w-4 h-4" /> Policy Library ({policies.length})
        </button>

        <button
          onClick={() => setActiveTab("my-acks")}
          className={clsx(
            "pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
            activeTab === "my-acks"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-900",
          )}
        >
          <ShieldCheck className="w-4 h-4" /> My Action Items
          {pendingAcks.length > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
              {pendingAcks.length} Pending
            </span>
          )}
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: POLICY LIBRARY */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "library" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  className="input text-xs pl-8 w-48"
                  placeholder="Search policies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="input text-xs w-48"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                className="input text-xs w-36"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="REVISION_REQUESTED">Revision Requested</option>
              </select>

              <button
                type="button"
                onClick={() => setReviewDueFilter(!reviewDueFilter)}
                className={clsx(
                  "btn-sm text-xs border inline-flex items-center gap-1.5",
                  reviewDueFilter
                    ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Review Due Soon
              </button>
            </div>
          </div>

          {/* Policy Cards Grid */}
          {policiesLoading ? (
            <PageLoader />
          ) : policies.length === 0 ? (
            <div className="card p-12 text-center bg-white border border-gray-200">
              <EmptyState
                icon={Shield}
                title="No policy documents found"
                description="Create and publish your school's code of conduct, safeguarding, or compliance policies."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {policies.map((p) => {
                const statusStyle = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
                const totalTargeted = p.totalTargetedCount || 0;
                const acknowledged = p.acknowledgedCount || 0;
                const ackPercent = totalTargeted > 0 ? Math.round((acknowledged / totalTargeted) * 100) : 0;
                const isReviewDue = p.nextReviewDate && new Date(p.nextReviewDate) <= new Date();

                return (
                  <div
                    key={p.id}
                    className="card p-4 bg-white border border-gray-200 rounded-2xl hover:border-primary-300 hover:shadow-sm transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <Badge variant="indigo">{p.category.replace(/_/g, " ")}</Badge>
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            statusStyle.bg,
                          )}
                        >
                          {statusStyle.label}
                        </span>
                      </div>

                      <div>
                        <Link
                          to={`/policies/${p.id}`}
                          className="font-extrabold text-sm text-gray-900 hover:text-primary-600 transition-colors line-clamp-2"
                        >
                          {p.title}
                        </Link>
                        {p.summary && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.summary}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-gray-100 text-xs">
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                        <div>
                          Owner: <strong>{p.owner?.firstName} {p.owner?.lastName}</strong>
                        </div>
                        <div>
                          Version: <strong>v{p.currentVersion?.versionNumber || "1.0"}</strong>
                        </div>
                      </div>

                      {/* Acknowledgment Rate Bar (if published) */}
                      {p.status === "PUBLISHED" && (
                        <div className="space-y-1 bg-gray-50 p-2 rounded-xl border border-gray-100">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600 font-semibold">Acknowledgment Rate</span>
                            <span className="font-bold text-primary-700">{ackPercent}% ({acknowledged}/{totalTargeted})</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full transition-all"
                              style={{ width: `${ackPercent}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span
                          className={clsx(
                            "text-[10px] font-medium flex items-center gap-1",
                            isReviewDue ? "text-red-600 font-bold" : "text-gray-400",
                          )}
                        >
                          <Calendar className="w-3 h-3" />
                          Review: {p.nextReviewDate ? new Date(p.nextReviewDate).toLocaleDateString() : "—"}
                        </span>

                        <div className="flex items-center gap-1">
                          {canAdmin && p.status === "PUBLISHED" && (
                            <button
                              className="btn-ghost btn-sm text-[11px] p-1 text-gray-500 hover:text-emerald-600"
                              onClick={() => setReportModalPolicyId(p.id)}
                              title="Audit Report"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <Link
                            to={`/policies/${p.id}`}
                            className="btn-primary btn-sm text-xs py-1 px-2.5 inline-flex items-center gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: MY ACKNOWLEDGMENTS (ACTION ITEMS) */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "my-acks" && (
        <div className="space-y-4">
          <div className="page-header">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Policies Requiring Your Acknowledgment</h3>
              <p className="page-subtitle">
                Please review these institutional policies and confirm your acknowledgment.
              </p>
            </div>
          </div>

          {acksLoading ? (
            <PageLoader />
          ) : pendingAcks.length === 0 ? (
            <div className="card p-12 text-center bg-white border border-gray-200 space-y-2">
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up!"
                description="You have acknowledged all required school governance documents and policies."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {pendingAcks.map((item) => (
                <div
                  key={item.acknowledgmentId}
                  className="card p-4 bg-white border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="yellow">Action Required</Badge>
                      <span className="font-extrabold text-sm text-gray-900">
                        {item.policyTitle} (Version {item.versionNumber})
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {item.policySummary || "Official school compliance document."}
                    </p>
                    <span className="text-[10px] text-gray-400 block">
                      Assigned on {new Date(item.assignedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <button
                    className="btn-primary inline-flex items-center gap-1.5 flex-shrink-0"
                    onClick={() => setAckModalItem(item)}
                  >
                    <ShieldCheck className="w-4 h-4" /> Read & Acknowledge
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <PolicyModal
        open={policyModalOpen}
        onClose={() => {
          setPolicyModalOpen(false);
          setEditingPolicy(null);
        }}
        policy={editingPolicy}
      />

      <AcknowledgmentModal
        open={!!ackModalItem}
        onClose={() => setAckModalItem(null)}
        pendingItem={ackModalItem}
      />

      <AcknowledgmentReportModal
        open={!!reportModalPolicyId}
        onClose={() => setReportModalPolicyId(null)}
        policyId={reportModalPolicyId}
      />
    </div>
  );
}
