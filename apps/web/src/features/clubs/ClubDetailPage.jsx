import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  ArrowLeft,
  Users,
  Calendar,
  Clock,
  MapPin,
  GraduationCap,
  Award,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Megaphone,
  Check,
  Send,
  Trash2,
  Download,
  Settings,
  ShieldAlert,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  UserCheck,
  Save,
  Target,
  Image as ImageIcon,
  ExternalLink,
  BookOpen,
  Search,
} from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, Avatar, EmptyState } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import { CLUB_CATEGORIES, STATUS_CONFIG } from "./clubConstants";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function ClubDetailPage() {
  const { id: clubId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user, isAdmin, isTeacher, isStudent } = useAuthStore();
  const qc = useQueryClient();

  const activeTab = searchParams.get("tab") || "OVERVIEW"; // OVERVIEW | MEMBERS | MEETINGS | EVENTS | ACTIVITIES | ANNOUNCEMENTS | DOCUMENTS | SETTINGS
  const setActiveTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "OVERVIEW") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    });
  };

  // Modals
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinNotes, setJoinNotes] = useState("");

  const [assignLeaderModalOpen, setAssignLeaderModalOpen] = useState(false);
  const [leaderForm, setLeaderForm] = useState({
    studentId: "",
    role: "PRESIDENT",
    academicYear: "2025/2026",
  });

  const [scheduleMeetingModalOpen, setScheduleMeetingModalOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "16:00",
    endTime: "17:00",
    location: "Science Lab 2",
    recurrence: "NONE",
  });

  const [attendanceModalMeeting, setAttendanceModalMeeting] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState({});

  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    eventType: "WORKSHOP",
    date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    startTime: "14:00",
    endTime: "16:00",
    location: "Main Auditorium",
    capacity: 50,
    audience: "CLUB_MEMBERS",
    attachmentUrl: "",
  });

  const [createActivityModalOpen, setCreateActivityModalOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    outcome: "",
    participantsCount: 20,
    attachmentUrl: "",
  });

  const [createAnnouncementModalOpen, setCreateAnnouncementModalOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    priority: "NORMAL",
    isPinned: false,
  });

  const [createGoalModalOpen, setCreateGoalModalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    targetCount: 3,
    unit: "workshops",
    academicYear: "2025/2026",
  });

  const [uploadDocModalOpen, setUploadDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    name: "",
    category: "CONSTITUTION",
    fileUrl: "",
  });

  const [registerMemberModalOpen, setRegisterMemberModalOpen] = useState(false);
  const [registerMemberForm, setRegisterMemberForm] = useState({
    studentId: "",
    role: "MEMBER",
  });
  const [studentSearch, setStudentSearch] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: club, isLoading: clubLoading } = useQuery({
    queryKey: ["club-detail", clubId],
    queryFn: () => api.get(`/clubs/${clubId}`).then((r) => r.data.data),
  });

  const { data: meetingAttendance, isLoading: attLoading } = useQuery({
    queryKey: ["meeting-attendance", clubId, attendanceModalMeeting?.id],
    queryFn: () =>
      api
        .get(`/clubs/${clubId}/meetings/${attendanceModalMeeting?.id}/attendance`)
        .then((r) => r.data.data),
    enabled: !!attendanceModalMeeting,
  });

  const { data: studentCandidates, isLoading: studentsLoading } = useQuery({
    queryKey: ["club-student-candidates", studentSearch],
    queryFn: () =>
      api
        .get(`/clubs/student-candidates?search=${encodeURIComponent(studentSearch)}`)
        .then((r) => r.data.data || []),
    enabled: registerMemberModalOpen,
  });

  const { data: facultyCandidates, isLoading: facultyLoading } = useQuery({
    queryKey: ["club-faculty-candidates"],
    queryFn: () => api.get("/clubs/faculty-candidates").then((r) => r.data.data || []),
    enabled: activeTab === "SETTINGS",
  });

  const [editClubForm, setEditClubForm] = useState(null);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidateClub = () => {
    qc.invalidateQueries({ queryKey: ["club-detail", clubId] });
    qc.invalidateQueries({ queryKey: ["clubs-list"] });
    qc.invalidateQueries({ queryKey: ["my-clubs"] });
  };

  const registerMemberMutation = useMutation({
    mutationFn: (d) =>
      api.post(`/clubs/${clubId}/members/register`, {
        ...d,
        academicYear: club?.academicYear,
      }),
    onSuccess: () => {
      invalidateClub();
      toast.success("Student successfully registered into club!");
      setRegisterMemberModalOpen(false);
      setRegisterMemberForm({ studentId: "", role: "MEMBER" });
      setStudentSearch("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to register member");
    },
  });

  const joinMutation = useMutation({
    mutationFn: (notes) =>
      api.post(`/clubs/${clubId}/members/join`, { requestNotes: notes }),
    onSuccess: () => {
      invalidateClub();
      toast.success("Membership request sent!");
      setJoinModalOpen(false);
      setJoinNotes("");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Join failed"),
  });

  const updateMemberStatusMutation = useMutation({
    mutationFn: ({ memberId, status }) =>
      api.patch(`/clubs/${clubId}/members/${memberId}/status`, { status }),
    onSuccess: () => {
      invalidateClub();
      toast.success("Member status updated");
    },
  });

  const assignLeaderMutation = useMutation({
    mutationFn: (d) => api.post(`/clubs/${clubId}/leaders`, d),
    onSuccess: () => {
      invalidateClub();
      toast.success("Student leader assigned!");
      setAssignLeaderModalOpen(false);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Failed to assign leader"),
  });

  const scheduleMeetingMutation = useMutation({
    mutationFn: (d) => api.post(`/clubs/${clubId}/meetings`, d),
    onSuccess: () => {
      invalidateClub();
      toast.success("Meeting scheduled!");
      setScheduleMeetingModalOpen(false);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Failed to schedule meeting"),
  });

  const recordAttendanceMutation = useMutation({
    mutationFn: ({ meetingId, records }) =>
      api.post(`/clubs/${clubId}/meetings/${meetingId}/attendance`, { records }),
    onSuccess: () => {
      invalidateClub();
      toast.success("Meeting attendance saved!");
      setAttendanceModalMeeting(null);
    },
  });

  const createEventMutation = useMutation({
    mutationFn: (d) => api.post(`/clubs/${clubId}/events`, d),
    onSuccess: () => {
      invalidateClub();
      toast.success("Event created successfully!");
      setCreateEventModalOpen(false);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Failed to create event"),
  });

  const updateEventStatusMutation = useMutation({
    mutationFn: ({ eventId, status }) =>
      api.patch(`/clubs/${clubId}/events/${eventId}/status`, { status }),
    onSuccess: () => {
      invalidateClub();
      toast.success("Event status updated!");
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: ({ eventId, status }) =>
      api.post(`/clubs/events/${eventId}/rsvp`, { status }),
    onSuccess: () => {
      invalidateClub();
      toast.success("RSVP updated!");
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: (d) => api.post(`/clubs/${clubId}/activities`, d),
    onSuccess: () => {
      invalidateClub();
      toast.success("Activity recorded in portfolio!");
      setCreateActivityModalOpen(false);
    },
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: (d) => api.post(`/clubs/${clubId}/announcements`, d),
    onSuccess: () => {
      invalidateClub();
      toast.success("Announcement broadcasted!");
      setCreateAnnouncementModalOpen(false);
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: (d) => api.post(`/clubs/${clubId}/goals`, d),
    onSuccess: () => {
      invalidateClub();
      toast.success("Goal milestone added!");
      setCreateGoalModalOpen(false);
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ goalId, ...d }) =>
      api.patch(`/clubs/${clubId}/goals/${goalId}`, d),
    onSuccess: () => {
      invalidateClub();
      toast.success("Goal progress updated!");
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: (d) => api.post(`/clubs/${clubId}/documents`, d),
    onSuccess: () => {
      invalidateClub();
      toast.success("Document attached!");
      setUploadDocModalOpen(false);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId) => api.delete(`/clubs/${clubId}/documents/${docId}`),
    onSuccess: () => {
      invalidateClub();
      toast.success("Document removed");
    },
  });

  const updateClubMutation = useMutation({
    mutationFn: (d) => api.patch(`/clubs/${clubId}`, d),
    onSuccess: () => {
      invalidateClub();
      toast.success("Club profile & advisor updated successfully!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update club profile");
    },
  });

  const updateClubStatusMutation = useMutation({
    mutationFn: (status) => api.patch(`/clubs/${clubId}/status`, { status }),
    onSuccess: () => {
      invalidateClub();
      toast.success("Club status updated");
    },
  });

  if (clubLoading) return <PageLoader />;
  if (!club) return <div className="card p-12 text-center">Club not found</div>;

  const statusCfg = STATUS_CONFIG[club.status] || STATUS_CONFIG.ACTIVE;
  const catObj = CLUB_CATEGORIES.find((c) => c.id === club.category);
  const permissions = club.permissions || {};

  return (
    <div className="space-y-6">
      {/* ── Top Back Button ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          to="/clubs"
          className="btn-ghost btn-sm inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Clubs Directory
        </Link>
      </div>

      {/* ── Club Hero Banner ────────────────────────────────────────────────── */}
      <div className="card bg-white border border-gray-200 overflow-hidden shadow-xs">
        <div className="h-32 bg-gradient-to-r from-indigo-700 via-primary-600 to-purple-700 p-6 flex items-end justify-between relative">
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <span
              className={clsx(
                "px-3 py-1 rounded-full text-xs font-extrabold border bg-white shadow-xs",
                club.status === "ACTIVE"
                  ? "text-emerald-700 border-emerald-200"
                  : "text-amber-700 border-amber-200"
              )}
            >
              {statusCfg.label}
            </span>
          </div>
        </div>

        <div className="p-6 pt-0 flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-10 border-b border-gray-100">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center text-3xl flex-shrink-0">
              {catObj?.icon || "✨"}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-black text-gray-900">{club.name}</h1>
              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 font-bold">
                <Badge variant="indigo">{club.category.replace(/_/g, " ")}</Badge>
                <span>•</span>
                <span>Academic Year {club.academicYear}</span>
                <span>•</span>
                <span>{club.members?.length ?? 0} Members</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {isStudent() && (
              <>
                {permissions.isMember ? (
                  <button
                    className="btn-danger btn-sm text-xs"
                    onClick={() => {
                      const myMem = club.members?.find((m) => m.studentId === user.id);
                      if (myMem) {
                        updateMemberStatusMutation.mutate({
                          memberId: myMem.id,
                          status: "LEFT",
                        });
                      }
                    }}
                  >
                    Leave Club
                  </button>
                ) : club.my_membership_status === "REQUESTED" ? (
                  <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-xl text-xs font-bold">
                    Membership Requested
                  </span>
                ) : club.status === "ACTIVE" ? (
                  <button
                    className="btn-primary btn-sm text-xs inline-flex items-center gap-1.5"
                    onClick={() => setJoinModalOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" /> Request to Join
                  </button>
                ) : null}
              </>
            )}

            {permissions.canManageClub && (
              <button
                className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5"
                onClick={() => setActiveTab("SETTINGS")}
              >
                <Settings className="w-3.5 h-3.5" /> Club Settings
              </button>
            )}
          </div>
        </div>

        {/* Advisor & Leadership Snapshot Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 bg-gray-50/70 text-xs">
          {/* Advisor */}
          <div className="p-4 flex items-center gap-3">
            <Avatar
              name={
                club.advisor
                  ? `${club.advisor.firstName} ${club.advisor.lastName}`
                  : "Advisor"
              }
              src={club.advisor?.avatar}
              size="md"
            />
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase block">
                Faculty Advisor
              </span>
              <p className="font-extrabold text-gray-900">
                {club.advisor
                  ? `${club.advisor.firstName} ${club.advisor.lastName}`
                  : "Not Assigned"}
              </p>
              <p className="text-[10px] text-gray-500">{club.advisor?.email}</p>
            </div>
          </div>

          {/* Student Leadership */}
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
              👑
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase block">
                Student Leadership
              </span>
              <p className="font-extrabold text-gray-900">
                {club.leaders?.length > 0
                  ? `${club.leaders[0].student.firstName} (${club.leaders[0].role})`
                  : "Pending Election"}
              </p>
              <p className="text-[10px] text-gray-500">
                {club.leaders?.length > 1
                  ? `+${club.leaders.length - 1} other officers`
                  : "Operating Club"}
              </p>
            </div>
          </div>

          {/* Meeting Schedule */}
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
              🕒
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase block">
                Regular Meeting Schedule
              </span>
              <p className="font-extrabold text-gray-900">
                {club.preferredMeetingSchedule || "Weekly"}
              </p>
              <p className="text-[10px] text-gray-500">
                Location: {club.meetingLocation || "Campus Hall"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto text-xs">
        {[
          { id: "OVERVIEW", label: "📌 Overview & Goals", icon: BookOpen },
          {
            id: "MEMBERS",
            label: `👥 Members & Leaders (${club.members?.length ?? 0})`,
            icon: Users,
            badge: club.pendingRequests?.length > 0 ? club.pendingRequests.length : null,
          },
          {
            id: "MEETINGS",
            label: `📅 Meetings (${club.meetings?.length ?? 0})`,
            icon: Calendar,
          },
          {
            id: "EVENTS",
            label: `🏆 Special Events (${club.events?.length ?? 0})`,
            icon: Award,
          },
          {
            id: "ACTIVITIES",
            label: `🚀 Activities Portfolio (${club.activities?.length ?? 0})`,
            icon: Sparkles,
          },
          {
            id: "ANNOUNCEMENTS",
            label: `📢 Announcements (${club.announcements?.length ?? 0})`,
            icon: Megaphone,
          },
          {
            id: "DOCUMENTS",
            label: `📁 Documents (${club.documents?.length ?? 0})`,
            icon: FileText,
          },
          ...(permissions.canManageClub
            ? [{ id: "SETTINGS", label: "⚙️ Settings & Renewal", icon: Settings }]
            : []),
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-3.5 py-2 rounded-xl font-bold transition-all inline-flex items-center gap-1.5 whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.badge && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW & GOALS
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "OVERVIEW" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Mission Statement */}
            <div className="card p-5 bg-white border border-gray-200 space-y-2">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary-600" />
                Mission & Purpose
              </h3>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                {club.purpose || club.description}
              </p>
            </div>

            {/* Academic Year Goals */}
            <div className="card p-5 bg-white border border-gray-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  Academic Year Milestones & Goals ({club.academicYear})
                </h3>

                {permissions.canManageClub && (
                  <button
                    className="btn-secondary btn-sm text-xs inline-flex items-center gap-1"
                    onClick={() => {
                      setGoalForm({
                        title: "",
                        description: "",
                        targetCount: 3,
                        unit: "workshops",
                        academicYear: club.academicYear,
                      });
                      setCreateGoalModalOpen(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Goal
                  </button>
                )}
              </div>

              {(club.goals ?? []).length === 0 ? (
                <p className="text-xs text-gray-400">
                  No milestone goals recorded for this academic year yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {club.goals.map((g) => {
                    const pct = Math.min(
                      100,
                      Math.round((g.current_count / g.target_count) * 100)
                    );
                    return (
                      <div
                        key={g.id}
                        className="p-3.5 bg-gray-50 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-extrabold text-gray-900 block">
                              {g.title}
                            </span>
                            {g.description && (
                              <p className="text-[11px] text-gray-500">
                                {g.description}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={
                              g.status === "ACHIEVED"
                                ? "green"
                                : g.status === "MISSED"
                                ? "red"
                                : "yellow"
                            }
                          >
                            {g.status}
                          </Badge>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-gray-600 font-bold">
                            <span>
                              Progress: {g.current_count} / {g.target_count} {g.unit}
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                "h-full rounded-full transition-all",
                                pct >= 100 ? "bg-emerald-500" : "bg-primary-600"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {permissions.canManageClub && (
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              className="btn-ghost btn-sm text-[10px] py-0.5 px-2"
                              onClick={() =>
                                updateGoalMutation.mutate({
                                  goalId: g.id,
                                  currentCount: g.current_count + 1,
                                  status:
                                    g.current_count + 1 >= g.target_count
                                      ? "ACHIEVED"
                                      : "IN_PROGRESS",
                                })
                              }
                            >
                              + Increment Progress
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Upcoming Meetings & Events */}
          <div className="space-y-6">
            <div className="card p-5 bg-white border border-gray-200 space-y-3">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                Upcoming Meetings
              </h3>

              {(club.meetings ?? []).length === 0 ? (
                <p className="text-xs text-gray-400">No scheduled meetings.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {club.meetings.slice(0, 3).map((m) => (
                    <div key={m.id} className="py-2.5 space-y-1 text-xs">
                      <span className="font-bold text-gray-900 block">{m.title}</span>
                      <p className="text-[11px] text-gray-500">
                        {new Date(m.date).toLocaleDateString()} ({m.start_time} -{" "}
                        {m.end_time}) • {m.location}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5 bg-white border border-gray-200 space-y-3">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary-600" />
                Latest Club Notices
              </h3>

              {(club.announcements ?? []).length === 0 ? (
                <p className="text-xs text-gray-400">No notices posted yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {club.announcements.slice(0, 3).map((a) => (
                    <div key={a.id} className="py-2.5 space-y-1 text-xs">
                      <span className="font-bold text-gray-900 block">{a.title}</span>
                      <p className="text-[11px] text-gray-600 line-clamp-2">
                        {a.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 2: MEMBERS & LEADERSHIP
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "MEMBERS" && (
        <div className="space-y-6">
          {/* Pending Membership Requests (for Leaders & Advisor) */}
          {permissions.canManageClub && (club.pendingRequests ?? []).length > 0 && (
            <div className="card bg-amber-50/70 border border-amber-200 p-5 space-y-3">
              <h3 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-700" />
                Pending Join Applications ({club.pendingRequests.length})
              </h3>

              <div className="divide-y divide-amber-100">
                {club.pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={`${req.student.firstName} ${req.student.lastName}`}
                        src={req.student.avatar}
                        size="sm"
                      />
                      <div>
                        <span className="font-bold text-gray-900 block">
                          {req.student.firstName} {req.student.lastName}
                        </span>
                        <p className="text-[10px] text-gray-500">
                          {req.className || "Student"} • {req.student.email}
                        </p>
                        {req.requestNotes && (
                          <p className="text-[11px] text-amber-900 italic mt-0.5">
                            "{req.requestNotes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="btn-primary btn-sm text-xs inline-flex items-center gap-1"
                        onClick={() =>
                          updateMemberStatusMutation.mutate({
                            memberId: req.id,
                            status: "ACTIVE",
                          })
                        }
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        className="btn-ghost btn-sm text-xs text-rose-600 hover:bg-rose-50"
                        onClick={() =>
                          updateMemberStatusMutation.mutate({
                            memberId: req.id,
                            status: "REJECTED",
                          })
                        }
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student Leadership Board */}
          <div className="card p-5 bg-white border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  Active Student Leadership Board
                </h3>
                <p className="text-xs text-gray-500">
                  Student officers entrusted with organizing and operating club activities.
                </p>
              </div>

              {permissions.canManageClub && (
                <button
                  className="btn-secondary btn-sm text-xs inline-flex items-center gap-1"
                  onClick={() => setAssignLeaderModalOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> Appoint Leader
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(club.leaders ?? []).map((l) => (
                <div
                  key={l.id}
                  className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3 text-xs"
                >
                  <Avatar
                    name={`${l.student.firstName} ${l.student.lastName}`}
                    src={l.student.avatar}
                    size="md"
                  />
                  <div>
                    <span className="font-extrabold text-gray-900 block">
                      {l.student.firstName} {l.student.lastName}
                    </span>
                    <Badge variant="yellow">{l.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Active Member Roster */}
          <div className="card bg-white border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                Active Club Members ({club.members?.length ?? 0})
              </h3>

              {permissions.canManageClub && (
                <button
                  className="btn-primary btn-sm text-xs inline-flex items-center gap-1.5"
                  onClick={() => {
                    setRegisterMemberForm({ studentId: "", role: "MEMBER" });
                    setStudentSearch("");
                    setRegisterMemberModalOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Register Member
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="table w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Class</th>
                    <th className="py-2.5 px-4">Club Role</th>
                    <th className="py-2.5 px-4">Join Date</th>
                    {permissions.canManageClub && (
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(club.members ?? []).map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={`${m.student.firstName} ${m.student.lastName}`}
                            src={m.student.avatar}
                            size="xs"
                          />
                          <div>
                            <span className="font-bold text-gray-900 block">
                              {m.student.firstName} {m.student.lastName}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {m.student.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {m.className || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={m.role === "MEMBER" ? "gray" : "yellow"}>
                          {m.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono">
                        {new Date(m.joinDate).toLocaleDateString()}
                      </td>
                      {permissions.canManageClub && (
                        <td className="py-3 px-4 text-right">
                          <button
                            className="btn-ghost btn-sm text-rose-600 text-[10px] py-0.5 px-2 hover:bg-rose-50"
                            onClick={() =>
                              updateMemberStatusMutation.mutate({
                                memberId: m.id,
                                status: "REMOVED",
                              })
                            }
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 3: MEETINGS & ATTENDANCE
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "MEETINGS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-600" />
                Club Meetings & Attendance
              </h3>
              <p className="text-xs text-gray-500">
                Regular and ad-hoc club meeting sessions with automated room conflict detection.
              </p>
            </div>

            {permissions.canManageClub && (
              <button
                className="btn-primary inline-flex items-center gap-1.5 text-xs"
                onClick={() => setScheduleMeetingModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Schedule Meeting
              </button>
            )}
          </div>

          {(club.meetings ?? []).length === 0 ? (
            <div className="card p-12 text-center text-xs text-gray-400 bg-white border border-gray-200">
              No meetings scheduled yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {club.meetings.map((m) => (
                <div
                  key={m.id}
                  className="card p-4 bg-white border border-gray-200 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900">
                        {m.title}
                      </h4>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">
                        Organized by {m.organizer_first_name}{" "}
                        {m.organizer_last_name}
                      </span>
                    </div>
                    <Badge variant={m.status === "COMPLETED" ? "green" : "blue"}>
                      {m.status}
                    </Badge>
                  </div>

                  <div className="p-2.5 bg-gray-50 rounded-xl text-xs space-y-1 text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {new Date(m.date).toLocaleDateString("en", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {m.start_time} - {m.end_time}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>{m.location}</span>
                    </div>
                  </div>

                  {permissions.canManageClub && (
                    <button
                      className="btn-secondary btn-sm w-full text-xs justify-center"
                      onClick={() => setAttendanceModalMeeting(m)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {m.status === "COMPLETED"
                        ? "Review Attendance Record"
                        : "Take Attendance"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 4: SPECIAL EVENTS & RSVPS
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "EVENTS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                Special Club Events & Competitions
              </h3>
              <p className="text-xs text-gray-500">
                Workshops, fairs, tournaments, and field trips with RSVP management.
              </p>
            </div>

            {permissions.canManageClub && (
              <button
                className="btn-primary inline-flex items-center gap-1.5 text-xs"
                onClick={() => setCreateEventModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Propose New Event
              </button>
            )}
          </div>

          {(club.events ?? []).length === 0 ? (
            <div className="card p-12 text-center text-xs text-gray-400 bg-white border border-gray-200">
              No special events proposed yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {club.events.map((e) => (
                <div
                  key={e.id}
                  className="card p-5 bg-white border border-gray-200 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-900">
                        {e.title}
                      </h4>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">
                        Type: {e.event_type} • Audience: {e.audience}
                      </span>
                    </div>
                    <Badge
                      variant={
                        e.status === "APPROVED" || e.status === "PUBLISHED"
                          ? "green"
                          : e.status === "UNDER_REVIEW" || e.status === "SUBMITTED"
                          ? "yellow"
                          : "gray"
                      }
                    >
                      {e.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2">
                    {e.description}
                  </p>

                  <div className="p-2.5 bg-gray-50 rounded-xl text-xs space-y-1 text-gray-700">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {new Date(e.date).toLocaleDateString()} ({e.start_time} -{" "}
                        {e.end_time})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>{e.location}</span>
                    </div>
                  </div>

                  {/* RSVP Progress & Action */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-bold">
                      {e.rsvp_count} RSVP'd{" "}
                      {e.capacity > 0 ? `(Cap: ${e.capacity})` : ""}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Advisor / Admin Approval Button */}
                      {(isAdmin() || permissions.isAdvisor) &&
                        e.status === "SUBMITTED" && (
                          <button
                            className="btn-primary btn-sm text-[10px] py-1 px-2.5"
                            onClick={() =>
                              updateEventStatusMutation.mutate({
                                eventId: e.id,
                                status: "APPROVED",
                              })
                            }
                          >
                            Approve Event
                          </button>
                        )}

                      {/* Student RSVP */}
                      {e.status === "APPROVED" && (
                        <button
                          className={clsx(
                            "btn-sm text-[10px] py-1 px-3",
                            e.my_rsvp_status === "REGISTERED"
                              ? "btn-secondary"
                              : "btn-primary"
                          )}
                          onClick={() =>
                            rsvpMutation.mutate({
                              eventId: e.id,
                              status:
                                e.my_rsvp_status === "REGISTERED"
                                  ? "CANCELLED"
                                  : "REGISTERED",
                            })
                          }
                        >
                          {e.my_rsvp_status === "REGISTERED"
                            ? "✓ RSVP Confirmed (Cancel)"
                            : "RSVP / Register"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 5: ACTIVITIES & PORTFOLIO
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "ACTIVITIES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Completed Projects & Activities Portfolio
              </h3>
              <p className="text-xs text-gray-500">
                Historical record of community projects, hackathons, and achievements completed by the club.
              </p>
            </div>

            {permissions.canManageClub && (
              <button
                className="btn-primary inline-flex items-center gap-1.5 text-xs"
                onClick={() => setCreateActivityModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Log Completed Activity
              </button>
            )}
          </div>

          {(club.activities ?? []).length === 0 ? (
            <div className="card p-12 text-center text-xs text-gray-400 bg-white border border-gray-200">
              No completed activities logged in the portfolio yet.
            </div>
          ) : (
            <div className="space-y-3">
              {club.activities.map((act) => (
                <div
                  key={act.id}
                  className="card p-5 bg-white border border-gray-200 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-gray-900">
                      {act.title}
                    </h4>
                    <span className="text-gray-400 font-mono">
                      {new Date(act.date).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-gray-700 leading-relaxed">
                    {act.description}
                  </p>

                  {act.outcome && (
                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-900 text-[11px] font-medium">
                      <strong>Impact / Outcome:</strong> {act.outcome}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                    <span>
                      {act.participants_count} students participated • Logged by{" "}
                      {act.creator_first_name} {act.creator_last_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 6: ANNOUNCEMENTS
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "ANNOUNCEMENTS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary-600" />
                Club Announcements & Broadcasts
              </h3>
              <p className="text-xs text-gray-500">
                Official notices broadcast directly to active members and advisors.
              </p>
            </div>

            {permissions.canManageClub && (
              <button
                className="btn-primary inline-flex items-center gap-1.5 text-xs"
                onClick={() => setCreateAnnouncementModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Post Announcement
              </button>
            )}
          </div>

          {(club.announcements ?? []).length === 0 ? (
            <div className="card p-12 text-center text-xs text-gray-400 bg-white border border-gray-200">
              No announcements posted in this club yet.
            </div>
          ) : (
            <div className="space-y-3">
              {club.announcements.map((a) => (
                <div
                  key={a.id}
                  className={clsx(
                    "card p-5 border space-y-2 text-xs",
                    a.priority === "URGENT"
                      ? "bg-rose-50/70 border-rose-200"
                      : "bg-white border-gray-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-gray-900">
                        {a.title}
                      </span>
                      {a.priority === "URGENT" && (
                        <Badge variant="red">URGENT</Badge>
                      )}
                    </div>
                    <span className="text-gray-400 font-mono text-[10px]">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {a.content}
                  </p>

                  <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                    Posted by {a.author_first_name} {a.author_last_name} (
                    {a.author_role})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 7: DOCUMENTS & CONSTITUTION
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "DOCUMENTS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                Club Constitution, Bylaws & Repository
              </h3>
              <p className="text-xs text-gray-500">
                Official documents, meeting minutes, permission slips, and event plans.
              </p>
            </div>

            {permissions.canManageClub && (
              <button
                className="btn-primary inline-flex items-center gap-1.5 text-xs"
                onClick={() => setUploadDocModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Attach Document
              </button>
            )}
          </div>

          {(club.documents ?? []).length === 0 ? (
            <div className="card p-12 text-center text-xs text-gray-400 bg-white border border-gray-200">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="card bg-white border border-gray-200 overflow-hidden divide-y divide-gray-100 text-xs">
              {club.documents.map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-primary-600 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-gray-900 block">{d.name}</span>
                      <span className="text-[10px] text-gray-400">
                        Category: {d.category} • Uploaded by {d.uploader_first_name}{" "}
                        {d.uploader_last_name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={d.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary btn-sm text-xs inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> View / Download
                    </a>
                    {permissions.canManageClub && (
                      <button
                        className="btn-ghost p-1 text-gray-400 hover:text-red-600"
                        onClick={() => deleteDocMutation.mutate(d.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 8: SETTINGS & RENEWAL
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "SETTINGS" && permissions.canManageClub && (
        <div className="space-y-6 max-w-2xl">
          {/* Edit Club Profile & Advisor */}
          <div className="card bg-white border border-gray-200 p-6 space-y-4">
            <div>
              <h3 className="font-extrabold text-base text-gray-900">
                Club Profile & Advisor Assignment
              </h3>
              <p className="text-xs text-gray-500">
                Update club details, meeting schedule, and assign or change the faculty advisor.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="label font-bold">Club Name *</label>
                <input
                  className="input text-xs"
                  value={
                    editClubForm !== null
                      ? editClubForm.name
                      : club.name || ""
                  }
                  onChange={(e) =>
                    setEditClubForm((prev) => ({
                      ...(prev || {
                        name: club.name || "",
                        description: club.description || "",
                        purpose: club.purpose || "",
                        category: club.category || "SCIENCE",
                        advisorId: club.advisorId || club.advisor?.id || "",
                        preferredMeetingSchedule: club.preferredMeetingSchedule || "",
                        meetingLocation: club.meetingLocation || "",
                      }),
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label font-bold">Category</label>
                  <select
                    className="input text-xs"
                    value={
                      editClubForm !== null
                        ? editClubForm.category
                        : club.category || "SCIENCE"
                    }
                    onChange={(e) =>
                      setEditClubForm((prev) => ({
                        ...(prev || {
                          name: club.name || "",
                          description: club.description || "",
                          purpose: club.purpose || "",
                          category: club.category || "SCIENCE",
                          advisorId: club.advisorId || club.advisor?.id || "",
                          preferredMeetingSchedule: club.preferredMeetingSchedule || "",
                          meetingLocation: club.meetingLocation || "",
                        }),
                        category: e.target.value,
                      }))
                    }
                  >
                    {CLUB_CATEGORIES.filter((c) => c.id !== "ALL").map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label font-bold">Faculty / Staff Advisor</label>
                  <select
                    className="input text-xs"
                    value={
                      editClubForm !== null
                        ? editClubForm.advisorId
                        : club.advisorId || club.advisor?.id || ""
                    }
                    onChange={(e) =>
                      setEditClubForm((prev) => ({
                        ...(prev || {
                          name: club.name || "",
                          description: club.description || "",
                          purpose: club.purpose || "",
                          category: club.category || "SCIENCE",
                          advisorId: club.advisorId || club.advisor?.id || "",
                          preferredMeetingSchedule: club.preferredMeetingSchedule || "",
                          meetingLocation: club.meetingLocation || "",
                        }),
                        advisorId: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">None (Unassigned)</option>
                    {(facultyCandidates ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.firstName} {f.lastName} — {f.role} ({f.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label font-bold">Meeting Schedule</label>
                  <input
                    className="input text-xs"
                    placeholder="e.g. Every Thursday 4:00 PM"
                    value={
                      editClubForm !== null
                        ? editClubForm.preferredMeetingSchedule
                        : club.preferredMeetingSchedule || ""
                    }
                    onChange={(e) =>
                      setEditClubForm((prev) => ({
                        ...(prev || {
                          name: club.name || "",
                          description: club.description || "",
                          purpose: club.purpose || "",
                          category: club.category || "SCIENCE",
                          advisorId: club.advisorId || club.advisor?.id || "",
                          preferredMeetingSchedule: club.preferredMeetingSchedule || "",
                          meetingLocation: club.meetingLocation || "",
                        }),
                        preferredMeetingSchedule: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="label font-bold">Meeting Room / Location</label>
                  <input
                    className="input text-xs"
                    placeholder="e.g. Lab 2, Library Hall"
                    value={
                      editClubForm !== null
                        ? editClubForm.meetingLocation
                        : club.meetingLocation || ""
                    }
                    onChange={(e) =>
                      setEditClubForm((prev) => ({
                        ...(prev || {
                          name: club.name || "",
                          description: club.description || "",
                          purpose: club.purpose || "",
                          category: club.category || "SCIENCE",
                          advisorId: club.advisorId || club.advisor?.id || "",
                          preferredMeetingSchedule: club.preferredMeetingSchedule || "",
                          meetingLocation: club.meetingLocation || "",
                        }),
                        meetingLocation: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="label font-bold">Mission, Purpose & Goals</label>
                <textarea
                  className="input text-xs min-h-16 resize-none"
                  value={
                    editClubForm !== null
                      ? editClubForm.purpose
                      : club.purpose || ""
                  }
                  onChange={(e) =>
                    setEditClubForm((prev) => ({
                      ...(prev || {
                        name: club.name || "",
                        description: club.description || "",
                        purpose: club.purpose || "",
                        category: club.category || "SCIENCE",
                        advisorId: club.advisorId || club.advisor?.id || "",
                        preferredMeetingSchedule: club.preferredMeetingSchedule || "",
                        meetingLocation: club.meetingLocation || "",
                      }),
                      purpose: e.target.value,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  className="btn-primary inline-flex items-center gap-1.5 text-xs"
                  onClick={() => {
                    const payload = editClubForm || {
                      name: club.name,
                      description: club.description,
                      purpose: club.purpose,
                      category: club.category,
                      advisorId: club.advisorId || club.advisor?.id || null,
                      preferredMeetingSchedule: club.preferredMeetingSchedule,
                      meetingLocation: club.meetingLocation,
                    };
                    updateClubMutation.mutate(payload);
                  }}
                  disabled={updateClubMutation.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateClubMutation.isPending ? "Saving Changes…" : "Save Club Settings"}
                </button>
              </div>
            </div>
          </div>

          {/* Status Controls */}
          <div className="card bg-white border border-gray-200 p-6 space-y-4">
            <div>
              <h3 className="font-extrabold text-base text-gray-900">
                Club Administration & Status Controls
              </h3>
              <p className="text-xs text-gray-500">
                Manage club lifecycle state, renewals, or archival.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl space-y-3 text-xs">
              <h4 className="font-bold text-gray-800">Club Lifecycle Action</h4>
              <div className="flex items-center gap-2 flex-wrap">
                {isAdmin() && (
                  <>
                    {club.status !== "ACTIVE" && (
                      <button
                        className="btn-primary btn-sm text-xs"
                        onClick={() => updateClubStatusMutation.mutate("ACTIVE")}
                      >
                        Set Status: Active
                      </button>
                    )}
                    {club.status === "ACTIVE" && (
                      <button
                        className="btn-danger btn-sm text-xs"
                        onClick={() => updateClubStatusMutation.mutate("SUSPENDED")}
                      >
                        Suspend Club
                      </button>
                    )}
                    <button
                      className="btn-secondary btn-sm text-xs"
                      onClick={() => updateClubStatusMutation.mutate("ARCHIVED")}
                    >
                      Archive Club
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Join Club ─────────────────────────────────────────────────── */}
      <Modal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title={`Join ${club.name}`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setJoinModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => joinMutation.mutate(joinNotes)}
              disabled={joinMutation.isPending}
            >
              <Send className="w-3.5 h-3.5" />
              {joinMutation.isPending ? "Sending…" : "Submit Request"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-gray-600">
            Submit your membership request for <strong>{club.name}</strong>.
          </p>
          <div>
            <label className="label font-bold">Why do you want to join?</label>
            <textarea
              className="input text-xs min-h-16 resize-none"
              placeholder="Tell the leaders about your interests or goals…"
              value={joinNotes}
              onChange={(e) => setJoinNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Assign Student Leader ─────────────────────────────────────── */}
      <Modal
        open={assignLeaderModalOpen}
        onClose={() => setAssignLeaderModalOpen(false)}
        title="Appoint Student Leader"
        size="sm"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setAssignLeaderModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => assignLeaderMutation.mutate(leaderForm)}
              disabled={assignLeaderMutation.isPending || !leaderForm.studentId}
            >
              <Award className="w-3.5 h-3.5" />
              Appoint Officer
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Select Club Member *</label>
            <select
              className="input text-xs"
              value={leaderForm.studentId}
              onChange={(e) =>
                setLeaderForm((f) => ({ ...f, studentId: e.target.value }))
              }
              required
            >
              <option value="">Choose active student member</option>
              {(club.members ?? []).map((m) => (
                <option key={m.studentId} value={m.studentId}>
                  {m.student.firstName} {m.student.lastName} ({m.className})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label font-bold">Officer Role *</label>
            <select
              className="input text-xs"
              value={leaderForm.role}
              onChange={(e) =>
                setLeaderForm((f) => ({ ...f, role: e.target.value }))
              }
            >
              <option value="PRESIDENT">President / Chair</option>
              <option value="VICE_PRESIDENT">Vice President / Co-Chair</option>
              <option value="SECRETARY">Secretary</option>
              <option value="TREASURER">Treasurer</option>
              <option value="PUBLIC_RELATIONS">Public Relations & Media</option>
              <option value="OTHER">Officer / Committee Lead</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Schedule Meeting ──────────────────────────────────────────── */}
      <Modal
        open={scheduleMeetingModalOpen}
        onClose={() => setScheduleMeetingModalOpen(false)}
        title="Schedule Club Meeting"
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setScheduleMeetingModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => scheduleMeetingMutation.mutate(meetingForm)}
              disabled={
                scheduleMeetingMutation.isPending || !meetingForm.title.trim()
              }
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule & Notify Members
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Meeting Title *</label>
            <input
              className="input text-xs"
              placeholder="e.g. Weekly Debate Prep, Robot Assembly Session"
              value={meetingForm.title}
              onChange={(e) =>
                setMeetingForm((f) => ({ ...f, title: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label font-bold">Date *</label>
              <input
                type="date"
                className="input text-xs"
                value={meetingForm.date}
                onChange={(e) =>
                  setMeetingForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label font-bold">Start Time *</label>
              <input
                type="time"
                className="input text-xs"
                value={meetingForm.startTime}
                onChange={(e) =>
                  setMeetingForm((f) => ({ ...f, startTime: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label font-bold">End Time *</label>
              <input
                type="time"
                className="input text-xs"
                value={meetingForm.endTime}
                onChange={(e) =>
                  setMeetingForm((f) => ({ ...f, endTime: e.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Location / Room *</label>
            <input
              className="input text-xs"
              value={meetingForm.location}
              onChange={(e) =>
                setMeetingForm((f) => ({ ...f, location: e.target.value }))
              }
              required
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Meeting Attendance ────────────────────────────────────────── */}
      <Modal
        open={!!attendanceModalMeeting}
        onClose={() => setAttendanceModalMeeting(null)}
        title={`Meeting Attendance — ${attendanceModalMeeting?.title}`}
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setAttendanceModalMeeting(null)}
            >
              Close
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => {
                const records = (meetingAttendance ?? []).map((m) => ({
                  studentId: m.studentId,
                  status: attendanceRecords[m.studentId] || m.status || "PRESENT",
                }));
                recordAttendanceMutation.mutate({
                  meetingId: attendanceModalMeeting?.id,
                  records,
                });
              }}
              disabled={recordAttendanceMutation.isPending}
            >
              <Save className="w-3.5 h-3.5" /> Save Attendance
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs max-h-80 overflow-y-auto">
          {attLoading ? (
            <PageLoader />
          ) : (
            <div className="divide-y divide-gray-100">
              {(meetingAttendance ?? []).map((m) => {
                const currentStatus =
                  attendanceRecords[m.studentId] ||
                  (m.status !== "UNRECORDED" ? m.status : "PRESENT");
                return (
                  <div
                    key={m.studentId}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={`${m.student.firstName} ${m.student.lastName}`}
                        size="xs"
                      />
                      <span className="font-bold text-gray-900">
                        {m.student.firstName} {m.student.lastName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {["PRESENT", "LATE", "ABSENT", "EXCUSED"].map((st) => (
                        <button
                          key={st}
                          type="button"
                          className={clsx(
                            "px-2 py-0.5 rounded text-[10px] font-bold border",
                            currentStatus === st
                              ? "bg-primary-600 text-white border-primary-600"
                              : "bg-gray-50 text-gray-600 border-gray-200"
                          )}
                          onClick={() =>
                            setAttendanceRecords((prev) => ({
                              ...prev,
                              [m.studentId]: st,
                            }))
                          }
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal: Propose Event ─────────────────────────────────────────────── */}
      <Modal
        open={createEventModalOpen}
        onClose={() => setCreateEventModalOpen(false)}
        title="Propose Club Event / Workshop"
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setCreateEventModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => createEventMutation.mutate(eventForm)}
              disabled={createEventMutation.isPending || !eventForm.title.trim()}
            >
              <Award className="w-3.5 h-3.5" /> Submit Event Proposal
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Event Title *</label>
            <input
              className="input text-xs"
              placeholder="e.g. Annual Science Fair, Coding Hackathon, Debate Gala"
              value={eventForm.title}
              onChange={(e) =>
                setEventForm((f) => ({ ...f, title: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label font-bold">Event Type</label>
              <select
                className="input text-xs"
                value={eventForm.eventType}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, eventType: e.target.value }))
                }
              >
                <option value="WORKSHOP">Workshop / Bootcamp</option>
                <option value="COMPETITION">Competition / Tournament</option>
                <option value="FAIR">Science / Art Fair</option>
                <option value="EXHIBITION">Exhibition / Showcase</option>
                <option value="FIELD_TRIP">Field Trip / Tour</option>
                <option value="GUEST_SPEAKER">Guest Speaker / Seminar</option>
              </select>
            </div>

            <div>
              <label className="label font-bold">Audience</label>
              <select
                className="input text-xs"
                value={eventForm.audience}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, audience: e.target.value }))
                }
              >
                <option value="CLUB_MEMBERS">Club Members Only</option>
                <option value="WHOLE_SCHOOL">Whole School (Open to All)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label font-bold">Date *</label>
              <input
                type="date"
                className="input text-xs"
                value={eventForm.date}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label font-bold">Start Time</label>
              <input
                type="time"
                className="input text-xs"
                value={eventForm.startTime}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, startTime: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label font-bold">End Time</label>
              <input
                type="time"
                className="input text-xs"
                value={eventForm.endTime}
                onChange={(e) =>
                  setEventForm((f) => ({ ...f, endTime: e.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Location *</label>
            <input
              className="input text-xs"
              value={eventForm.location}
              onChange={(e) =>
                setEventForm((f) => ({ ...f, location: e.target.value }))
              }
              required
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Create Activity ───────────────────────────────────────────── */}
      <Modal
        open={createActivityModalOpen}
        onClose={() => setCreateActivityModalOpen(false)}
        title="Log Completed Activity"
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setCreateActivityModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => createActivityMutation.mutate(activityForm)}
              disabled={
                createActivityMutation.isPending || !activityForm.title.trim()
              }
            >
              Record Activity
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Activity Title *</label>
            <input
              className="input text-xs"
              placeholder="e.g. Community Tree Planting, Robotics Prototype Demo"
              value={activityForm.title}
              onChange={(e) =>
                setActivityForm((f) => ({ ...f, title: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <label className="label font-bold">Outcome & Results</label>
            <textarea
              className="input text-xs min-h-16 resize-none"
              placeholder="Describe what was achieved, awards won, or community impact…"
              value={activityForm.outcome}
              onChange={(e) =>
                setActivityForm((f) => ({ ...f, outcome: e.target.value }))
              }
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Post Announcement ─────────────────────────────────────────── */}
      <Modal
        open={createAnnouncementModalOpen}
        onClose={() => setCreateAnnouncementModalOpen(false)}
        title="Post Club Announcement"
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setCreateAnnouncementModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => createAnnouncementMutation.mutate(announcementForm)}
              disabled={
                createAnnouncementMutation.isPending ||
                !announcementForm.title.trim()
              }
            >
              <Send className="w-3.5 h-3.5" /> Broadcast Notice
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Title *</label>
            <input
              className="input text-xs"
              value={announcementForm.title}
              onChange={(e) =>
                setAnnouncementForm((f) => ({ ...f, title: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <label className="label font-bold">Content *</label>
            <textarea
              className="input text-xs min-h-20 resize-none"
              value={announcementForm.content}
              onChange={(e) =>
                setAnnouncementForm((f) => ({ ...f, content: e.target.value }))
              }
              required
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Add Goal Milestone ────────────────────────────────────────── */}
      <Modal
        open={createGoalModalOpen}
        onClose={() => setCreateGoalModalOpen(false)}
        title="Add Academic Year Goal Milestone"
        size="sm"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setCreateGoalModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => createGoalMutation.mutate(goalForm)}
              disabled={createGoalMutation.isPending || !goalForm.title.trim()}
            >
              Save Goal
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Goal Title *</label>
            <input
              className="input text-xs"
              placeholder="e.g. Organize 3 Coding Workshops"
              value={goalForm.title}
              onChange={(e) =>
                setGoalForm((f) => ({ ...f, title: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label font-bold">Target Count</label>
              <input
                type="number"
                min="1"
                className="input text-xs"
                value={goalForm.targetCount}
                onChange={(e) =>
                  setGoalForm((f) => ({
                    ...f,
                    targetCount: parseInt(e.target.value, 10) || 1,
                  }))
                }
              />
            </div>
            <div>
              <label className="label font-bold">Unit</label>
              <input
                className="input text-xs"
                placeholder="e.g. workshops, members"
                value={goalForm.unit}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, unit: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Attach Document ───────────────────────────────────────────── */}
      <Modal
        open={uploadDocModalOpen}
        onClose={() => setUploadDocModalOpen(false)}
        title="Attach Document to Club Repository"
        size="sm"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setUploadDocModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => uploadDocMutation.mutate(docForm)}
              disabled={
                uploadDocMutation.isPending ||
                !docForm.name.trim() ||
                !docForm.fileUrl.trim()
              }
            >
              Attach Document
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Document Name *</label>
            <input
              className="input text-xs"
              placeholder="e.g. Club Constitution & Bylaws 2025"
              value={docForm.name}
              onChange={(e) =>
                setDocForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <label className="label font-bold">Category</label>
            <select
              className="input text-xs"
              value={docForm.category}
              onChange={(e) =>
                setDocForm((f) => ({ ...f, category: e.target.value }))
              }
            >
              <option value="CONSTITUTION">Club Constitution & Bylaws</option>
              <option value="MEETING_MINUTES">Meeting Minutes & Notes</option>
              <option value="PROPOSAL">Event / Project Proposal</option>
              <option value="REPORT">Report / Activity Summary</option>
              <option value="OTHER">Other Resource</option>
            </select>
          </div>

          <div>
            <label className="label font-bold">File URL *</label>
            <input
              className="input text-xs"
              placeholder="https://…"
              value={docForm.fileUrl}
              onChange={(e) =>
                setDocForm((f) => ({ ...f, fileUrl: e.target.value }))
              }
              required
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Direct Register Member ───────────────────────────────────── */}
      <Modal
        open={registerMemberModalOpen}
        onClose={() => setRegisterMemberModalOpen(false)}
        title={`Register Member — ${club.name}`}
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setRegisterMemberModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => registerMemberMutation.mutate(registerMemberForm)}
              disabled={
                registerMemberMutation.isPending ||
                !registerMemberForm.studentId
              }
            >
              <UserCheck className="w-3.5 h-3.5" />
              {registerMemberMutation.isPending
                ? "Registering…"
                : "Register Student"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-600">
            Club advisors and leaders can directly register students into the club.
          </p>

          {/* Student Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              className="input text-xs pl-8 font-medium"
              placeholder="Search students by name, email, admission #…"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            {studentSearch && (
              <button
                onClick={() => setStudentSearch("")}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* Students Candidate List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50/50">
            {studentsLoading ? (
              <div className="p-4 text-center text-gray-400">Loading students…</div>
            ) : (studentCandidates ?? []).length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No matching students found.
              </div>
            ) : (
              (studentCandidates ?? []).map((st) => {
                const isSelected = registerMemberForm.studentId === st.id;
                const isAlreadyMember = (club.members ?? []).some(
                  (m) => m.studentId === st.id
                );
                return (
                  <div
                    key={st.id}
                    onClick={() => {
                      if (!isAlreadyMember) {
                        setRegisterMemberForm((f) => ({
                          ...f,
                          studentId: st.id,
                        }));
                      }
                    }}
                    className={clsx(
                      "p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all",
                      isSelected
                        ? "bg-primary-50 border-primary-300 shadow-xs"
                        : isAlreadyMember
                        ? "bg-gray-100/70 border-gray-200 opacity-60 cursor-not-allowed"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={`${st.firstName} ${st.lastName}`}
                        size="xs"
                        src={st.avatar}
                      />
                      <div>
                        <span className="font-extrabold text-gray-900 block">
                          {st.firstName} {st.lastName}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {st.className ? `Class: ${st.className}` : "Student"} •{" "}
                          {st.admissionNumber
                            ? `#${st.admissionNumber}`
                            : st.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAlreadyMember ? (
                        <Badge variant="green">Already Member</Badge>
                      ) : (
                        <div
                          className={clsx(
                            "w-4 h-4 rounded-full border flex items-center justify-center text-[9px]",
                            isSelected
                              ? "bg-primary-600 text-white border-primary-600"
                              : "border-gray-300"
                          )}
                        >
                          {isSelected && "✓"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Role Selection */}
          <div>
            <label className="label font-bold">Assign Initial Club Role</label>
            <select
              className="input text-xs"
              value={registerMemberForm.role}
              onChange={(e) =>
                setRegisterMemberForm((f) => ({ ...f, role: e.target.value }))
              }
            >
              <option value="MEMBER">Member (General Membership)</option>
              <option value="PRESIDENT">President / Chair</option>
              <option value="VICE_PRESIDENT">Vice President / Co-Chair</option>
              <option value="SECRETARY">Secretary</option>
              <option value="TREASURER">Treasurer</option>
              <option value="PUBLIC_RELATIONS">Public Relations & Media</option>
              <option value="OTHER">Committee Lead / Officer</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
