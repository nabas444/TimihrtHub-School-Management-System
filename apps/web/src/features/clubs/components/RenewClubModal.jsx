import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";

export default function RenewClubModal({ open, onClose, club }) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    newAcademicYear: "2026/2027",
    newAdvisorId: "",
    newPresidentId: "",
    updatedPurpose: "",
    meetingSchedule: "",
  });

  const { data: facultyCandidates } = useQuery({
    queryKey: ["club-faculty-candidates"],
    queryFn: () => api.get("/clubs/faculty-candidates").then((r) => r.data.data || []),
    enabled: open,
  });

  useEffect(() => {
    if (club) {
      setForm({
        newAcademicYear: "2026/2027",
        newAdvisorId: club.advisor?.id || "",
        newPresidentId: "",
        updatedPurpose: club.purpose || "",
        meetingSchedule: club.preferredMeetingSchedule || "",
      });
    }
  }, [club]);

  const renewMutation = useMutation({
    mutationFn: (d) => api.post(`/clubs/${d.clubId}/renew`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clubs"] });
      qc.invalidateQueries({ queryKey: ["my-clubs"] });
      toast.success("Club academic year renewal complete!");
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to renew club");
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Renew Club — ${club?.name}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={() =>
              renewMutation.mutate({
                clubId: club?.id,
                ...form,
              })
            }
            disabled={renewMutation.isPending || !form.newAcademicYear.trim()}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {renewMutation.isPending ? "Renewing…" : "Confirm Renewal"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <p className="text-gray-600">
          Renewing will advance <strong>{club?.name}</strong> into the new academic year while preserving all past leadership, event, and activity records.
        </p>

        <div>
          <label className="label font-bold">New Academic Year *</label>
          <input
            className="input text-xs"
            value={form.newAcademicYear}
            onChange={(e) =>
              setForm((f) => ({ ...f, newAcademicYear: e.target.value }))
            }
            required
          />
        </div>

        <div>
          <label className="label font-bold">Faculty Advisor</label>
          <select
            className="input text-xs"
            value={form.newAdvisorId}
            onChange={(e) =>
              setForm((f) => ({ ...f, newAdvisorId: e.target.value }))
            }
          >
            <option value="">Keep current / Assign Advisor</option>
            {(facultyCandidates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName} — {t.role} ({t.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label font-bold">Meeting Schedule</label>
          <input
            className="input text-xs"
            value={form.meetingSchedule}
            onChange={(e) =>
              setForm((f) => ({ ...f, meetingSchedule: e.target.value }))
            }
            placeholder="e.g. Every Wednesday 4:00 PM"
          />
        </div>
      </div>
    </Modal>
  );
}
