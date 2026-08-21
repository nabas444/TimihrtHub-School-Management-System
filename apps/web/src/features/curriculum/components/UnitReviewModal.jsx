import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";

export default function UnitReviewModal({ open, onClose, unit }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState("APPROVED");
  const [notes, setNotes] = useState("");

  const reviewMutation = useMutation({
    mutationFn: (data) => api.post(`/curriculum/units/${unit.id}/review`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curriculum-units"] });
      toast.success(
        decision === "APPROVED"
          ? "Curriculum unit approved"
          : "Revision requested and returned to author",
      );
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit review");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    reviewMutation.mutate({ decision, notes });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Review Curriculum Unit — ${unit?.title}`}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={decision === "APPROVED" ? "btn-primary" : "btn-danger"}
            onClick={handleSubmit}
            disabled={reviewMutation.isPending}
          >
            {reviewMutation.isPending ? "Submitting…" : decision === "APPROVED" ? "Approve Unit" : "Request Revisions"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div className="font-bold text-gray-900 text-sm">{unit?.title}</div>
          <div className="text-gray-500 mt-1">
            Subject: <strong>{unit?.subject?.name}</strong> • Grade: <strong>{unit?.gradeLevel?.name}</strong> • Author: <strong>{unit?.createdBy?.firstName} {unit?.createdBy?.lastName}</strong>
          </div>
        </div>

        <div>
          <label className="label font-bold">Review Decision *</label>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              type="button"
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                decision === "APPROVED"
                  ? "bg-green-50 border-green-500 text-green-700 shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setDecision("APPROVED")}
            >
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Approve Unit
            </button>
            <button
              type="button"
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                decision === "REVISION_REQUESTED"
                  ? "bg-amber-50 border-amber-500 text-amber-700 shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setDecision("REVISION_REQUESTED")}
            >
              <AlertCircle className="w-4 h-4 text-amber-600" /> Request Revisions
            </button>
          </div>
        </div>

        <div>
          <label className="label font-bold">Reviewer Feedback & Notes</label>
          <textarea
            className="input text-xs h-24"
            placeholder={
              decision === "APPROVED"
                ? "Optional commendation notes or implementation guidance..."
                : "Specific items requiring revision before approval..."
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
