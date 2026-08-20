import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";

export default function JoinClubModal({ open, onClose, club }) {
  const qc = useQueryClient();
  const [joinNotes, setJoinNotes] = useState("");

  const joinMutation = useMutation({
    mutationFn: (d) => api.post(`/clubs/${d.clubId}/join`, { notes: d.requestNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clubs"] });
      qc.invalidateQueries({ queryKey: ["my-clubs"] });
      toast.success("Membership request sent to club leaders!");
      onClose();
      setJoinNotes("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit membership request");
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Join ${club?.name}`}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={() =>
              joinMutation.mutate({
                clubId: club?.id,
                requestNotes: joinNotes,
              })
            }
            disabled={joinMutation.isPending}
          >
            <Send className="w-3.5 h-3.5" />
            {joinMutation.isPending ? "Sending…" : "Submit Request"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <p className="text-gray-600">
          You are requesting to join <strong>{club?.name}</strong>.
          Your application will be sent to the club advisor and student leadership.
        </p>

        <div>
          <label className="label font-bold">Why would you like to join? (Optional)</label>
          <textarea
            className="input text-xs min-h-16 resize-none"
            placeholder="Mention your interests, skills, or what you hope to achieve in this club…"
            value={joinNotes}
            onChange={(e) => setJoinNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
