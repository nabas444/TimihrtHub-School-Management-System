import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  Plus,
  Search,
  Users,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  ClipboardList,
  BookOpen,
  Filter,
  UserCheck,
  UserX,
  Sparkles,
} from "lucide-react";
import api from "../../lib/api";
import {
  Avatar,
  Badge,
  EmptyState,
  PageLoader,
} from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import { useAuthStore } from "../../store/authStore";
import clsx from "clsx";
import toast from "react-hot-toast";

const DAYS_OF_WEEK = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
];

const initialSessionForm = {
  title: "",
  subjectId: "",
  classId: "",
  gradeLevelId: "",
  teacherProfileId: "",
  isRecurring: true,
  dayOfWeek: "SATURDAY",
  specificDate: "",
  startTime: "09:00",
  endTime: "10:30",
  location: "Room 101",
  capacity: "30",
  academicYear: "2026",
};

export default function TutorialSessionsPage() {
  const qc = useQueryClient();
  const { user, isTeacher, isAdmin } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [onlyMine, setOnlyMine] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionForm, setSessionForm] = useState(initialSessionForm);

  const [rosterSession, setRosterSession] = useState(null);
  const [attendanceSession, setAttendanceSession] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [attendanceMarks, setAttendanceMarks] = useState({}); // { [studentProfileId]: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' }

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ["tutorial-sessions", subjectFilter, onlyMine],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (subjectFilter !== "ALL") params.append("subjectId", subjectFilter);
      if (onlyMine) params.append("onlyMine", "true");
      const res = await api.get(`/tutorial-sessions?${params.toString()}`);
      return res.data?.data?.sessions || [];
    },
  });
  const sessions = sessionsData || [];

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects-list"],
    queryFn: async () => {
      const res = await api.get("/academics/subjects");
      return res.data?.data || [];
    },
  });
  const subjects = subjectsData || [];

  const { data: classesData } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return res.data?.data || [];
    },
  });
  const classes = classesData || [];

  const { data: gradeLevelsData } = useQuery({
    queryKey: ["grade-levels-list"],
    queryFn: async () => {
      const res = await api.get("/lookup-values/grade-levels");
      return res.data?.data || [];
    },
  });
  const gradeLevels = gradeLevelsData || [];

  const { data: teachersData } = useQuery({
    queryKey: ["teachers-list-for-tutorials"],
    queryFn: async () => {
      const res = await api.get("/staff?role=TEACHER&limit=100");
      return res.data?.data?.staff || [];
    },
  });
  const teachers = teachersData || [];

  // Roster details query
  const {
    data: singleSessionDetail,
    refetch: refetchSingleSession,
  } = useQuery({
    queryKey: ["tutorial-session-detail", rosterSession?.id || attendanceSession?.id],
    queryFn: async () => {
      const id = rosterSession?.id || attendanceSession?.id;
      if (!id) return null;
      const res = await api.get(`/tutorial-sessions/${id}`);
      return res.data?.data?.session || null;
    },
    enabled: Boolean(rosterSession?.id || attendanceSession?.id),
  });

  // ── Mutations ───────────────────────────────────────────────────────────
  const createSessionMutation = useMutation({
    mutationFn: (payload) => api.post("/tutorial-sessions", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tutorial-sessions"] });
      toast.success("Tutorial session scheduled successfully");
      setIsCreateOpen(false);
      setSessionForm(initialSessionForm);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create session");
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      api.patch(`/tutorial-sessions/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tutorial-sessions"] });
      toast.success("Tutorial session updated successfully");
      setIsCreateOpen(false);
      setEditingSession(null);
      setSessionForm(initialSessionForm);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update session");
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => api.delete(`/tutorial-sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tutorial-sessions"] });
      toast.success("Tutorial session deleted");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete session");
    },
  });

  const updateEnrollmentStatusMutation = useMutation({
    mutationFn: ({ enrollmentId, status }) =>
      api.patch(`/tutorial-sessions/enrollments/${enrollmentId}`, { status }),
    onSuccess: () => {
      refetchSingleSession();
      qc.invalidateQueries({ queryKey: ["tutorial-sessions"] });
      toast.success("Enrollment status updated");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update enrollment");
    },
  });

  const removeEnrollmentMutation = useMutation({
    mutationFn: (enrollmentId) =>
      api.delete(`/tutorial-sessions/enrollments/${enrollmentId}`),
    onSuccess: () => {
      refetchSingleSession();
      qc.invalidateQueries({ queryKey: ["tutorial-sessions"] });
      toast.success("Student removed from session");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to remove student");
    },
  });

  const recordAttendanceMutation = useMutation({
    mutationFn: ({ sessionId, payload }) =>
      api.post(`/tutorial-sessions/${sessionId}/attendance`, payload),
    onSuccess: (res) => {
      toast.success(
        res.data?.data?.message || "Attendance recorded successfully"
      );
      setAttendanceSession(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save attendance");
    },
  });

  // Handlers
  const handleOpenCreate = () => {
    setEditingSession(null);
    setSessionForm(initialSessionForm);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (session) => {
    setEditingSession(session);
    setSessionForm({
      title: session.title,
      subjectId: session.subjectId || "",
      classId: session.classId || "",
      gradeLevelId: session.gradeLevelId || "",
      teacherProfileId: session.teacherProfileId || "",
      isRecurring: session.isRecurring,
      dayOfWeek: session.dayOfWeek || "SATURDAY",
      specificDate: session.specificDate
        ? new Date(session.specificDate).toISOString().split("T")[0]
        : "",
      startTime: session.startTime || "09:00",
      endTime: session.endTime || "10:30",
      location: session.location || "",
      capacity: session.capacity ? String(session.capacity) : "",
      academicYear: session.academicYear || "2026",
    });
    setIsCreateOpen(true);
  };

  const handleSessionSubmit = (e) => {
    e.preventDefault();
    if (!sessionForm.title.trim()) {
      toast.error("Session title is required");
      return;
    }

    const payload = {
      title: sessionForm.title.trim(),
      subjectId: sessionForm.subjectId || null,
      classId: sessionForm.classId || null,
      gradeLevelId: sessionForm.gradeLevelId || null,
      teacherProfileId: sessionForm.teacherProfileId || null,
      isRecurring: sessionForm.isRecurring,
      dayOfWeek: sessionForm.isRecurring ? sessionForm.dayOfWeek : null,
      specificDate: !sessionForm.isRecurring && sessionForm.specificDate
        ? sessionForm.specificDate
        : null,
      startTime: sessionForm.startTime,
      endTime: sessionForm.endTime,
      location: sessionForm.location.trim() || null,
      capacity: sessionForm.capacity ? parseInt(sessionForm.capacity) : null,
      academicYear: sessionForm.academicYear || "2026",
    };

    if (editingSession) {
      updateSessionMutation.mutate({ id: editingSession.id, payload });
    } else {
      createSessionMutation.mutate(payload);
    }
  };

  const handleSaveAttendance = () => {
    if (!attendanceSession) return;
    const sessionDetail = singleSessionDetail;
    if (!sessionDetail) return;

    const enrolledStudents =
      sessionDetail.enrollments?.filter((e) => e.status === "ENROLLED") || [];
    if (enrolledStudents.length === 0) {
      toast.error("No enrolled students in this session to record attendance");
      return;
    }

    const records = enrolledStudents.map((e) => ({
      studentProfileId: e.studentProfileId,
      status: attendanceMarks[e.studentProfileId] || "PRESENT",
    }));

    recordAttendanceMutation.mutate({
      sessionId: attendanceSession.id,
      payload: {
        date: attendanceDate,
        records,
      },
    });
  };

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.subject?.name && s.subject.name.toLowerCase().includes(q)) ||
      (s.location && s.location.toLowerCase().includes(q))
    );
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-100 dark:bg-primary-950/60 rounded-xl text-primary-600 dark:text-primary-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Tutorial & Extra Lecture Sessions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Schedule supplemental instruction, monitor auto-waitlists, and log tutorial attendance
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule New Session</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, subject, room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Subject Filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>

          {isTeacher && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-700"
              />
              <span>Only My Sessions</span>
            </label>
          )}
        </div>

        <div className="text-xs text-slate-500">
          Showing <span className="font-bold">{filteredSessions.length}</span>{" "}
          sessions
        </div>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No tutorial sessions scheduled"
          description="Create extra lectures or weekend tutorial classes for students who need additional assistance."
          action={{
            label: "Schedule Session",
            onClick: handleOpenCreate,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSessions.map((s) => {
            const teacherUser = s.teacherProfile?.user;
            const teacherName = teacherUser
              ? `${teacherUser.firstName} ${teacherUser.lastName}`
              : "Assigned Staff";

            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Subject Badge, Schedule Badges, Edit/Delete */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                        {s.subject?.name || "General Tutorial"}
                      </span>
                      {s.isRecurring ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">
                          Every {s.dayOfWeek?.toLowerCase()}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                          {s.specificDate
                            ? new Date(s.specificDate).toLocaleDateString()
                            : "One-off"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
                        title="Edit Session"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to cancel and delete "${s.title}"?`
                            )
                          ) {
                            deleteSessionMutation.mutate(s.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-md"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Target */}
                  <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug mb-1">
                    {s.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Instructor: <span className="font-semibold text-slate-700 dark:text-slate-300">{teacherName}</span>
                    {s.class?.name && ` • Class: ${s.class.name}`}
                  </p>

                  {/* Details Grid */}
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 py-3 border-y border-slate-100 dark:border-slate-800/80 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {s.startTime} - {s.endTime}
                      </span>
                    </div>

                    {s.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.location}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-primary-500" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {s.enrolledCount || 0}
                          {s.capacity ? ` / ${s.capacity}` : ""}{" "}
                          Enrolled
                        </span>
                      </div>

                      {s.waitlistedCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                          {s.waitlistedCount} Waitlisted
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => setRosterSession(s)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Roster & Waitlist</span>
                  </button>

                  <button
                    onClick={() => {
                      setAttendanceSession(s);
                      setAttendanceMarks({});
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Attendance</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Session Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={
          editingSession
            ? "Edit Tutorial Session"
            : "Schedule Tutorial Session"
        }
      >
        <form onSubmit={handleSessionSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Session Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Grade 11 Physics Extra Mechanics Review"
              value={sessionForm.title}
              onChange={(e) =>
                setSessionForm({ ...sessionForm, title: e.target.value })
              }
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Subject
              </label>
              <select
                value={sessionForm.subjectId}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, subjectId: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Open / General --</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Class (Optional)
              </label>
              <select
                value={sessionForm.classId}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, classId: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- All Classes / Open --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isAdmin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Assigned Teacher *
              </label>
              <select
                value={sessionForm.teacherProfileId}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    teacherProfileId: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Select Teacher --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user?.firstName} {t.user?.lastName} (
                    {t.specialization || "Teacher"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recurrence toggle */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <input
              type="checkbox"
              id="recurrenceCheck"
              checked={sessionForm.isRecurring}
              onChange={(e) =>
                setSessionForm({
                  ...sessionForm,
                  isRecurring: e.target.checked,
                })
              }
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-700"
            />
            <label
              htmlFor="recurrenceCheck"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Recurring weekly session
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {sessionForm.isRecurring ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Day of Week *
                </label>
                <select
                  value={sessionForm.dayOfWeek}
                  onChange={(e) =>
                    setSessionForm({
                      ...sessionForm,
                      dayOfWeek: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Specific Date *
                </label>
                <input
                  type="date"
                  required
                  value={sessionForm.specificDate}
                  onChange={(e) =>
                    setSessionForm({
                      ...sessionForm,
                      specificDate: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Start Time *
              </label>
              <input
                type="time"
                required
                value={sessionForm.startTime}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, startTime: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                End Time *
              </label>
              <input
                type="time"
                required
                value={sessionForm.endTime}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, endTime: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Location / Room
              </label>
              <input
                type="text"
                placeholder="e.g. Science Lab 2 / Library A"
                value={sessionForm.location}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, location: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Student Capacity (Auto-waitlists beyond this)
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 30"
                value={sessionForm.capacity}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, capacity: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                createSessionMutation.isPending ||
                updateSessionMutation.isPending
              }
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {editingSession ? "Save Changes" : "Schedule Session"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Roster & Waitlist Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(rosterSession)}
        onClose={() => setRosterSession(null)}
        title={`Roster & Waitlist — ${rosterSession?.title || ""}`}
      >
        <div className="space-y-4 pt-2">
          {singleSessionDetail?.enrollments?.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No students have enrolled in this session yet.
            </p>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {singleSessionDetail?.enrollments?.map((e) => {
                const s = e.studentProfile;
                const studentName = s?.user
                  ? `${s.user.firstName} ${s.user.lastName}`
                  : "Student";

                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={s?.user?.avatar}
                        name={studentName}
                        size="sm"
                      />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {studentName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          ID: {s?.admissionNumber || "—"} | Class:{" "}
                          {s?.class?.name || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          e.status === "ENROLLED"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : e.status === "WAITLISTED"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {e.status}
                      </span>

                      {e.status === "WAITLISTED" && (
                        <button
                          onClick={() =>
                            updateEnrollmentStatusMutation.mutate({
                              enrollmentId: e.id,
                              status: "ENROLLED",
                            })
                          }
                          className="px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md"
                        >
                          Promote
                        </button>
                      )}

                      <button
                        onClick={() => removeEnrollmentMutation.mutate(e.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove Student"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setRosterSession(null)}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Attendance Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(attendanceSession)}
        onClose={() => setAttendanceSession(null)}
        title={`Tutorial Attendance — ${attendanceSession?.title || ""}`}
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Attendance Date:
            </span>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="px-3 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>

          {singleSessionDetail?.enrollments?.filter(
            (e) => e.status === "ENROLLED"
          ).length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No enrolled students in this session to mark attendance.
            </p>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {singleSessionDetail?.enrollments
                ?.filter((e) => e.status === "ENROLLED")
                .map((e) => {
                  const s = e.studentProfile;
                  const studentName = s?.user
                    ? `${s.user.firstName} ${s.user.lastName}`
                    : "Student";
                  const currentMark =
                    attendanceMarks[e.studentProfileId] || "PRESENT";

                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={s?.user?.avatar}
                          name={studentName}
                          size="sm"
                        />
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {studentName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {s?.class?.name || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Status Badges selector */}
                      <div className="flex items-center gap-1">
                        {["PRESENT", "LATE", "ABSENT", "EXCUSED"].map(
                          (status) => {
                            const isSelected = currentMark === status;
                            return (
                              <button
                                key={status}
                                type="button"
                                onClick={() =>
                                  setAttendanceMarks({
                                    ...attendanceMarks,
                                    [e.studentProfileId]: status,
                                  })
                                }
                                className={clsx(
                                  "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                                  isSelected
                                    ? status === "PRESENT"
                                      ? "bg-emerald-600 text-white"
                                      : status === "LATE"
                                      ? "bg-amber-500 text-white"
                                      : status === "ABSENT"
                                      ? "bg-red-600 text-white"
                                      : "bg-blue-600 text-white"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                                )}
                              >
                                {status[0]}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setAttendanceSession(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAttendance}
              disabled={recordAttendanceMutation.isPending}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm"
            >
              Save Attendance Record
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
