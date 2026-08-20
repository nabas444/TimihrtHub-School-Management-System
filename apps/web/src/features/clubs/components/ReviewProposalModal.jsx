import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";

export default function ReviewProposalModal({ open, onClose, club }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }) =>
      api.patch(`/clubs/${id}/status`, { status, reviewNotes: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clubs"] });
      qc.invalidateQueries({ queryKey: ["pending-clubs"] });
      toast.success("Club proposal rejected");
      onClose();
      setReason("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update proposal");
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reject Club Proposal — ${club?.name}`}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-danger inline-flex items-center gap-1.5"
            onClick={() =>
              updateStatusMutation.mutate({
                id: club?.id,
                status: "REJECTED",
                reason,
              })
            }
            disabled={updateStatusMutation.isPending || !reason.trim()}
          >
            <XCircle className="w-3.5 h-3.5" />
            Confirm Rejection
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <div>
          <label className="label font-bold">Rejection Feedback / Reason *</label>
          <textarea
            className="input text-xs min-h-20 resize-none"
            placeholder="Explain why this club proposal cannot be approved at this time…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>
      </div>
    </Modal>
  );
}
