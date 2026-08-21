import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Download, Search, CheckCircle2, Clock, Users } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import PageLoader from "../../../components/ui/PageLoader";
import { Badge, EmptyState } from "../../../components/ui/index";

export default function AcknowledgmentReportModal({ open, onClose, policyId }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const { data: report, isLoading } = useQuery({
    queryKey: ["policy-ack-report", policyId],
    queryFn: () => api.get(`/policies/${policyId}/acknowledgment-report`).then((r) => r.data.data),
    enabled: open && !!policyId,
  });

  const summary = report?.summary || { total: 0, acknowledged: 0, outstanding: 0, completionPercent: 0 };
  const recipients = report?.recipients || [];

  const filteredRecipients = recipients.filter((r) => {
    const matchSearch =
      !search ||
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "ALL" ||
      (filterStatus === "ACKNOWLEDGED" && r.isAcknowledged) ||
      (filterStatus === "OUTSTANDING" && !r.isAcknowledged);
    return matchSearch && matchStatus;
  });

  const handleExportCsv = () => {
    if (!recipients.length) return;
    const headers = ["Name", "Email", "Role", "Status", "Acknowledged At", "Version"];
    const rows = recipients.map((r) => [
      `"${r.firstName} ${r.lastName}"`,
      `"${r.email}"`,
      `"${r.role}"`,
      r.isAcknowledged ? "Acknowledged" : "Outstanding",
      r.acknowledgedAt ? `"${new Date(r.acknowledgedAt).toLocaleString()}"` : "—",
      `"v${r.versionNumber || "1.0"}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `policy-acknowledgment-report-${policyId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Acknowledgment Audit Report — ${report?.policy?.title || "Policy"}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            className="btn-secondary btn-sm inline-flex items-center gap-1.5"
            onClick={handleExportCsv}
            disabled={!recipients.length}
          >
            <Download className="w-3.5 h-3.5" /> Export Audit CSV
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={onClose}>
            Close Report
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-500 text-[11px] block">Completion Rate</span>
                <span className="text-lg font-extrabold text-primary-700">
                  {summary.completionPercent}%
                </span>
              </div>
              <div>
                <span className="text-gray-500 text-[11px] block">Targeted Staff/Users</span>
                <span className="text-lg font-extrabold text-gray-900">{summary.total}</span>
              </div>
              <div>
                <span className="text-gray-500 text-[11px] block">Acknowledged</span>
                <span className="text-lg font-extrabold text-emerald-600">{summary.acknowledged}</span>
              </div>
              <div>
                <span className="text-gray-500 text-[11px] block">Outstanding</span>
                <span className="text-lg font-extrabold text-amber-600">{summary.outstanding}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="h-2.5 w-full bg-gray-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${summary.completionPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                <span>{summary.acknowledged} Confirmed</span>
                <span>{summary.outstanding} Pending</span>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  className="input text-xs pl-8 w-full"
                  placeholder="Search recipients by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="input text-xs w-36"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All ({recipients.length})</option>
                <option value="ACKNOWLEDGED">Acknowledged ({summary.acknowledged})</option>
                <option value="OUTSTANDING">Outstanding ({summary.outstanding})</option>
              </select>
            </div>

            {/* Recipients Table */}
            <div className="table-wrapper max-h-60 overflow-y-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Acknowledged Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-gray-400">
                        No matching recipients found.
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="font-bold text-gray-900">
                            {r.firstName} {r.lastName}
                          </div>
                          <div className="text-[11px] text-gray-400">{r.email}</div>
                        </td>
                        <td>
                          <Badge variant="gray">{r.role}</Badge>
                        </td>
                        <td>
                          {r.isAcknowledged ? (
                            <Badge variant="green">Confirmed</Badge>
                          ) : (
                            <Badge variant="yellow">Outstanding</Badge>
                          )}
                        </td>
                        <td className="text-gray-500 text-[11px]">
                          {r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
