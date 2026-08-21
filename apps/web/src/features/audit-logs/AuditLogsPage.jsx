import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  User,
  Shield,
  Activity,
  Globe,
  Info,
  Clock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  KeyRound,
  FileSpreadsheet,
  Coins,
  Settings as SettingsIcon,
  GraduationCap,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState, Pagination, PageLoader } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import { format } from "date-fns";

const ACTION_OPTIONS = [
  { value: "ALL", label: "All Actions" },
  { value: "LOGIN_SUCCESS", label: "Login Success" },
  { value: "LOGIN_FAILED", label: "Login Failed" },
  { value: "LOGOUT", label: "Logout" },
  { value: "PASSWORD_CHANGED", label: "Password Changed" },
  { value: "MFA_ENABLED", label: "MFA Enabled" },
  { value: "MFA_DISABLED", label: "MFA Disabled" },
  { value: "GOOGLE_ACCOUNT_LINKED", label: "Google Account Linked" },
  { value: "GOOGLE_SIGNIN_BLOCKED_ADMIN", label: "Google Sign-In Blocked (Admin)" },
  { value: "FEE_RECORD_CREATED", label: "Fee Record Created" },
  { value: "FEE_RECORD_UPDATED", label: "Fee Record Updated" },
  { value: "PAYROLL_UPDATED", label: "Payroll Updated" },
  { value: "SCHOOL_SETTINGS_UPDATED", label: "School Settings Updated" },
  { value: "USER_CREATED", label: "User Created" },
  { value: "USER_ACTIVATED", label: "User Activated" },
  { value: "USER_DEACTIVATED", label: "User Deactivated" },
  { value: "GRADE_RESULT_UPDATED", label: "Grade / Result Updated" },
];

