import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import Modal from "../../../components/ui/Modal";
import { CLUB_CATEGORIES } from "../clubConstants";
import toast from "react-hot-toast";

export default function ProposeClubModal({ open, onClose }) {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    description: "",
    purpose: "",
    category: "SCIENCE",
    academicYear: "2025/2026",
    advisorId: "",
    expectedMembership: 25,
    preferredMeetingSchedule: "Every Wednesday 4:00 PM - 5:00 PM",
    meetingLocation: "Science Lab 2",
    logoUrl: "",
    bannerUrl: "",
  });

  const { data: facultyCandidates, isLoading: facultyLoading } = useQuery({
    queryKey: ["club-faculty-candidates"],
    queryFn: () => api.get("/clubs/faculty-candidates").then((r) => r.data.data || []),
    enabled: open,
  });

  const proposeMutation = useMutation({
    mutationFn: (d) => api.post("/clubs", d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["clubs"] });
      qc.invalidateQueries({ queryKey: ["my-clubs"] });
      qc.invalidateQueries({ queryKey: ["pending-clubs"] });
      toast.success(
        isAdmin()
          ? "Club created and launched successfully!"
          : "Club proposal submitted to administration for review!",
      );
      onClose();
      setForm({
        name: "",
        description: "",
        purpose: "",
        category: "SCIENCE",
        academicYear: "2025/2026",
        advisorId: "",
        expectedMembership: 25,
        preferredMeetingSchedule: "Every Wednesday 4:00 PM - 5:00 PM",
        meetingLocation: "Science Lab 2",
        logoUrl: "",
        bannerUrl: "",
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit club proposal");
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAdmin() ? "Create New School Club" : "Propose New Extracurricular Club"}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={() => proposeMutation.mutate(form)}
            disabled={
              proposeMutation.isPending ||
              !form.name.trim() ||
              !form.purpose.trim()
            }
          >
            <Sparkles className="w-3.5 h-3.5" />
            {proposeMutation.isPending
              ? "Submitting…"
              : isAdmin()
              ? "Create & Launch Club"
              : "Submit Proposal"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <div>
          <label className="label font-bold">Club Name *</label>
          <input
            className="input text-xs"
            placeholder="e.g. Robotics & AI Club, Debate Society, Eco Warriors"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label font-bold">Category *</label>
            <select
              className="input text-xs"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            >
              {CLUB_CATEGORIES.filter((c) => c.id !== "ALL").map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label font-bold">Academic Year *</label>
            <input
              className="input text-xs"
              value={form.academicYear}
              onChange={(e) =>
                setForm((f) => ({ ...f, academicYear: e.target.value }))
              }
            />
          </div>
        </div>

        <div>
          <label className="label font-bold">Mission, Purpose & Goals *</label>
          <textarea
            className="input text-xs min-h-16 resize-none"
            placeholder="Describe the club's objectives, student learning outcomes, and intended activities…"
            value={form.purpose}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                purpose: e.target.value,
                description: e.target.value,
              }))
            }
            required
          />
        </div>

        <div>
          <label className="label font-bold">Faculty / Staff Advisor</label>
          <select
            className="input text-xs"
            value={form.advisorId}
            onChange={(e) =>
              setForm((f) => ({ ...f, advisorId: e.target.value }))
            }
          >
            <option value="">Select Faculty / Staff Advisor</option>
            {(facultyCandidates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName} — {t.role} ({t.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label font-bold">Meeting Schedule</label>
            <input
              className="input text-xs"
              placeholder="e.g. Every Thursday 4:00 PM"
              value={form.preferredMeetingSchedule}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  preferredMeetingSchedule: e.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="label font-bold">Meeting Room / Location</label>
            <input
              className="input text-xs"
              placeholder="e.g. Lab 2, Library Hall"
              value={form.meetingLocation}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  meetingLocation: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="p-2.5 bg-primary-50 rounded-xl text-[11px] text-primary-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <span>
            {isAdmin()
              ? "As an administrator, this club will immediately be published as ACTIVE."
              : "Your club proposal will be sent to the school administration for review."}
          </span>
        </div>
      </div>
    </Modal>
  );
}
