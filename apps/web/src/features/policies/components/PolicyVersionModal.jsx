import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Upload, History } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";

export default function PolicyVersionModal({ open, onClose, policy }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Suggest next version number
  const latestVer = policy?.currentVersion?.versionNumber || "1.0";
  const nextVerSuggested = latestVer.includes(".")
    ? `${latestVer.split(".")[0]}.${Number(latestVer.split(".")[1]) + 1}`
    : `${latestVer}.1`;

  const [form, setForm] = useState({
    versionNumber: nextVerSuggested,
    content: policy?.currentVersion?.content || "",
    attachmentUrl: policy?.currentVersion?.attachmentUrl || "",
    changeSummary: "",
  });

  const saveMutation = useMutation({
    mutationFn: (data) => api.post(`/policies/${policy.id}/versions`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["policy", policy.id] });
      toast.success("New policy version drafted successfully");
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create policy version");
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
    if (!form.versionNumber.trim() || !form.content.trim() || !form.changeSummary.trim()) {
      toast.error("Version Number, Content, and Change Summary are required");
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Draft New Revision — ${policy?.title}`}
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
            {saveMutation.isPending ? "Saving…" : "Save Draft Revision"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
          <div>
            <label className="label font-bold">New Version # *</label>
            <input
              className="input text-xs font-mono font-bold"
              placeholder="e.g. 1.1 or 2.0"
              value={form.versionNumber}
              onChange={(e) => setForm({ ...form, versionNumber: e.target.value })}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label font-bold">Change Summary *</label>
            <input
              className="input text-xs"
              placeholder="e.g. Annual scheduled review with updated safeguarding officer contact details."
              value={form.changeSummary}
              onChange={(e) => setForm({ ...form, changeSummary: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="label font-bold">Revised Policy Content (Markdown / Text) *</label>
          <textarea
            className="input text-xs h-40 font-mono"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label font-bold">Updated PDF / Document Attachment</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="input text-xs flex-1"
              placeholder="https://..."
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
