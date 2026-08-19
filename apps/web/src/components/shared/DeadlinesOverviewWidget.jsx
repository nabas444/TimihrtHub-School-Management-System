import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  CalendarCheck,
  Award,
  BookOpen,
  Users,
  RefreshCw,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { formatInSchoolTimezone } from "../../lib/deadlines";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function DeadlinesOverviewWidget() {
  const { user, isAdmin, isTeacher, isStudent, isParent } = useAuthStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("ATTENDANCE"); // For Admin: "ATTENDANCE" | "ASSIGNMENTS" | "EXAMS"

  const { data: summaryData, isLoading, refetch } = useQuery({
    queryKey: ["deadlines-summary"],
    queryFn: () => api.get("/deadlines/summary").then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const runCheckMutation = useMutation({
    mutationFn: () => api.post("/deadlines/run-check"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deadlines-summary"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Deadline evaluation check completed");
    },
  });

  if (isLoading) {
    return (
      <div className="card p-5 bg-white animate-pulse space-y-3">
        <div className="h-5 bg-gray-200 rounded w-1/3" />
        <div className="h-20 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  const timezone = summaryData?.timezone || user?.school?.timezone || "Africa/Addis_Ababa";
  const windowMinutes = summaryData?.windowMinutes || summaryData?.summary?.attendance?.windowMinutes || 15;
  const summary = summaryData?.summary;

  // ══════════════════════════════════════════════════════════════════════════
  // 1. ADMIN MONITOR
  // ══════════════════════════════════════════════════════════════════════════
  if (isAdmin()) {
    const att = summary?.attendance;
    const asg = summary?.assignments;
    const exm = summary?.exams;

    return (
      <div className="card p-5 bg-white border border-gray-200 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary-600" />
              Deadlines & Compliance Monitor
            </h3>
            <p className="text-[11px] text-gray-500">
              School Timezone: <strong className="text-gray-700">{timezone}</strong> • Policy:{" "}
              <strong className="text-primary-700">Per-Period Window ({windowMinutes} mins from start)</strong>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => runCheckMutation.mutate()}
              disabled={runCheckMutation.isPending}
              className="btn-ghost btn-sm text-[11px] inline-flex items-center gap-1 text-gray-500 hover:text-primary-600 p-1"
              title="Run instant deadline check"
            >
              <RefreshCw className={clsx("w-3 h-3", runCheckMutation.isPending && "animate-spin")} />
              Sync
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 border-b border-gray-100 pb-2 text-xs">
          <button
            onClick={() => setActiveTab("ATTENDANCE")}
            className={clsx(
              "px-3 py-1 rounded-xl font-bold transition-all",
              activeTab === "ATTENDANCE"
                ? "bg-primary-50 text-primary-700 border border-primary-200"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            Today's Attendance ({att?.markedPeriods ?? 0}/{att?.totalPeriods ?? 0} Periods)
          </button>
          <button
            onClick={() => setActiveTab("ASSIGNMENTS")}
            className={clsx(
              "px-3 py-1 rounded-xl font-bold transition-all",
              activeTab === "ASSIGNMENTS"
                ? "bg-primary-50 text-primary-700 border border-primary-200"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            Assignments ({asg?.overdueCount ?? 0} Overdue)
          </button>
          <button
            onClick={() => setActiveTab("EXAMS")}
            className={clsx(
              "px-3 py-1 rounded-xl font-bold transition-all",
              activeTab === "EXAMS"
                ? "bg-primary-50 text-primary-700 border border-primary-200"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            Exam Marks ({exm?.pendingResultsCount ?? 0} Pending)
          </button>
        </div>

        {/* Tab 1: Attendance Compliance */}
        {activeTab === "ATTENDANCE" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-xs">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Reported On Time</span>
                <span className="text-base font-extrabold text-emerald-900">{att?.markedPeriods ?? 0} Periods</span>
              </div>
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100 text-xs">
                <span className="text-[10px] font-bold text-rose-800 uppercase block">Unmarked / Overdue</span>
                <span className="text-base font-extrabold text-rose-900">{att?.unmarkedPeriods ?? 0} Periods</span>
              </div>
              <div className="p-2.5 bg-primary-50/70 rounded-xl border border-primary-100 text-xs col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-primary-800 uppercase block">Window Policy</span>
                <span className="text-xs font-bold text-primary-900">
                  {windowMinutes} mins from period start
                </span>
              </div>
            </div>

            {/* List of timetable period attendance slots */}
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl text-xs">
              {(att?.items ?? []).length === 0 ? (
                <div className="p-4 text-center text-gray-400">No teaching periods scheduled for today.</div>
              ) : (
                (att?.items ?? []).map((item) => (
                  <div key={item.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-gray-900">
                        Class {item.className} • {item.subjectName}
                      </span>
                      <p className="text-[11px] text-gray-500">
                        Period: {item.startTime}{item.endTime ? ` - ${item.endTime}` : ""} • Window:{" "}
                        <strong className="text-gray-700">{item.startTime} to {item.cutoffTime}</strong> • Teacher: {item.teacherName}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap",
                        item.status === "COMPLETED" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        item.status === "OVERDUE" && "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
                        item.status === "APPROACHING" && "bg-amber-50 text-amber-700 border-amber-200",
                        item.status === "SCHEDULED" && "bg-gray-50 text-gray-600 border-gray-200"
                      )}
                    >
                      {item.status === "COMPLETED"
                        ? "✓ Submitted"
                        : item.status === "OVERDUE"
                        ? "🔴 Overdue"
                        : item.status === "APPROACHING"
                        ? `🟡 Window Active (Due ${item.cutoffTime})`
                        : `Scheduled (${item.startTime})`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Assignments Overdue & Deadlines */}
        {activeTab === "ASSIGNMENTS" && (
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl text-xs">
            {(asg?.items ?? []).length === 0 ? (
              <div className="p-6 text-center text-gray-400">No active assignments found.</div>
            ) : (
              (asg?.items ?? []).slice(0, 10).map((a) => (
                <div key={a.id} className="p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link to={`/assignments/${a.id}`} className="font-bold text-gray-900 hover:text-primary-600 block truncate">
                      {a.title}
                    </Link>
                    <span className="text-[10px] text-gray-400">
                      {a.subjectName} • {a.className} • By {a.teacherName}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                      a.status === "HEALTHY" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                      a.status === "APPROACHING" && "bg-amber-50 text-amber-700 border-amber-200",
                      a.status === "URGENT" && "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
                      a.status === "OVERDUE" && "bg-red-100 text-red-800 border-red-300 font-extrabold"
                    )}
                  >
                    {a.humanCountdown}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Exams & Result Submission Compliance */}
        {activeTab === "EXAMS" && (
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl text-xs">
            {(exm?.items ?? []).length === 0 ? (
              <div className="p-6 text-center text-gray-400">No recent completed exams.</div>
            ) : (
              (exm?.items ?? []).map((e) => (
                <div key={e.examId} className="p-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-gray-900 block">{e.title}</span>
                    <span className="text-[10px] text-gray-400">
                      {e.subjectName} • {e.className}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      e.isSubmitted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                    )}
                  >
                    {e.isSubmitted ? `✓ ${e.resultsCount} Marks Entered` : "🔴 Results Pending"}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. TEACHER TASKS MONITOR
  // ══════════════════════════════════════════════════════════════════════════
  if (isTeacher()) {
    const attendanceTasks = summary?.attendanceTasks || [];
    const assignments = summary?.assignments || [];

    return (
      <div className="card p-5 bg-white border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-primary-600" />
              Today's Teaching Periods & Attendance
            </h3>
            <p className="text-[11px] text-gray-500">
              Reporting Window: <strong className="text-gray-700">{windowMinutes} minutes</strong> from period start ({timezone})
            </p>
          </div>
          <span className="text-[10px] text-primary-700 font-bold bg-primary-50 px-2 py-0.5 rounded-md border border-primary-100">
            Per-Period Policy
          </span>
        </div>

        {/* Assigned class / timetable periods attendance */}
        <div className="space-y-2">
          {attendanceTasks.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No teaching periods scheduled for today.</p>
          ) : (
            attendanceTasks.map((t) => (
              <div
                key={t.id}
                className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs gap-3"
              >
                <div className="min-w-0">
                  <span className="font-bold text-gray-900 block">
                    Class {t.className} {t.subjectName ? `• ${t.subjectName}` : ""}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Period: {t.startTime}{t.endTime ? ` - ${t.endTime}` : ""} • Report window:{" "}
                    <strong className="text-gray-700">{t.startTime} to {t.cutoffTime}</strong>
                  </span>
                </div>
                {t.isMarked ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                    ✓ Submitted
                  </span>
                ) : (
                  <Link
                    to="/attendance/mark"
                    className="btn-primary btn-sm text-[10px] py-1 px-2.5 inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    Mark Attendance
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. STUDENT TASKS MONITOR
  // ══════════════════════════════════════════════════════════════════════════
  if (isStudent()) {
    const items = summary?.items || [];
    const pendingCount = summary?.pendingCount || 0;
    const overdueCount = summary?.overdueCount || 0;

    return (
      <div className="card p-5 bg-white border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-primary-600" />
              Your Academic Deadlines
            </h3>
            <p className="text-[11px] text-gray-500">
              {pendingCount} pending task{pendingCount !== 1 ? "s" : ""} •{" "}
              {overdueCount > 0 && (
                <strong className="text-rose-600 font-bold">{overdueCount} Overdue</strong>
              )}
            </p>
          </div>
          <Link to="/assignments" className="text-xs text-primary-600 font-bold hover:underline inline-flex items-center gap-0.5">
            All Assignments <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No assignments due right now. You're all caught up! 🎉</p>
          ) : (
            items.slice(0, 5).map((a) => (
              <div
                key={a.id}
                className="p-2.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl border border-gray-200 flex items-center justify-between gap-2 text-xs transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <Link to={`/assignments/${a.id}`} className="font-bold text-gray-900 hover:text-primary-600 block truncate">
                    {a.title}
                  </Link>
                  <span className="text-[10px] text-gray-400">
                    {a.subjectName} • Due: {a.formattedDueDate}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                      a.isSubmitted
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : a.deadlineStatus === "OVERDUE"
                        ? "bg-red-100 text-red-800 border-red-300 font-extrabold"
                        : a.deadlineStatus === "URGENT"
                        ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                        : a.deadlineStatus === "APPROACHING"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}
                  >
                    {a.isSubmitted ? "✓ Submitted" : a.humanCountdown}
                  </span>

                  {!a.isSubmitted && (
                    <Link to={`/assignments/${a.id}`} className="btn-primary btn-sm text-[10px] py-1 px-2">
                      Submit
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. PARENT MONITOR
  // ══════════════════════════════════════════════════════════════════════════
  if (isParent()) {
    const children = summaryData?.children || [];

    return (
      <div className="card p-5 bg-white border border-gray-200 shadow-xs space-y-4">
        <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary-600" />
          Children's Homework & Assignment Status
        </h3>

        <div className="space-y-4">
          {children.length === 0 ? (
            <p className="text-xs text-gray-400">No linked student records.</p>
          ) : (
            children.map((child) => (
              <div key={child.studentId} className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-900">
                    {child.studentName} ({child.className})
                  </span>
                  {child.overdueCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      ⚠️ {child.overdueCount} Overdue
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ✓ All Caught Up
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {child.tasks.slice(0, 3).map((t) => (
                    <div key={t.id} className="p-2 bg-white rounded-lg border border-gray-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-gray-800 block truncate">{t.title}</span>
                        <span className="text-[10px] text-gray-400">{t.subjectName} • Due: {t.formattedDueDate}</span>
                      </div>
                      <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold", t.isSubmitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                        {t.isSubmitted ? "Submitted" : t.humanCountdown}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return null;
}
