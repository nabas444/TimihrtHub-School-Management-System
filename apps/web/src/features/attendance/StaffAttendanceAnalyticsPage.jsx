import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Search, ShieldAlert } from "lucide-react";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, Avatar } from "../../components/ui/index";
import IssuePenaltyModal from "./components/IssuePenaltyModal";
import clsx from "clsx";

export default function StaffAttendanceAnalyticsPage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [staffSearch, setStaffSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [analyticsRange, setAnalyticsRange] = useState({
    startDate: thirtyDaysAgoStr,
    endDate: todayStr,
  });

  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [selectedStaffForPenalty, setSelectedStaffForPenalty] = useState(null);
  const [initialPenaltyForm, setInitialPenaltyForm] = useState(null);

  const { data: staffAnalyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: [
      "staff-punctuality-analytics",
      analyticsRange.startDate,
      analyticsRange.endDate,
      staffSearch,
      activeCategory,
    ],
    queryFn: () =>
      api
        .get(
          `/attendance/staff/analytics?startDate=${
            analyticsRange.startDate
          }&endDate=${analyticsRange.endDate}&search=${encodeURIComponent(
            staffSearch,
          )}&category=${activeCategory}`,
        )
        .then((r) => r.data.data),
  });

  const handleOpenPenaltyForStaff = (staffAssessment) => {
    setSelectedStaffForPenalty(staffAssessment.staff);
    setInitialPenaltyForm({
      type: "SALARY_DEDUCTION",
      reason: `Chronic lateness and punctuality infraction (${staffAssessment.lateDays} late arrivals, ${staffAssessment.totalLateMinutes} total late mins, score: ${staffAssessment.punctualityScore}%).`,
      amount: "500",
      currency: "ETB",
      demeritPoints: "5",
      actionNotes: "Penalty assessed from monthly punctuality analytics.",
    });
    setPenaltyModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Staff Attendance & Punctuality Analytics</h1>
          <p className="page-subtitle">
            Evaluate individual faculty attendance, chronic lateness, and apply salary deductions or disciplinary actions.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 bg-white border border-gray-200">
          <span className="text-xs font-bold text-gray-500 uppercase block">
            Total Late Incidents
          </span>
          <span className="text-2xl font-black text-amber-600">
            {staffAnalyticsData?.overview?.totalLateArrivals ?? 0}
          </span>
        </div>
        <div className="card p-4 bg-white border border-gray-200">
          <span className="text-xs font-bold text-gray-500 uppercase block">
            Unexcused Absences
          </span>
          <span className="text-2xl font-black text-rose-600">
            {staffAnalyticsData?.overview?.totalUnexcusedAbsences ?? 0}
          </span>
        </div>
        <div className="card p-4 bg-white border border-gray-200">
          <span className="text-xs font-bold text-gray-500 uppercase block">
            Total Late Time Lost
          </span>
          <span className="text-2xl font-black text-gray-900">
            {staffAnalyticsData?.overview?.totalLateMinutes ?? 0} mins
          </span>
        </div>
        <div className="card p-4 bg-rose-50 border border-rose-200">
          <span className="text-xs font-bold text-rose-800 uppercase block">
            Flagged for Penalty
          </span>
          <span className="text-2xl font-black text-rose-900">
            {staffAnalyticsData?.overview?.flaggedForPenaltyCount ?? 0}
          </span>
        </div>
      </div>

      {/* Date Range & Search */}
      <div className="card p-4 bg-white border border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div className="flex items-center gap-1 text-xs">
            <span className="font-bold text-gray-700">Assessment Range:</span>
            <input
              type="date"
              className="input text-xs font-bold"
              value={analyticsRange.startDate}
              onChange={(e) =>
                setAnalyticsRange((r) => ({
                  ...r,
                  startDate: e.target.value,
                }))
              }
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              className="input text-xs font-bold"
              value={analyticsRange.endDate}
              onChange={(e) =>
                setAnalyticsRange((r) => ({ ...r, endDate: e.target.value }))
              }
            />
          </div>

          <div className="relative min-w-64 flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              className="input text-xs pl-8"
              placeholder="Filter by name, email, employee ID, specialization…"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Assessment Leaderboard Table */}
      <div className="card bg-white border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary-600" />
              Staff Punctuality & Performance Assessment Report
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Staff attendance standings and disciplinary assessment history.
            </p>
          </div>
        </div>

        {analyticsLoading ? (
          <PageLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Faculty / Staff Member</th>
                  <th className="py-3 px-4">Role & Category</th>
                  <th className="py-3 px-4">Recorded Days</th>
                  <th className="py-3 px-4">Punctuality Score</th>
                  <th className="py-3 px-4">Late Arrivals</th>
                  <th className="py-3 px-4">Total Late Mins</th>
                  <th className="py-3 px-4">Absences</th>
                  <th className="py-3 px-4">Risk Status</th>
                  <th className="py-3 px-4">Penalties Applied</th>
                  <th className="py-3 px-4 text-right">Decision / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(staffAnalyticsData?.staffAssessments ?? []).map((s) => (
                  <tr key={s.staffId} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={`${s.staff?.firstName} ${s.staff?.lastName}`}
                          src={s.staff?.avatar}
                          size="sm"
                        />
                        <div>
                          <p className="font-bold text-gray-900">
                            {s.staff?.firstName} {s.staff?.lastName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Emp ID: {s.employeeId} • {s.staff?.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          s.category === "TEACHER"
                            ? "indigo"
                            : s.category === "FINANCE"
                            ? "green"
                            : "purple"
                        }
                      >
                        {s.category}
                      </Badge>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-32">
                        {s.department}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-gray-700">
                      {s.totalRecordedDays} days
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold">
                      <span
                        className={clsx(
                          s.punctualityScore >= 90
                            ? "text-emerald-700"
                            : s.punctualityScore >= 75
                            ? "text-amber-700"
                            : "text-rose-700",
                        )}
                      >
                        {s.punctualityScore}%
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {s.lateDays > 0 ? (
                        <span className="font-bold text-amber-700">
                          {s.lateDays} times
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {s.totalLateMinutes > 0 ? (
                        <span className="font-bold text-gray-900">
                          {s.totalLateMinutes} mins
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {s.absentDays > 0 ? (
                        <span className="font-bold text-rose-700">
                          {s.absentDays} days
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                          s.riskLevel === "CLEAN" &&
                            "bg-emerald-50 text-emerald-700 border-emerald-200",
                          s.riskLevel === "AT_RISK" &&
                            "bg-amber-50 text-amber-700 border-amber-200",
                          s.riskLevel === "FLAGGED_FOR_PENALTY" &&
                            "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
                        )}
                      >
                        {s.riskLevel === "CLEAN"
                          ? "🟢 Good Standing"
                          : s.riskLevel === "AT_RISK"
                          ? "🟡 At-Risk"
                          : "🔴 Flagged / Disciplinary"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {s.penaltiesCount > 0 ? (
                        <span className="font-bold text-rose-700">
                          {s.penaltiesCount} ({s.totalSalaryDeductions} ETB)
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        className={clsx(
                          "btn-sm text-xs py-1 px-2.5 inline-flex items-center gap-1",
                          s.riskLevel === "FLAGGED_FOR_PENALTY"
                            ? "btn-danger"
                            : "btn-secondary",
                        )}
                        onClick={() => handleOpenPenaltyForStaff(s)}
                      >
                        <ShieldAlert className="w-3 h-3" />
                        Apply Penalty
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Penalty Modal */}
      <IssuePenaltyModal
        open={penaltyModalOpen}
        onClose={() => {
          setPenaltyModalOpen(false);
          setSelectedStaffForPenalty(null);
          setInitialPenaltyForm(null);
        }}
        selectedStaff={selectedStaffForPenalty}
        initialForm={initialPenaltyForm}
      />
    </div>
  );
}
