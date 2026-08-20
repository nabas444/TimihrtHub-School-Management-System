import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Plus, DollarSign, Trash2 } from "lucide-react";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, Avatar } from "../../components/ui/index";
import IssuePenaltyModal from "./components/IssuePenaltyModal";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function AttendancePenaltiesPage() {
  const qc = useQueryClient();

  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [selectedStaffForPenalty, setSelectedStaffForPenalty] = useState(null);

  const { data: penaltiesData, isLoading: penaltiesLoading } = useQuery({
    queryKey: ["staff-penalties"],
    queryFn: () => api.get("/attendance/staff/penalties").then((r) => r.data.data),
  });

  const updatePenaltyStatusMutation = useMutation({
    mutationFn: ({ id, ...d }) =>
      api.patch(`/attendance/staff/penalties/${id}/status`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-penalties"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Penalty status updated");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update penalty status");
    },
  });

  const deletePenaltyMutation = useMutation({
    mutationFn: (id) => api.delete(`/attendance/staff/penalties/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-penalties"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Penalty record removed");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to remove penalty");
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Disciplinary Rules & Staff Penalties</h1>
          <p className="page-subtitle">
            Manage school punctuality enforcement policies, salary deductions, and disciplinary records.
          </p>
        </div>
      </div>

      {/* Configured Disciplinary Rules Card */}
      <div className="card p-5 bg-white border border-gray-200 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary-600" />
              School Disciplinary Rules & Penalty Policy
            </h3>
            <p className="text-xs text-gray-500">
              Standard policy thresholds and punishment actions enforced across all faculty and staff.
            </p>
          </div>

          <button
            className="btn-primary inline-flex items-center gap-1.5 text-xs"
            onClick={() => {
              setSelectedStaffForPenalty(null);
              setPenaltyModalOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Issue Disciplinary Penalty
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
            <span className="font-bold text-amber-900 block">
              Rule 1: 1–2 Late Arrivals
            </span>
            <p className="text-amber-800">
              Soft system reminder & attendance notification. No financial penalty.
            </p>
          </div>
          <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs space-y-1">
            <span className="font-bold text-orange-900 block">
              Rule 2: 3–4 Late Arrivals
            </span>
            <p className="text-orange-800">
              Formal Warning Letter issued and demerit points (-5 pts) logged to HR file.
            </p>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs space-y-1">
            <span className="font-bold text-rose-900 block">
              Rule 3: 5+ Lates or Unexcused Absence
            </span>
            <p className="text-rose-800">
              <strong>Salary Deduction</strong> (Half-day rate or custom amount) deducted from monthly payroll.
            </p>
          </div>
        </div>
      </div>

      {/* Disciplinary Penalties Log Table */}
      <div className="card bg-white border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-rose-600" />
            Disciplinary Actions & Salary Deductions Log
          </h3>
        </div>

        {penaltiesLoading ? (
          <PageLoader />
        ) : (penaltiesData ?? []).length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            No disciplinary penalties or deductions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Penalty Type</th>
                  <th className="py-3 px-4">Reason / Infraction</th>
                  <th className="py-3 px-4">Salary Deduction</th>
                  <th className="py-3 px-4">Issued By</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {penaltiesData.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={`${p.staff?.firstName} ${p.staff?.lastName}`}
                          src={p.staff?.avatar}
                          size="xs"
                        />
                        <div>
                          <p className="font-bold text-gray-900">
                            {p.staff?.firstName} {p.staff?.lastName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {p.staff?.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          p.type === "SALARY_DEDUCTION"
                            ? "red"
                            : p.type === "WARNING_LETTER"
                            ? "yellow"
                            : "purple"
                        }
                      >
                        {p.type.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800 max-w-64 truncate">
                      {p.reason}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      {p.amount > 0 ? (
                        <span className="text-rose-700">
                          -{p.amount} {p.currency}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {p.issuedBy?.firstName} {p.issuedBy?.lastName}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono">
                      {new Date(p.effectiveDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          p.status === "APPLIED" &&
                            "bg-amber-50 text-amber-800 border-amber-200",
                          p.status === "DEDUCTED_FROM_PAYROLL" &&
                            "bg-rose-50 text-rose-800 border-rose-200",
                          p.status === "RESOLVED" &&
                            "bg-emerald-50 text-emerald-800 border-emerald-200",
                          p.status === "WAIVED" &&
                            "bg-gray-100 text-gray-600 border-gray-200",
                        )}
                      >
                        {p.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.status === "APPLIED" && (
                          <>
                            <button
                              className="btn-ghost p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Mark as Deducted from Payroll"
                              onClick={() =>
                                updatePenaltyStatusMutation.mutate({
                                  id: p.id,
                                  status: "DEDUCTED_FROM_PAYROLL",
                                  action: "APPLY",
                                })
                              }
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="btn-ghost p-1 text-gray-400 hover:text-gray-600 rounded text-[10px] font-semibold"
                              title="Waive Penalty"
                              onClick={() =>
                                updatePenaltyStatusMutation.mutate({
                                  id: p.id,
                                  status: "WAIVED",
                                  action: "WAIVE",
                                })
                              }
                            >
                              Waive
                            </button>
                          </>
                        )}
                        <button
                          className="btn-ghost p-1 text-gray-300 hover:text-red-600 rounded"
                          title="Delete Record"
                          onClick={() => deletePenaltyMutation.mutate(p.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issue Penalty Modal */}
      <IssuePenaltyModal
        open={penaltyModalOpen}
        onClose={() => {
          setPenaltyModalOpen(false);
          setSelectedStaffForPenalty(null);
        }}
        selectedStaff={selectedStaffForPenalty}
      />
    </div>
  );
}
