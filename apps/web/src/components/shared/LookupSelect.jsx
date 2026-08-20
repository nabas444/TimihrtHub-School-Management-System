import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Check } from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import Modal from "../ui/Modal";
import toast from "react-hot-toast";

const HOUSE_DEFAULT_COLORS = [
  "#EF4444", // Red
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#D97706", // Gold
];

export default function LookupSelect({
  type,
  value,
  onChange,
  label,
  placeholder = "— Select —",
  disabled = false,
  className = "",
}) {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [newColorHex, setNewColorHex] = useState("#3B82F6");

  const isHouse = type === "HOUSE";

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["lookup-values", type],
    queryFn: () =>
      api.get(`/lookup-values?type=${type}`).then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/lookup-values", payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["lookup-values", type] });
      const created = res.data.data;
      if (created?.id) {
        onChange(created.id);
      }
      toast.success(`${label || type} added successfully`);
      setModalOpen(false);
      setNewValue("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to add lookup value");
    },
  });

  const handleCreate = (e) => {
    e?.preventDefault();
    if (!newValue.trim()) return;
    createMutation.mutate({
      type,
      value: newValue.trim(),
      colorHex: isHouse ? newColorHex : null,
    });
  };

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="label font-bold text-xs text-gray-700 m-0">
            {label}
          </label>
          {isAdmin() && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-[11px] font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> New
            </button>
          )}
        </div>
      )}

      <div className="relative flex items-center">
        <select
          className="input text-xs pr-8"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isLoading}
        >
          <option value="">{isLoading ? "Loading…" : placeholder}</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.value} {opt.colorHex ? `(${opt.colorHex})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Mini Create Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Add New ${label || type}`}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary text-xs inline-flex items-center gap-1"
              onClick={handleCreate}
              disabled={createMutation.isPending || !newValue.trim()}
            >
              {createMutation.isPending ? "Saving…" : "Add Value"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Value / Name *</label>
            <input
              className="input text-xs"
              placeholder={`Enter ${label || "value"}…`}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              autoFocus
              required
            />
          </div>

          {isHouse && (
            <div>
              <label className="label font-bold">House Color Theme</label>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {HOUSE_DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColorHex(c)}
                    className="w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center"
                    style={{
                      backgroundColor: c,
                      borderColor: newColorHex === c ? "#111827" : "transparent",
                    }}
                  >
                    {newColorHex === c && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="w-7 h-7 rounded border border-gray-300 cursor-pointer"
                  title="Custom Color"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
