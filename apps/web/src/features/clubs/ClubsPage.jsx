import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Search,
  Filter,
  Plus,
  Users,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  ChevronRight,
  UserCheck,
  GraduationCap,
  Building2,
  MapPin,
  FileText,
  RotateCcw,
  BookOpen,
  Send,
  SlidersHorizontal,
  Check,
  CalendarDays,
  Layers,
  ArrowRight,
} from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import StatCard from "../../components/shared/StatCard";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, Avatar, EmptyState } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import clsx from "clsx";
import toast from "react-hot-toast";

export const CLUB_CATEGORIES = [
  { id: "ALL", label: "All Categories", icon: "✨" },
  { id: "ACADEMIC", label: "Academic", icon: "📚", color: "indigo" },
  { id: "SCIENCE", label: "Science", icon: "🔬", color: "teal" },
  { id: "TECHNOLOGY", label: "Technology & Robotics", icon: "💻", color: "cyan" },
  { id: "MATHEMATICS", label: "Mathematics", icon: "🧮", color: "blue" },
  { id: "ARTS", label: "Fine Arts & Design", icon: "🎨", color: "pink" },
  { id: "MUSIC", label: "Music & Performing", icon: "🎵", color: "purple" },
  { id: "SPORTS", label: "Sports & Athletics", icon: "⚽", color: "green" },
  { id: "DEBATE", label: "Debate & Model UN", icon: "🎙️", color: "amber" },
  { id: "CULTURE", label: "Culture & Language", icon: "🌍", color: "orange" },
  { id: "ENTREPRENEURSHIP", label: "Entrepreneurship", icon: "🚀", color: "emerald" },
  { id: "COMMUNITY_SERVICE", label: "Community Service", icon: "🤝", color: "rose" },
  { id: "ENVIRONMENT", label: "Environment & Eco", icon: "🌿", color: "emerald" },
  { id: "OTHER", label: "Other Interest", icon: "💡", color: "gray" },
];

