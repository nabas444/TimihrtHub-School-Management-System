import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";

export default function EditStaffAttendanceModal({
  open,
  onClose,
  record,
  selectedDate,
}) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    status: "PRESENT",
    checkInTime: "08:00",
    checkOutTime: "16:30",
    expectedTime: "08:00",
    lateMinutes: 0,
    notes: "",
  });

  useEffect(() => {
    if (record) {
      setForm({
        status: record.status !== "UNRECORDED" ? record.status : "PRESENT",
        checkInTime: record.checkInTime || "08:00",
        checkOutTime: record.checkOutTime || "16:30",
        expectedTime: record.expectedTime || "08:00",
        lateMinutes: record.lateMinutes || 0,
        notes: record.notes || "",
      });
    }
  }, [record]);

  const recordAttendanceMutation = useMutation({
    mutationFn: (d) => api.post("/attendance/staff", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-attendance-daily"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Staff attendance record saved");
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save attendance");
    },
  });

  const handleSave = () => {
    if (!record) return;
    recordAttendanceMutation.mutate({
      staffId: record.staffId,
      date: selectedDate,
      status: form.status,
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
      expectedTime: form.expectedTime,
      lateMinutes: parseInt(form.lateMinutes, 10) || 0,
      notes: form.notes,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        record
          ? `Record Staff Attendance — ${record.staff?.firstName} ${record.staff?.lastName}`
          : "Record Staff Attendance"
      }
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={handleSave}
            disabled={recordAttendanceMutation.isPending}
          >
            <Save className="w-3.5 h-3.5" />
            {recordAttendanceMutation.isPending ? "Saving…" : "Save Record"}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <div>
          <label className="label font-bold">Attendance Status *</label>
          <select
            className="input text-xs"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="PRESENT">PRESENT (On Time)</option>
            <option value="LATE">LATE (Arrived past expected time)</option>
            <option value="ABSENT">ABSENT (Unexcused)</option>
            <option value="HALF_DAY">HALF DAY</option>
            <option value="ON_LEAVE">ON LEAVE (Authorized)</option>
            <option value="EXCUSED">EXCUSED</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label font-bold">Expected Time</label>
            <input
              type="time"
              className="input text-xs"
              value={form.expectedTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, expectedTime: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label font-bold">Check-In Time</label>
            <input
              type="time"
              className="input text-xs"
              value={form.checkInTime}
              onChange={(e) => {
                const checkIn = e.target.value;
                const [expH, expM] = form.expectedTime.split(":").map(Number);
                const [inH, inM] = checkIn.split(":").map(Number);
                const diff = inH * 60 + inM - (expH * 60 + expM);
                setForm((f) => ({
                  ...f,
                  checkInTime: checkIn,
                  lateMinutes: Math.max(0, diff),
                  status: diff > 0 ? "LATE" : "PRESENT",
                }));
              }}
            />
          </div>
        </div>

        <div>
          <label className="label font-bold">Late by (Minutes)</label>
          <input
            type="number"
            min="0"
            className="input text-xs font-mono"
            value={form.lateMinutes}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                lateMinutes: parseInt(e.target.value, 10) || 0,
              }))
            }
          />
        </div>

        <div>
          <label className="label font-bold">Inconvenience / Reason Notes</label>
          <textarea
            className="input text-xs min-h-16 resize-none"
            placeholder="e.g. Heavy traffic, medical appointment, car breakdown…"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}
