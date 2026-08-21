import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Upload, Paperclip, Globe, Shield, AlertTriangle } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";

const CATEGORIES = [
  { value: "SAFEGUARDING", label: "Safeguarding & Child Protection" },
  { value: "CODE_OF_CONDUCT", label: "Code of Conduct & Ethics" },
  { value: "ASSESSMENT", label: "Assessment & Academic Integrity" },
  { value: "ADMISSIONS", label: "Admissions & Enrollment Policy" },
  { value: "HEALTH_SAFETY", label: "Health, Safety & First Aid" },
  { value: "DATA_PROTECTION", label: "Data Protection & Privacy (GDPR)" },
  { value: "ANTI_BULLYING", label: "Anti-Bullying & Inclusion" },
  { value: "HR_EMPLOYMENT", label: "Staff HR & Employment Policies" },
  { value: "OTHER", label: "General School Policy / Other" },
];

const TARGET_AUDIENCES = [
  { value: "ALL_STAFF", label: "All Staff (Teachers, Admins, Finance)" },
  { value: "TEACHERS", label: "Teachers & Academic Faculty" },
  { value: "STUDENTS", label: "Students" },
  { value: "PARENTS", label: "Parents & Guardians" },
  { value: "ALL", label: "Whole School Community (All Roles)" },
];

export default function PolicyModal({ open, onClose, policy }) {
  const qc = useQueryClient();
  const isEditing = !!policy;
  const fileInputRef = useRef(null);

  const [uploadingFile, setUploadingFile] = useState(false);

  const [form, setForm] = useState({
    category: "SAFEGUARDING",
    title: "",
    summary: "",
    ownerId: "",
    targetAudience: "ALL_STAFF",
    isPubliclyVisible: false,
    nextReviewDate: "",
    reviewIntervalMonths: 12,
    initialContent: "",
    attachmentUrl: "",
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-users-list"],
    queryFn: () => api.get("/staff").then((r) => r.data.data || []),
    enabled: open,
  });

  useEffect(() => {
    if (policy) {
      setForm({
        category: policy.category || "OTHER",
        title: policy.title || "",
        summary: policy.summary || "",
        ownerId: policy.ownerId || policy.owner?.id || "",
        targetAudience: policy.targetAudience || "ALL_STAFF",
        isPubliclyVisible: !!policy.isPubliclyVisible,
        nextReviewDate: policy.nextReviewDate
          ? new Date(policy.nextReviewDate).toISOString().slice(0, 10)
          : "",
        reviewIntervalMonths: policy.reviewIntervalMonths || 12,
        initialContent: policy.currentVersion?.content || "",
        attachmentUrl: policy.currentVersion?.attachmentUrl || "",
      });
    } else {
      setForm({
        category: "SAFEGUARDING",
        title: "",
        summary: "",
        ownerId: staffList[0]?.id || "",
        targetAudience: "ALL_STAFF",
        isPubliclyVisible: false,
        nextReviewDate: "",
        reviewIntervalMonths: 12,
        initialContent: "",
        attachmentUrl: "",
      });
    }
  }, [policy, open, staffList]);

  const saveMutation = useMutation({
    mutationFn: (data) =>
      isEditing
        ? api.patch(`/policies/${policy.id}`, data)
        : api.post("/policies", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policies"] });
      toast.success(isEditing ? "Policy updated" : "Policy created");
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save policy");
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "REPORT");
      const res = await api.post("/files/upload", fd);
      const uploaded = res.data.data;

      setForm((f) => ({
        ...f,
        attachmentUrl: uploaded.url,
      }));
      toast.success(`Attached document: ${uploaded.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload document");
    } finally {
      setUploadingFile(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.ownerId) {
      toast.error("Title and Policy Owner are required");
      return;
    }
    if (!isEditing && !form.initialContent.trim()) {
      toast.error("Initial policy content is required");
      return;
    }

    saveMutation.mutate(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? `Edit Policy — ${policy?.title}` : "New Policy Document"}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
          >
            <Check className="w-4 h-4" />
            {saveMutation.isPending ? "Saving…" : isEditing ? "Update Policy" : "Create Policy Draft"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label font-bold">Policy Category *</label>
            <select
              className="input text-xs"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label font-bold">Policy Owner (Staff Lead) *</label>
            <select
              className="input text-xs"
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              required
            >
              <option value="">Select Staff Owner</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label font-bold">Policy Title *</label>
          <input
            className="input text-xs"
            placeholder="e.g. Safeguarding & Child Protection Policy (2025/2026)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label font-bold">Executive Summary</label>
          <textarea
            className="input text-xs h-16"
            placeholder="Brief statement of policy intent, scope, and key compliance mandates..."
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
          <div>
            <label className="label font-bold">Target Acknowledgment Audience *</label>
            <select
              className="input text-xs"
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              required
            >
              {TARGET_AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label font-bold">Review Interval (Months)</label>
            <input
              type="number"
              min="1"
              max="36"
              className="input text-xs"
              value={form.reviewIntervalMonths}
              onChange={(e) => setForm({ ...form, reviewIntervalMonths: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label font-bold">Next Review Date</label>
            <input
              type="date"
              className="input text-xs"
              value={form.nextReviewDate}
              onChange={(e) => setForm({ ...form, nextReviewDate: e.target.value })}
            />
          </div>
        </div>

        {/* Public Visibility Toggle */}
        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <div>
              <span className="font-bold text-gray-900 block">Publicly Visible Policy</span>
              <span className="text-[11px] text-gray-500">
                Allow unauthenticated access (e.g. Safeguarding policies linked on school public landing page).
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={form.isPubliclyVisible}
            onChange={(e) => setForm({ ...form, isPubliclyVisible: e.target.checked })}
            className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
          />
        </div>

        {/* Content & Attachment */}
        {!isEditing && (
          <div>
            <label className="label font-bold">Policy Content / Articles (Markdown / Text) *</label>
            <textarea
              className="input text-xs h-32 font-mono"
              placeholder="# 1. Purpose & Scope&#10;This policy sets forth the mandatory guidelines...&#10;&#10;# 2. Key Responsibilities&#10;All employees and educators are required to..."
              value={form.initialContent}
              onChange={(e) => setForm({ ...form, initialContent: e.target.value })}
              required
            />
          </div>
        )}

        <div>
          <label className="label font-bold">Official Document Attachment (PDF / Signed Copy)</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="input text-xs flex-1"
              placeholder="https://... or upload PDF document below"
              value={form.attachmentUrl}
              onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
            />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="btn-secondary btn-sm inline-flex items-center gap-1 flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploadingFile ? "Uploading…" : "Upload PDF"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
