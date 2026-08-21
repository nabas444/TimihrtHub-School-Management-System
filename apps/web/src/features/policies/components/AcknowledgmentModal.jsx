import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck, Download, ExternalLink, AlertCircle } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";

export default function AcknowledgmentModal({ open, onClose, policy, pendingItem }) {
  const qc = useQueryClient();
  const [agreed, setAgreed] = useState(false);

  const policyTitle = pendingItem?.policyTitle || policy?.title || "School Policy";
  const versionNumber = pendingItem?.versionNumber || policy?.currentVersion?.versionNumber || "1.0";
  const versionId = pendingItem?.policyVersionId || policy?.currentVersion?.id || policy?.currentVersionId;
  const content = pendingItem?.versionContent || policy?.currentVersion?.content || "No document content provided.";
  const attachmentUrl = pendingItem?.attachmentUrl || policy?.currentVersion?.attachmentUrl;

  const ackMutation = useMutation({
    mutationFn: () => api.post(`/policies/versions/${versionId}/acknowledge`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-acknowledgments"] });
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["policy"] });
      toast.success("Policy acknowledgment recorded successfully!");
      setAgreed(false);
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to record acknowledgment");
    },
  });

  const handleConfirm = () => {
    if (!agreed) {
      toast.error("Please check the confirmation box to proceed.");
      return;
    }
    ackMutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Policy Acknowledgment — ${policyTitle} (v${versionNumber})`}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Review Later
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={handleConfirm}
            disabled={!agreed || ackMutation.isPending}
          >
            <ShieldCheck className="w-4 h-4" />
            {ackMutation.isPending ? "Recording…" : "Confirm Acknowledgment"}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between">
          <div>
            <div className="font-extrabold text-sm text-gray-900">{policyTitle}</div>
            <div className="text-gray-500 text-[11px] mt-0.5">
              Official School Policy • Version {versionNumber}
            </div>
          </div>

          {attachmentUrl && (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-sm inline-flex items-center gap-1 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Full Document
            </a>
          )}
        </div>

        {/* Policy Content Viewer */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 max-h-72 overflow-y-auto space-y-2 font-sans text-gray-800 leading-relaxed text-xs">
          <div className="whitespace-pre-wrap font-sans">{content}</div>
        </div>

        {/* Explicit confirmation checkbox */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <input
            type="checkbox"
            id="ack-confirm"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
          />
          <label htmlFor="ack-confirm" className="cursor-pointer text-emerald-950 font-medium leading-snug">
            I confirm that I have read, understood, and agree to adhere to <strong>{policyTitle}</strong> (Version {versionNumber}). I understand that this acknowledgment is recorded with my digital timestamp.
          </label>
        </div>
      </div>
    </Modal>
  );
}
