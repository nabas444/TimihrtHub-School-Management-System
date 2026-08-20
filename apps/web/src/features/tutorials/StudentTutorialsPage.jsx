import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  BookOpen,
  User,
  Sparkles,
  ArrowRight,
  LogOut,
} from "lucide-react";
import api from "../../lib/api";
import {
  Avatar,
  Badge,
  EmptyState,
  PageLoader,
} from "../../components/ui/index";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function StudentTutorialsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("enrolled"); // "enrolled" | "available"

  const { data, isLoading } = useQuery({
    queryKey: ["my-tutorial-sessions"],
    queryFn: async () => {
      const res = await api.get("/tutorial-sessions/mine");
      return res.data?.data || { enrolled: [], available: [] };
    },
  });

  const enrollMutation = useMutation({
    mutationFn: (sessionId) =>
      api.post(`/tutorial-sessions/${sessionId}/enroll`, {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-tutorial-sessions"] });
      toast.success(
        res.data?.data?.message || "Successfully enrolled in tutorial session!"
      );
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to enroll in session");
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: (enrollmentId) =>
      api.delete(`/tutorial-sessions/enrollments/${enrollmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tutorial-sessions"] });
      toast.success("Unenrolled from tutorial session");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to unenroll");
    },
  });

  const enrolled = data?.enrolled || [];
  const available = data?.available || [];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 bg-primary-100 dark:bg-primary-950/60 rounded-xl text-primary-600 dark:text-primary-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Tutorial & Extra Lecture Sessions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Join instructor-led tutorial sessions and supplemental classes
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("enrolled")}
          className={clsx(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "enrolled"
              ? "border-primary-600 text-primary-600 dark:text-primary-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>My Enrolled Sessions ({enrolled.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("available")}
          className={clsx(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "available"
              ? "border-primary-600 text-primary-600 dark:text-primary-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <BookOpen className="w-4 h-4" />
          <span>Available to Join ({available.length})</span>
        </button>
      </div>

      {/* Enrolled View */}
      {activeTab === "enrolled" && (
        <>
          {enrolled.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="You are not enrolled in any tutorial sessions"
              description="Browse available sessions to join extra review lectures and subject coaching."
              action={{
                label: "Explore Available Tutorials",
                onClick: () => setActiveTab("available"),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {enrolled.map((item) => {
                const s = item.tutorialSession;
                const teacherUser = s?.teacherProfile?.user;
                const teacherName = teacherUser
                  ? `${teacherUser.firstName} ${teacherUser.lastName}`
                  : "Assigned Instructor";

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                            {s?.subject?.name || "General Tutorial"}
                          </span>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                            {s?.title}
                          </h3>
                        </div>

                        <span
                          className={clsx(
                            "px-2.5 py-1 rounded-full text-xs font-bold uppercase",
                            item.status === "ENROLLED"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 py-3 border-y border-slate-100 dark:border-slate-800/80 mb-4">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Instructor:{" "}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {teacherName}
                            </strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {s?.isRecurring
                              ? `Every ${s?.dayOfWeek?.toLowerCase()} • ${s?.startTime} - ${s?.endTime}`
                              : `${s?.specificDate ? new Date(s.specificDate).toLocaleDateString() : ""} • ${s?.startTime} - ${s?.endTime}`}
                          </span>
                        </div>

                        {s?.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{s.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">
                        Enrolled: {new Date(item.enrolledAt).toLocaleDateString()}
                      </span>

                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to drop your enrollment in "${s?.title}"?`
                            )
                          ) {
                            unenrollMutation.mutate(item.id);
                          }
                        }}
                        disabled={unenrollMutation.isPending}
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors flex items-center gap-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Leave Session</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Available to Join View */}
      {activeTab === "available" && (
        <>
          {available.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No additional tutorial sessions available"
              description="You are currently registered for all open tutorial sessions matching your grade."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {available.map((s) => {
                const teacherUser = s.teacherProfile?.user;
                const teacherName = teacherUser
                  ? `${teacherUser.firstName} ${teacherUser.lastName}`
                  : "Instructor";

                return (
                  <div
                    key={s.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                          {s.subject?.name || "Supplemental Lecture"}
                        </span>

                        {s.isFull ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            Waitlist Only
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            Open Spots
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug mb-1">
                        {s.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Instructor: {teacherName}
                      </p>

                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 py-3 border-y border-slate-100 dark:border-slate-800/80 mb-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {s.isRecurring
                              ? `Every ${s.dayOfWeek?.toLowerCase()} • ${s.startTime} - ${s.endTime}`
                              : `${s.specificDate ? new Date(s.specificDate).toLocaleDateString() : ""} • ${s.startTime} - ${s.endTime}`}
                          </span>
                        </div>

                        {s.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{s.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-500">
                        {s.enrolledCount} enrolled {s.capacity ? `(${s.capacity} cap)` : ""}
                      </span>

                      <button
                        onClick={() => enrollMutation.mutate(s.id)}
                        disabled={enrollMutation.isPending}
                        className={clsx(
                          "px-4 py-1.5 text-xs font-semibold rounded-xl text-white shadow-sm transition-colors flex items-center gap-1.5",
                          s.isFull
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-primary-600 hover:bg-primary-700"
                        )}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{s.isFull ? "Join Waitlist" : "Enroll Now"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