function getActionBadge(action) {
  switch (action) {
    case "LOGIN_SUCCESS":
    case "GOOGLE_ACCOUNT_LINKED":
    case "USER_ACTIVATED":
    case "MFA_ENABLED":
      return { variant: "green", icon: CheckCircle2 };
    case "LOGIN_FAILED":
    case "GOOGLE_SIGNIN_BLOCKED_ADMIN":
    case "USER_DEACTIVATED":
    case "MFA_DISABLED":
      return { variant: "red", icon: XCircle };
    case "LOGOUT":
    case "PASSWORD_CHANGED":
      return { variant: "yellow", icon: KeyRound };
    case "FEE_RECORD_CREATED":
    case "FEE_RECORD_UPDATED":
      return { variant: "primary", icon: Coins };
    case "PAYROLL_UPDATED":
      return { variant: "purple", icon: FileSpreadsheet };
    case "SCHOOL_SETTINGS_UPDATED":
      return { variant: "blue", icon: SettingsIcon };
    case "USER_CREATED":
      return { variant: "blue", icon: User };
    case "GRADE_RESULT_UPDATED":
      return { variant: "blue", icon: GraduationCap };
    default:
      return { variant: "gray", icon: Activity };
  }
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [actorSearch, setActorSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  // Fetch users for actor dropdown / filter
  const { data: usersData } = useQuery({
    queryKey: ["audit-log-users"],
    queryFn: () => api.get("/users?limit=200").then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const queryParams = useMemo(() => {
    const p = { page, limit: 20 };
    if (actionFilter && actionFilter !== "ALL") p.action = actionFilter;
    if (actorSearch && actorSearch !== "ALL") p.actorId = actorSearch;
    if (startDate) {
      p.startDate = new Date(startDate).toISOString();
    }
    if (endDate) {
      p.endDate = new Date(`${endDate}T23:59:59.999Z`).toISOString();
    }
    return p;
  }, [page, actionFilter, actorSearch, startDate, endDate]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", queryParams],
    queryFn: () => api.get("/audit-logs", { params: queryParams }).then((r) => r.data.data),
    keepPreviousData: true,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleResetFilters = () => {
    setActionFilter("ALL");
    setActorSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const hasActiveFilters =
    actionFilter !== "ALL" || actorSearch !== "" || startDate !== "" || endDate !== "";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-primary-600" />
            <h1 className="page-title">Audit Logs</h1>
          </div>
          <p className="page-subtitle">
            Track security events and sensitive administrative changes across the school
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Tenant Isolated &amp; Tamper-Evident</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filters
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium transition"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action Filter */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Action Type</label>
            <select
              className="input text-sm py-1.5"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Select / Search */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Actor</label>
            <select
              className="input text-sm py-1.5"
              value={actorSearch}
              onChange={(e) => {
                setActorSearch(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Actors</option>
              {usersData?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email}) — {u.role}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date</label>
            <div className="relative">
              <input
                type="date"
                className="input text-sm py-1.5"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">End Date</label>
            <div className="relative">
              <input
                type="date"
                className="input text-sm py-1.5"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table / Results */}
      {isLoading ? (
        <PageLoader />
      ) : logs.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={ScrollText}
            title="No audit log entries found"
            description={
              hasActiveFilters
                ? "No entries matched your active filters. Try adjusting or clearing your search criteria."
                : "No sensitive events have been recorded in your school audit log yet."
            }
            action={
              hasActiveFilters
                ? {
                    label: "Clear Filters",
                    onClick: handleResetFilters,
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Target</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((log) => {
                  const badgeInfo = getActionBadge(log.action);
                  const Icon = badgeInfo.icon;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 cursor-pointer transition"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-mono text-xs">
                            {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                          </span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {log.actorEmail || <span className="text-gray-400 italic">System / Unknown</span>}
                          </div>
                          {log.actorRole && (
                            <span className="text-[11px] text-gray-500 font-mono">
                              {log.actorRole}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant={badgeInfo.variant}>
                          <span className="inline-flex items-center gap-1">
                            <Icon className="w-3 h-3" />
                            {log.action}
                          </span>
                        </Badge>
                      </td>

                      {/* Target */}
                      <td className="py-3.5 px-4 text-xs font-mono text-gray-600 dark:text-gray-300">
                        {log.targetType ? (
                          <div>
                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                              {log.targetType}
                            </span>
                            {log.targetId && (
                              <span className="text-gray-400 block text-[11px]">
                                ID: {log.targetId.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* IP Address */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-gray-500">
                        {log.ipAddress ? (
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-gray-400" />
                            <span>{log.ipAddress}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Details View Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-gray-500 hover:text-primary-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-gray-500">
              Showing <strong>{logs.length}</strong> of <strong>{total}</strong> log entries
            </span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <Modal
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Audit Log Event Details"
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl text-sm">
              <div>
                <span className="text-xs text-gray-500 block">Action</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100 font-mono">
                  {selectedLog.action}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Timestamp</span>
                <span className="text-gray-700 dark:text-gray-200 font-mono text-xs">
                  {format(new Date(selectedLog.createdAt), "EEEE, MMMM d, yyyy 'at' HH:mm:ss (zzzz)")}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Actor Email</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {selectedLog.actorEmail || "Unknown / System"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Actor Role</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {selectedLog.actorRole || "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Actor ID</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                  {selectedLog.actorId || "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">School ID</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                  {selectedLog.schoolId}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Target Type &amp; ID</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                  {selectedLog.targetType ? `${selectedLog.targetType} (${selectedLog.targetId || "N/A"})` : "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Client IP Address</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                  {selectedLog.ipAddress || "—"}
                </span>
              </div>
            </div>

            {selectedLog.userAgent && (
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-1">User Agent</span>
                <div className="bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 break-all">
                  {selectedLog.userAgent}
                </div>
              </div>
            )}

            <div>
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                Metadata Context (JSON)
              </span>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                <pre className="bg-gray-900 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl text-xs text-gray-400 italic">
                  No additional metadata provided for this event.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setSelectedLog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