export const STATUS_CONFIG = {
  ACTIVE: { label: "Active", variant: "green", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  PENDING_APPROVAL: { label: "Pending Approval", variant: "yellow", bg: "bg-amber-50 text-amber-800 border-amber-200" },
  RENEWAL_REQUIRED: { label: "Renewal Required", variant: "blue", bg: "bg-blue-50 text-blue-800 border-blue-200" },
  SUSPENDED: { label: "Suspended", variant: "red", bg: "bg-rose-50 text-rose-800 border-rose-200" },
  ARCHIVED: { label: "Archived", variant: "gray", bg: "bg-gray-100 text-gray-700 border-gray-200" },
  REJECTED: { label: "Rejected", variant: "red", bg: "bg-red-50 text-red-700 border-red-200" },
  DRAFT: { label: "Draft", variant: "gray", bg: "bg-gray-50 text-gray-600 border-gray-200" },
};

export default function ClubsPage() {
  const { t } = useTranslation();
  const { user, isAdmin, isTeacher, isStudent } = useAuthStore();
  const qc = useQueryClient();

  // Active view tab
  const [activeTab, setActiveTab] = useState("DIRECTORY"); // DIRECTORY | MY_CLUBS | PENDING | CALENDAR | RENEWALS

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");

  // Modals
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [proposeForm, setProposeForm] = useState({
    name: "",
    description: "",
    purpose: "",
    category: "SCIENCE",
    academicYear: "2025/2026",
    advisorId: "",
    expectedMembership: 25,
    preferredMeetingSchedule: "Every Wednesday 4:00 PM - 5:00 PM",
    meetingLocation: "Science Lab 2",
    logoUrl: "",
    bannerUrl: "",
  });

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedClubForReview, setSelectedClubForReview] = useState(null);
  const [reviewAction, setReviewAction] = useState({ status: "ACTIVE", reason: "" });

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedClubForJoin, setSelectedClubForJoin] = useState(null);
  const [joinNotes, setJoinNotes] = useState("");

  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedClubForRenew, setSelectedClubForRenew] = useState(null);
  const [renewForm, setRenewForm] = useState({
    newAcademicYear: "2026/2027",
    newAdvisorId: "",
    newPresidentId: "",
    updatedPurpose: "",
    meetingSchedule: "",
  });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["clubs-overview"],
    queryFn: () => api.get("/clubs/overview").then((r) => r.data.data),
  });

  const { data: clubs, isLoading: clubsLoading } = useQuery({
    queryKey: ["clubs-list", search, selectedCategory, selectedStatus, selectedYear],
    queryFn: () =>
      api
        .get(
          `/clubs?search=${encodeURIComponent(search)}&category=${selectedCategory}&status=${selectedStatus}&academicYear=${selectedYear}`
        )
        .then((r) => r.data.data),
  });

  const { data: myClubs, isLoading: myClubsLoading } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: () => api.get("/clubs/my").then((r) => r.data.data),
  });

  const { data: calendarItems, isLoading: calendarLoading } = useQuery({
    queryKey: ["clubs-calendar"],
    queryFn: () => api.get("/clubs/calendar/all").then((r) => r.data.data),
    enabled: activeTab === "CALENDAR",
  });

  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ["clubs-faculty-candidates"],
    queryFn: () =>
      api.get("/clubs/faculty-candidates").then((r) => r.data.data || []),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const proposeMutation = useMutation({
    mutationFn: (d) => api.post("/clubs", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clubs-list"] });
      qc.invalidateQueries({ queryKey: ["clubs-overview"] });
      qc.invalidateQueries({ queryKey: ["my-clubs"] });
      toast.success(
        isAdmin()
          ? "Club created and activated successfully!"
          : "Club proposal submitted! Awaiting administrator approval."
      );
      setProposeModalOpen(false);
      setProposeForm({
        name: "",
        description: "",
        purpose: "",
        category: "SCIENCE",
        academicYear: "2025/2026",
        advisorId: "",
        expectedMembership: 25,
        preferredMeetingSchedule: "Every Wednesday 4:00 PM - 5:00 PM",
        meetingLocation: "Science Lab 2",
        logoUrl: "",
        bannerUrl: "",
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit club proposal");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, ...d }) => api.patch(`/clubs/${id}/status`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clubs-list"] });
      qc.invalidateQueries({ queryKey: ["clubs-overview"] });
      toast.success("Club status updated successfully!");
      setReviewModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update club status");
    },
  });

  const joinMutation = useMutation({
    mutationFn: ({ clubId, requestNotes }) =>
      api.post(`/clubs/${clubId}/members/join`, { requestNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clubs-list"] });
      qc.invalidateQueries({ queryKey: ["my-clubs"] });
      toast.success("Membership request submitted to club leadership!");
      setJoinModalOpen(false);
      setJoinNotes("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit join request");
    },
  });

  const renewMutation = useMutation({
    mutationFn: ({ clubId, ...d }) => api.post(`/clubs/${clubId}/renew`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clubs-list"] });
      qc.invalidateQueries({ queryKey: ["clubs-overview"] });
      toast.success("Club successfully renewed for the new academic year!");
      setRenewModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to renew club");
    },
  });

  // Filtered pending clubs for Admin
  const pendingClubs = useMemo(() => {
    return (clubs ?? []).filter((c) => c.status === "PENDING_APPROVAL");
  }, [clubs]);

  // Clubs requiring renewal
  const renewalClubs = useMemo(() => {
    return (clubs ?? []).filter(
      (c) => c.status === "RENEWAL_REQUIRED" || c.status === "ACTIVE"
    );
  }, [clubs]);

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-600" />
            School Extracurricular Clubs
          </h1>
          <p className="page-subtitle">
            Discover student clubs, explore extracurricular activities, collaborate with faculty advisors & student leaders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn-primary inline-flex items-center gap-1.5 shadow-xs"
            onClick={() => setProposeModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            {isAdmin() ? "Create New Club" : "Propose New Club"}
          </button>
        </div>
      </div>

      {/* ── High-Level KPI Summary (Admin / Overview) ────────────────────────── */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="card p-3.5 bg-white border border-gray-200">
            <span className="text-[10px] font-extrabold text-gray-500 uppercase block">
              Total Clubs
            </span>
            <span className="text-xl font-black text-gray-900 mt-0.5 block">
              {overview.totalClubs}
            </span>
          </div>

          <div className="card p-3.5 bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">
              Active Clubs
            </span>
            <span className="text-xl font-black text-emerald-900 mt-0.5 block">
              {overview.activeClubs}
            </span>
          </div>

          <div className="card p-3.5 bg-amber-50 border border-amber-200">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase block">
              Pending Approval
            </span>
            <span className="text-xl font-black text-amber-900 mt-0.5 block">
              {overview.pendingApproval}
            </span>
          </div>

          <div className="card p-3.5 bg-blue-50 border border-blue-200">
            <span className="text-[10px] font-extrabold text-blue-800 uppercase block">
              Renewal Required
            </span>
            <span className="text-xl font-black text-blue-900 mt-0.5 block">
              {overview.renewalRequired}
            </span>
          </div>

          <div className="card p-3.5 bg-rose-50 border border-rose-200">
            <span className="text-[10px] font-extrabold text-rose-800 uppercase block">
              Suspended
            </span>
            <span className="text-xl font-black text-rose-900 mt-0.5 block">
              {overview.suspended}
            </span>
          </div>

          <div className="card p-3.5 bg-purple-50 border border-purple-200">
            <span className="text-[10px] font-extrabold text-purple-800 uppercase block">
              Total Members
            </span>
            <span className="text-xl font-black text-purple-900 mt-0.5 block">
              {overview.totalMembers}
            </span>
          </div>

          <div className="card p-3.5 bg-indigo-50 border border-indigo-200">
            <span className="text-[10px] font-extrabold text-indigo-800 uppercase block">
              Upcoming Events
            </span>
            <span className="text-xl font-black text-indigo-900 mt-0.5 block">
              {overview.upcomingEvents}
            </span>
          </div>
        </div>
      )}

      {/* ── Main Navigation Tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab("DIRECTORY")}
          className={clsx(
            "px-3.5 py-2 rounded-xl font-bold transition-all inline-flex items-center gap-1.5 whitespace-nowrap",
            activeTab === "DIRECTORY"
              ? "bg-primary-600 text-white shadow-xs"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          )}
        >
          <Building2 className="w-3.5 h-3.5" />
          Clubs Directory ({clubs?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("MY_CLUBS")}
          className={clsx(
            "px-3.5 py-2 rounded-xl font-bold transition-all inline-flex items-center gap-1.5 whitespace-nowrap",
            activeTab === "MY_CLUBS"
              ? "bg-primary-600 text-white shadow-xs"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          )}
        >
          <Users className="w-3.5 h-3.5 text-indigo-500" />
          My Clubs & Supervisions (
          {(myClubs?.joinedClubs?.length ?? 0) +
            (myClubs?.advisedClubs?.length ?? 0) +
            (myClubs?.ledClubs?.length ?? 0)}
          )
        </button>

        <button
          onClick={() => setActiveTab("CALENDAR")}
          className={clsx(
            "px-3.5 py-2 rounded-xl font-bold transition-all inline-flex items-center gap-1.5 whitespace-nowrap",
            activeTab === "CALENDAR"
              ? "bg-primary-600 text-white shadow-xs"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          )}
        >
          <CalendarDays className="w-3.5 h-3.5 text-purple-500" />
          School Club Calendar
        </button>

        {isAdmin() && (
          <>
            <button
              onClick={() => setActiveTab("PENDING")}
              className={clsx(
                "px-3.5 py-2 rounded-xl font-bold transition-all inline-flex items-center gap-1.5 whitespace-nowrap",
                activeTab === "PENDING"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              )}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Pending Approvals ({pendingClubs.length})
            </button>

            <button
              onClick={() => setActiveTab("RENEWALS")}
              className={clsx(
                "px-3.5 py-2 rounded-xl font-bold transition-all inline-flex items-center gap-1.5 whitespace-nowrap",
                activeTab === "RENEWALS"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
              Academic Year Renewals
            </button>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          1. CLUBS DIRECTORY TAB
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "DIRECTORY" && (
        <div className="space-y-4">
          {/* Category Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CLUB_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  "px-3 py-1.5 rounded-full font-bold transition-all inline-flex items-center gap-1 whitespace-nowrap border text-xs",
                  selectedCategory === cat.id
                    ? "bg-gray-900 text-white border-gray-900 shadow-xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border-gray-200"
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Search & Status Filters */}
          <div className="card p-3 bg-white border border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="relative sm:col-span-2">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                className="input text-xs pl-8 font-medium"
                placeholder="Search clubs by name, mission, keyword, location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-gray-600 whitespace-nowrap">Status:</span>
              <select
                className="input text-xs flex-1"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="RENEWAL_REQUIRED">Renewal Required</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-gray-600 whitespace-nowrap">Year:</span>
              <select
                className="input text-xs flex-1"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="ALL">All Years</option>
                <option value="2025/2026">2025/2026 (Current)</option>
                <option value="2026/2027">2026/2027</option>
                <option value="2024/2025">2024/2025</option>
              </select>
            </div>
          </div>

          {/* Clubs Grid */}
          {clubsLoading ? (
            <PageLoader />
          ) : (clubs ?? []).length === 0 ? (
            <div className="card p-12 text-center bg-white border border-gray-200 space-y-2">
              <Sparkles className="w-10 h-10 text-gray-300 mx-auto" />
              <h3 className="font-bold text-gray-700">No clubs found</h3>
              <p className="text-xs text-gray-400">
                Try selecting a different category or clearing search filters.
              </p>
              <button
                className="btn-secondary btn-sm text-xs inline-flex items-center gap-1 mt-2"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("ALL");
                  setSelectedStatus("ALL");
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clubs.map((club) => {
                const statusCfg = STATUS_CONFIG[club.status] || STATUS_CONFIG.ACTIVE;
                const catObj = CLUB_CATEGORIES.find((c) => c.id === club.category);

                return (
                  <div
                    key={club.id}
                    className="card bg-white border border-gray-200 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      {/* Banner / Header */}
                      <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-xl flex-shrink-0">
                            {catObj?.icon || "✨"}
                          </div>
                          <div>
                            <Link
                              to={`/clubs/${club.id}`}
                              className="font-extrabold text-sm text-gray-900 hover:text-primary-600 transition-colors line-clamp-1"
                            >
                              {club.name}
                            </Link>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mt-0.5">
                              {club.category.replace(/_/g, " ")} • {club.academicYear}
                            </span>
                          </div>
                        </div>

                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap",
                            statusCfg.bg
                          )}
                        >
                          {statusCfg.label}
                        </span>
                      </div>

                      {/* Content Body */}
                      <div className="p-4 space-y-3 text-xs">
                        <p className="text-gray-600 line-clamp-2 leading-relaxed">
                          {club.description || club.purpose}
                        </p>

                        {/* Meeting Schedule & Room */}
                        <div className="p-2.5 bg-gray-50/90 rounded-xl space-y-1 text-[11px]">
                          <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                            <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">
                              {club.preferredMeetingSchedule || "Weekly Meetings"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">
                              {club.meetingLocation || "Campus Hall"}
                            </span>
                          </div>
                        </div>

                        {/* Advisor & Leadership Snapshot */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 text-[11px]">
                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase block">
                              Faculty Advisor
                            </span>
                            <span className="font-bold text-gray-800 truncate block">
                              {club.advisor
                                ? `${club.advisor.firstName} ${club.advisor.lastName}`
                                : "Unassigned"}
                            </span>
                          </div>

                          <div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase block">
                              Student Leaders
                            </span>
                            <span className="font-bold text-gray-800 truncate block">
                              {club.leaders?.length > 0
                                ? `${club.leaders[0].student.firstName} (${club.leaders[0].role})`
                                : "Pending Election"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="p-3.5 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-bold">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span>{club.memberCount} active members</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isStudent() && (
                          <>
                            {club.isMember ? (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-extrabold inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Member
                              </span>
                            ) : club.membershipStatus === "REQUESTED" ? (
                              <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-extrabold">
                                Requested
                              </span>
                            ) : club.status === "ACTIVE" ? (
                              <button
                                className="btn-secondary btn-sm text-[10px] py-1 px-2.5"
                                onClick={() => {
                                  setSelectedClubForJoin(club);
                                  setJoinModalOpen(true);
                                }}
                              >
                                Request Join
                              </button>
                            ) : null}
                          </>
                        )}

                        <Link
                          to={`/clubs/${club.id}`}
                          className="btn-primary btn-sm text-[10px] py-1 px-2.5 inline-flex items-center gap-1"
                        >
                          View Club <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          2. MY CLUBS & SUPERVISIONS TAB
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "MY_CLUBS" && (
        <div className="space-y-6">
          {/* Section 1: Advised Clubs (Teachers/Advisors) */}
          {isTeacher() && (
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary-600" />
                Clubs I Supervise & Advise ({myClubs?.advisedClubs?.length ?? 0})
              </h3>

              {(myClubs?.advisedClubs ?? []).length === 0 ? (
                <div className="card p-6 text-center text-xs text-gray-400 bg-white border border-gray-200">
                  You are not currently assigned as faculty advisor for any clubs.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {myClubs.advisedClubs.map((club) => (
                    <div
                      key={club.id}
                      className="card p-4 bg-white border border-gray-200 hover:border-primary-300 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-extrabold text-sm text-gray-900">
                            {club.name}
                          </h4>
                          <span className="text-[10px] text-gray-500 font-bold uppercase">
                            {club.category} • Advisor
                          </span>
                        </div>
                        <Badge variant="green">Active Supervision</Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
                        <span>{club.member_count} Members</span>
                        {club.pending_requests_count > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                            {club.pending_requests_count} Pending Requests
                          </span>
                        )}
                      </div>

                      <Link
                        to={`/clubs/${club.id}`}
                        className="btn-secondary btn-sm w-full text-center text-xs justify-center"
                      >
                        Supervise & Manage Club
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Student Leadership Roles */}
          {isStudent() && (myClubs?.ledClubs?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                Clubs Where You Serve as Student Leader
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {myClubs.ledClubs.map((club) => (
                  <div
                    key={club.id}
                    className="card p-4 bg-amber-50/60 border border-amber-200 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-amber-950">
                          {club.name}
                        </h4>
                        <span className="text-[10px] text-amber-700 font-bold uppercase">
                          Role: {club.leader_role}
                        </span>
                      </div>
                      <Badge variant="yellow">{club.leader_role}</Badge>
                    </div>

                    <p className="text-xs text-amber-900 line-clamp-2">
                      {club.description || club.purpose}
                    </p>

                    <Link
                      to={`/clubs/${club.id}`}
                      className="btn-primary btn-sm w-full text-center text-xs justify-center"
                    >
                      Open Leader Dashboard
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Joined Memberships */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" />
              Joined Club Memberships ({myClubs?.joinedClubs?.length ?? 0})
            </h3>

            {(myClubs?.joinedClubs ?? []).length === 0 ? (
              <div className="card p-8 text-center bg-white border border-gray-200 space-y-2">
                <Sparkles className="w-8 h-8 text-gray-300 mx-auto" />
                <h4 className="font-bold text-gray-700">No active club memberships</h4>
                <p className="text-xs text-gray-400">
                  Explore the school directory and join exciting academic, sports, arts, or debate clubs!
                </p>
                <button
                  className="btn-primary btn-sm text-xs mt-2"
                  onClick={() => setActiveTab("DIRECTORY")}
                >
                  Explore Clubs Directory
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {myClubs.joinedClubs.map((club) => (
                  <div
                    key={club.id}
                    className="card p-4 bg-white border border-gray-200 hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-900">
                          {club.name}
                        </h4>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">
                          {club.category} • Joined:{" "}
                          {new Date(club.join_date).toLocaleDateString()}
                        </span>
                      </div>
                      <Badge variant="green">Active Member</Badge>
                    </div>

                    <div className="p-2.5 bg-gray-50 rounded-xl text-[11px] text-gray-600 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{club.preferred_meeting_schedule || "Weekly Meetings"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>{club.meeting_location || "Campus Hall"}</span>
                      </div>
                    </div>

                    <Link
                      to={`/clubs/${club.id}`}
                      className="btn-secondary btn-sm w-full text-center text-xs justify-center"
                    >
                      View Club Dashboard
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          3. SCHOOL-WIDE CLUB CALENDAR TAB
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "CALENDAR" && (
        <div className="card bg-white border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-purple-600" />
                School-Wide Club Meetings & Events Calendar
              </h3>
              <p className="text-xs text-gray-500">
                Chronological schedule of all upcoming club meetings, workshops, competitions, and exhibitions.
              </p>
            </div>
          </div>

          {calendarLoading ? (
            <PageLoader />
          ) : (calendarItems ?? []).length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">
              No upcoming club meetings or events scheduled for this period.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {calendarItems.map((item) => (
                <div
                  key={`${item.item_type}-${item.id}`}
                  className="py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0",
                        item.item_type === "EVENT"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      )}
                    >
                      {item.item_type === "EVENT" ? "🏆" : "📅"}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900">
                          {item.title}
                        </span>
                        <Badge
                          variant={item.item_type === "EVENT" ? "purple" : "blue"}
                        >
                          {item.item_type === "EVENT"
                            ? item.type || "Special Event"
                            : "Club Meeting"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        <strong className="text-gray-700">{item.club_name}</strong> •{" "}
                        {new Date(item.date).toLocaleDateString("en", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ({item.start_time} - {item.end_time}) • {item.location}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/clubs/${item.club_id}`}
                    className="btn-secondary btn-sm text-xs py-1 px-3 inline-flex items-center gap-1"
                  >
                    Open Club <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          4. PENDING APPROVALS TAB (Admin Only)
         ══════════════════════════════════════════════════════════════════════════ */}
      {isAdmin() && activeTab === "PENDING" && (
        <div className="space-y-4">
          <div className="card p-4 bg-amber-50/70 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-extrabold text-xs text-amber-900">
                  Club Proposals Awaiting Administrator Approval ({pendingClubs.length})
                </h3>
                <p className="text-xs text-amber-800">
                  Review student and faculty club submissions, verify advisor assignments, and activate clubs.
                </p>
              </div>
            </div>
          </div>

          {pendingClubs.length === 0 ? (
            <div className="card p-12 text-center bg-white border border-gray-200 text-xs text-gray-400">
              ✓ All club proposals have been reviewed! No pending approvals.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingClubs.map((club) => (
                <div
                  key={club.id}
                  className="card p-5 bg-white border border-gray-200 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-base text-gray-900">
                        {club.name}
                      </h4>
                      <span className="text-xs text-gray-500 font-bold uppercase">
                        Category: {club.category} • Year: {club.academicYear}
                      </span>
                    </div>
                    <Badge variant="yellow">Pending Review</Badge>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-gray-700 block">Mission & Purpose:</span>
                      <p className="text-gray-600 bg-gray-50 p-2.5 rounded-xl mt-0.5">
                        {club.purpose || club.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-gray-400 font-bold">Proposed Advisor:</span>
                        <p className="font-bold text-gray-800">
                          {club.advisor
                            ? `${club.advisor.firstName} ${club.advisor.lastName}`
                            : "None Specified"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold">Schedule & Location:</span>
                        <p className="font-bold text-gray-800">
                          {club.preferredMeetingSchedule} ({club.meetingLocation})
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      className="btn-primary btn-sm flex-1 text-xs justify-center"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: club.id,
                          status: "ACTIVE",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Activate
                    </button>

                    <button
                      className="btn-danger btn-sm text-xs justify-center"
                      onClick={() => {
                        setSelectedClubForReview(club);
                        setReviewAction({ status: "REJECTED", reason: "" });
                        setReviewModalOpen(true);
                      }}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          5. ACADEMIC YEAR RENEWALS TAB (Admin Only)
         ══════════════════════════════════════════════════════════════════════════ */}
      {isAdmin() && activeTab === "RENEWALS" && (
        <div className="card bg-white border border-gray-200 p-5 space-y-4">
          <div>
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-blue-600" />
              Academic Year Club Renewal Manager
            </h3>
            <p className="text-xs text-gray-500">
              Manage yearly transitions for school clubs. Preserves all historical attendance, activities, and leadership records while launching fresh memberships.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 uppercase font-bold text-[10px]">
                  <th className="py-2.5 px-3">Club Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Current Year</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Faculty Advisor</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {renewalClubs.map((club) => (
                  <tr key={club.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-bold text-gray-900">
                      {club.name}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="indigo">{club.category}</Badge>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">
                      {club.academicYear}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={club.status === "ACTIVE" ? "green" : "blue"}>
                        {club.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-gray-700">
                      {club.advisor
                        ? `${club.advisor.firstName} ${club.advisor.lastName}`
                        : "Unassigned"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="btn-secondary btn-sm text-[10px] py-1 px-2.5"
                          onClick={() => {
                            setSelectedClubForRenew(club);
                            setRenewForm({
                              newAcademicYear: "2026/2027",
                              newAdvisorId: club.advisor?.id || "",
                              newPresidentId: "",
                              updatedPurpose: club.purpose || "",
                              meetingSchedule: club.preferredMeetingSchedule || "",
                            });
                            setRenewModalOpen(true);
                          }}
                        >
                          <RotateCcw className="w-3 h-3" /> Renew for New Year
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Propose / Create Club ─────────────────────────────────────── */}
      <Modal
        open={proposeModalOpen}
        onClose={() => setProposeModalOpen(false)}
        title={isAdmin() ? "Create New School Club" : "Propose New Extracurricular Club"}
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setProposeModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => proposeMutation.mutate(proposeForm)}
              disabled={
                proposeMutation.isPending ||
                !proposeForm.name.trim() ||
                !proposeForm.purpose.trim()
              }
            >
              <Sparkles className="w-3.5 h-3.5" />
              {proposeMutation.isPending
                ? "Submitting…"
                : isAdmin()
                ? "Create & Launch Club"
                : "Submit Proposal"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Club Name *</label>
            <input
              className="input text-xs"
              placeholder="e.g. Robotics & AI Club, Debate Society, Eco Warriors"
              value={proposeForm.name}
              onChange={(e) =>
                setProposeForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label font-bold">Category *</label>
              <select
                className="input text-xs"
                value={proposeForm.category}
                onChange={(e) =>
                  setProposeForm((f) => ({ ...f, category: e.target.value }))
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
              <label className="label font-bold">Academic Year *</label>
              <input
                className="input text-xs"
                value={proposeForm.academicYear}
                onChange={(e) =>
                  setProposeForm((f) => ({ ...f, academicYear: e.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Mission, Purpose & Goals *</label>
            <textarea
              className="input text-xs min-h-16 resize-none"
              placeholder="Describe the club's objectives, student learning outcomes, and intended activities…"
              value={proposeForm.purpose}
              onChange={(e) =>
                setProposeForm((f) => ({
                  ...f,
                  purpose: e.target.value,
                  description: e.target.value,
                }))
              }
              required
            />
          </div>

          <div>
            <label className="label font-bold">Nominated Faculty Advisor</label>
            <select
              className="input text-xs"
              value={proposeForm.advisorId}
              onChange={(e) =>
                setProposeForm((f) => ({ ...f, advisorId: e.target.value }))
              }
            >
              <option value="">Select Faculty / Staff Advisor</option>
              {(teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName} ({t.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label font-bold">Meeting Schedule</label>
              <input
                className="input text-xs"
                placeholder="e.g. Every Thursday 4:00 PM"
                value={proposeForm.preferredMeetingSchedule}
                onChange={(e) =>
                  setProposeForm((f) => ({
                    ...f,
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
                value={proposeForm.meetingLocation}
                onChange={(e) =>
                  setProposeForm((f) => ({
                    ...f,
                    meetingLocation: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="p-2.5 bg-primary-50 rounded-xl text-[11px] text-primary-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-600 flex-shrink-0" />
            <span>
              {isAdmin()
                ? "As an administrator, this club will immediately be published as ACTIVE."
                : "Your club proposal will be sent to the school administration for review."}
            </span>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Request Membership ────────────────────────────────────────── */}
      <Modal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title={`Join ${selectedClubForJoin?.name}`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setJoinModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() =>
                joinMutation.mutate({
                  clubId: selectedClubForJoin?.id,
                  requestNotes: joinNotes,
                })
              }
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
            You are requesting to join <strong>{selectedClubForJoin?.name}</strong>.
            Your application will be sent to the club advisor and student leadership.
          </p>

          <div>
            <label className="label font-bold">Why would you like to join? (Optional)</label>
            <textarea
              className="input text-xs min-h-16 resize-none"
              placeholder="Mention your interests, skills, or what you hope to achieve in this club…"
              value={joinNotes}
              onChange={(e) => setJoinNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Review / Reject Proposal ──────────────────────────────────── */}
      <Modal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`Reject Club Proposal — ${selectedClubForReview?.name}`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setReviewModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-danger inline-flex items-center gap-1.5"
              onClick={() =>
                updateStatusMutation.mutate({
                  id: selectedClubForReview?.id,
                  status: "REJECTED",
                  reason: reviewAction.reason,
                })
              }
              disabled={updateStatusMutation.isPending || !reviewAction.reason.trim()}
            >
              <XCircle className="w-3.5 h-3.5" />
              Confirm Rejection
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Rejection Feedback / Reason *</label>
            <textarea
              className="input text-xs min-h-20 resize-none"
              placeholder="Explain why this club proposal cannot be approved at this time…"
              value={reviewAction.reason}
              onChange={(e) =>
                setReviewAction((r) => ({ ...r, reason: e.target.value }))
              }
              required
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Academic Year Renewal ─────────────────────────────────────── */}
      <Modal
        open={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        title={`Renew Club — ${selectedClubForRenew?.name}`}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRenewModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() =>
                renewMutation.mutate({
                  clubId: selectedClubForRenew?.id,
                  ...renewForm,
                })
              }
              disabled={renewMutation.isPending || !renewForm.newAcademicYear.trim()}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {renewMutation.isPending ? "Renewing…" : "Confirm Renewal"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-gray-600">
            Renewing will advance <strong>{selectedClubForRenew?.name}</strong> into the new academic year while preserving all past leadership, event, and activity records.
          </p>

          <div>
            <label className="label font-bold">New Academic Year *</label>
            <input
              className="input text-xs"
              value={renewForm.newAcademicYear}
              onChange={(e) =>
                setRenewForm((f) => ({ ...f, newAcademicYear: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <label className="label font-bold">Faculty Advisor</label>
            <select
              className="input text-xs"
              value={renewForm.newAdvisorId}
              onChange={(e) =>
                setRenewForm((f) => ({ ...f, newAdvisorId: e.target.value }))
              }
            >
              <option value="">Keep current / Assign Advisor</option>
              {(teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label font-bold">Meeting Schedule</label>
            <input
              className="input text-xs"
              value={renewForm.meetingSchedule}
              onChange={(e) =>
                setRenewForm((f) => ({ ...f, meetingSchedule: e.target.value }))
              }
              placeholder="e.g. Every Wednesday 4:00 PM"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
