import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart3, CalendarCheck, Download, Plus } from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import AttendanceTrendChart from "../../components/charts/AttendanceTrendChart";
import AttendanceSheetDownload from "./components/AttendanceSheetDownload";
import clsx from "clsx";

export default function StudentAttendanceReportsPage() {
  const { isTeacher, isAdmin } = useAuthStore();

  const { data: deadlinesSummary } = useQuery({
    queryKey: ["deadlines-summary"],
    queryFn: () => api.get("/deadlines/summary").then((r) => r.data.data),
    enabled: isAdmin(),
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Student Attendance Reports & Analytics</h1>
          <p className="page-subtitle">
            Review school-wide student attendance trends, class submission compliance, and export printable PDF attendance sheets.
          </p>
        </div>

        {isTeacher() && (
          <div className="flex items-center gap-2">
            <Link to="/attendance/mark" className="btn-primary">
              <Plus className="w-4 h-4" /> Mark Class Attendance
            </Link>
          </div>
        )}
      </div>

      {/* Informational Banner */}
      <div className="p-4 bg-primary-50/70 border border-primary-100 rounded-2xl flex items-start gap-3">
        <BarChart3 className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-extrabold text-xs text-primary-900">
            Student Attendance Reports & Analytics
          </h3>
          <p className="text-xs text-primary-800 mt-0.5 leading-relaxed">
            Student daily attendance is taken directly by assigned teachers for their respective classes. View real-time class attendance completion status, trend charts, and download full attendance report sheets below.
          </p>
        </div>
      </div>

      {/* Today's Teacher Attendance Submission Compliance (Admin Only) */}
      {isAdmin() && deadlinesSummary?.summary?.attendance && (
        <div className="card p-5 bg-white border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-primary-600" />
              Today's Teacher Class Attendance Submissions
            </h4>
            <span className="text-[11px] text-gray-500 font-semibold">
              Reported:{" "}
              <strong className="text-emerald-700">
                {deadlinesSummary.summary.attendance.markedPeriods ?? 0}
              </strong>{" "}
              / {deadlinesSummary.summary.attendance.totalPeriods ?? 0} Periods
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl text-xs">
            {(deadlinesSummary.summary.attendance.items ?? []).map((item) => (
              <div key={item.id} className="p-2.5 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-gray-900">
                    Class {item.className} • {item.subjectName}
                  </span>
                  <p className="text-[10px] text-gray-500">
                    Teacher: <strong className="text-gray-700">{item.teacherName}</strong> • Period: {item.startTime} to {item.cutoffTime}
                  </p>
                </div>
                <span
                  className={clsx(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    item.status === "COMPLETED" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                    item.status === "OVERDUE" && "bg-rose-50 text-rose-700 border-rose-200",
                    item.status === "APPROACHING" && "bg-amber-50 text-amber-700 border-amber-200",
                    item.status === "SCHEDULED" && "bg-gray-50 text-gray-600 border-gray-200"
                  )}
                >
                  {item.status === "COMPLETED"
                    ? "✓ Submitted by Teacher"
                    : item.status === "OVERDUE"
                    ? "🔴 Overdue"
                    : item.status === "APPROACHING"
                    ? "🟡 Window Active"
                    : "Scheduled"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance Trend Chart */}
      <AttendanceTrendChart />

      {/* Printable Attendance Sheet Generator */}
      <div className="space-y-2">
        <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
          <Download className="w-4 h-4 text-primary-600" />
          Download Class Attendance Reports (PDF)
        </h4>
        <AttendanceSheetDownload />
      </div>
    </div>
  );
}
