import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { ShieldAlert, Sparkles } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import { Badge, Avatar } from "../../../components/ui/index";
import toast from "react-hot-toast";

export default function IssuePenaltyModal({
  open,
  onClose,
  selectedStaff,
  initialForm,
}) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    staffId: "",
    type: "SALARY_DEDUCTION",
    reason: "",
    amount: "500",
    currency: "ETB",
    demeritPoints: "5",
    actionNotes: "",
  });

  const { data: staffList } = useQuery({
    queryKey: ["staff-members-list"],
    queryFn: () => api.get("/staff").then((r) => r.data.data),
    enabled: open && !selectedStaff,
  });

  useEffect(() => {
    if (selectedStaff) {
      setForm((f) => ({
        ...f,
        staffId: selectedStaff.id || selectedStaff.userId || "",
        ...(initialForm || {}),
      }));
    } else if (initialForm) {
      setForm((f) => ({ ...f, ...initialForm }));
    }
  }, [selectedStaff, initialForm, open]);

  const issuePenaltyMutation = useMutation({
    mutationFn: (d) => api.post("/attendance/staff/penalties", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-penalties"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Disciplinary penalty issued successfully!");
      onClose();
      setForm({
        staffId: "",
        type: "SALARY_DEDUCTION",
        reason: "",
        amount: "500",
        currency: "ETB",
        demeritPoints: "5",
        actionNotes: "",
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to issue penalty");
    },
  });

  const effectiveStaffId = selectedStaff?.id || selectedStaff?.userId || form.staffId;

  const handleConfirm = () => {
    if (!effectiveStaffId) {
      toast.error("Please select a staff member");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("Please provide an infraction reason");
      return;
    }
    issuePenaltyMutation.mutate({
      staffId: effectiveStaffId,
      type: form.type,
      reason: form.reason,
      amount: parseFloat(form.amount) || 0,
      currency: form.currency,
      demeritPoints: parseInt(form.demeritPoints, 10) || 0,
      actionNotes: form.actionNotes,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        selectedStaff
          ? `Issue Disciplinary Penalty — ${selectedStaff.firstName} ${selectedStaff.lastName}`
          : "Issue Staff Disciplinary Penalty"
      }
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-danger inline-flex items-center gap-1.5"
            onClick={handleConfirm}
            disabled={
              issuePenaltyMutation.isPending ||
              !form.reason.trim() ||
              !effectiveStaffId
            }
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {issuePenaltyMutation.isPending
              ? "Issuing Penalty…"
              : "Confirm & Apply Penalty"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        {selectedStaff ? (
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar
                name={`${selectedStaff.firstName} ${selectedStaff.lastName}`}
                size="sm"
              />
              <div>
                <span className="font-bold text-gray-900 block">
                  {selectedStaff.firstName} {selectedStaff.lastName}
                </span>
                <span className="text-[10px] text-gray-400">
                  {selectedStaff.email}
                </span>
              </div>
            </div>
            <Badge variant="purple">{selectedStaff.role}</Badge>
          </div>
        ) : (
          <div>
            <label className="label font-bold">Select Staff Member *</label>
            <select
              className="input text-xs"
              value={form.staffId}
              onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
            >
              <option value="">Choose Staff Member…</option>
              {(staffList ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.user?.firstName || s.firstName} {s.user?.lastName || s.lastName} ({s.role || s.user?.role} - {s.user?.email || s.email})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label font-bold">Penalty / Punishment Type *</label>
          <select
            className="input text-xs"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="SALARY_DEDUCTION">
              💰 Salary Deduction (Deduct from payroll)
            </option>
            <option value="WARNING_LETTER">
              ⚠️ Formal Warning Letter (Logged to file)
            </option>
            <option value="DEMERIT_SCORE">
              📉 Demerit Points / Performance Demerit
            </option>
            <option value="LEAVE_DEDUCTION">
              🏖️ Compensatory Leave Day Deduction
            </option>
            <option value="SUSPENSION">
              🚫 Suspension / Temporary Relievement
            </option>
            <option value="CUSTOM">⚖️ Custom Disciplinary Action</option>
          </select>
        </div>

        <div>
          <label className="label font-bold">Reason & Infraction Details *</label>
          <textarea
            className="input text-xs min-h-20 resize-none"
            placeholder="Detail the lateness incidents, unexcused absence dates, or policy breach…"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            required
          />
        </div>

        {form.type === "SALARY_DEDUCTION" && (
          <div className="grid grid-cols-2 gap-2 p-3 bg-rose-50/60 rounded-xl border border-rose-100">
            <div>
              <label className="label font-bold text-rose-900">
                Deduction Amount *
              </label>
              <input
                type="number"
                min="0"
                step="50"
                className="input text-xs font-mono font-bold"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="label font-bold text-rose-900">Currency</label>
              <input
                className="input text-xs font-bold"
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
              />
            </div>
          </div>
        )}

        <div>
          <label className="label font-bold">Demerit Points</label>
          <input
            type="number"
            min="0"
            className="input text-xs font-mono"
            value={form.demeritPoints}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                demeritPoints: e.target.value,
              }))
            }
          />
        </div>

        <div>
          <label className="label font-bold">Action / Admin Remarks</label>
          <input
            className="input text-xs"
            placeholder="e.g. Issued after 3rd late arrival in October."
            value={form.actionNotes}
            onChange={(e) =>
              setForm((f) => ({ ...f, actionNotes: e.target.value }))
            }
          />
        </div>

        <div className="p-2.5 bg-primary-50 rounded-xl text-[11px] text-primary-800 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
          <span>
            An urgent in-app disciplinary notification will automatically be dispatched to this staff member.
          </span>
        </div>
      </div>
    </Modal>
  );
}
