import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Search,
  Users,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  UserCheck,
  Plus,
  BookOpen,
} from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import StatCard from "../../components/shared/StatCard";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, Avatar, EmptyState } from "../../components/ui/index";
import { CLUB_CATEGORIES, STATUS_CONFIG } from "./clubConstants";
import ProposeClubModal from "./components/ProposeClubModal";
import JoinClubModal from "./components/JoinClubModal";
import clsx from "clsx";

export default function ClubDirectoryPage() {
  const { user, isAdmin, isTeacher, isStudent } = useAuthStore();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");

  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedClubForJoin, setSelectedClubForJoin] = useState(null);

  const { data: clubs, isLoading: clubsLoading } = useQuery({
    queryKey: ["clubs", selectedCategory, selectedStatus, selectedYear, search],
    queryFn: () =>
      api
        .get(
          `/clubs?category=${selectedCategory}&status=${selectedStatus}&academicYear=${selectedYear}&search=${encodeURIComponent(
            search,
          )}`,
        )
        .then((r) => r.data.data),
  });

  const allClubs = clubs ?? [];

  const filteredClubs = useMemo(() => {
    return allClubs.filter((c) => {
      if (selectedCategory !== "ALL" && c.category !== selectedCategory) return false;
      if (selectedStatus !== "ALL" && c.status !== selectedStatus) return false;
      if (selectedYear !== "ALL" && c.academicYear !== selectedYear) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = c.name?.toLowerCase().includes(q);
        const matchDesc = c.description?.toLowerCase().includes(q);
        const matchAdv = `${c.advisor?.firstName || ""} ${c.advisor?.lastName || ""}`
          .toLowerCase()
          .includes(q);
        if (!matchName && !matchDesc && !matchAdv) return false;
      }
      return true;
    });
  }, [allClubs, selectedCategory, selectedStatus, selectedYear, search]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Extracurricular Clubs & Societies</h1>
          <p className="page-subtitle">
            Explore student organizations, join STEM & Arts societies, attend workshops, and develop leadership skills.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={() => setProposeModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            {isAdmin() ? "Create New Club" : "Propose New Club"}
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={Sparkles}
          label="Active School Clubs"
          value={allClubs.filter((c) => c.status === "ACTIVE").length}
          color="indigo"
        />
        <StatCard
          icon={BookOpen}
          label="Academic & STEM"
          value={
            allClubs.filter((c) =>
              ["SCIENCE", "TECHNOLOGY", "MATHEMATICS", "ACADEMIC"].includes(
                c.category,
              ),
            ).length
          }
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Arts & Sports"
          value={
            allClubs.filter((c) =>
              ["ARTS", "MUSIC", "SPORTS", "DEBATE", "CULTURE"].includes(
                c.category,
              ),
            ).length
          }
          color="green"
        />
        <StatCard
          icon={Users}
          label="Total Student Members"
          value={allClubs.reduce((sum, c) => sum + (c._count?.members || 0), 0)}
          color="purple"
        />
      </div>

      {/* Category Pills & Filters */}
      <div className="card p-3 bg-gray-50/70 border border-gray-200 space-y-3">
        {/* Category Horizontal Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {CLUB_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  "px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap inline-flex items-center gap-1.5",
                  isSelected
                    ? "bg-primary-600 text-white shadow-xs"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Status Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              className="input text-xs pl-8"
              placeholder="Search clubs by name, description, advisor…"
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
              {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                <option key={k} value={k}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-gray-600 whitespace-nowrap">Year:</span>
            <select
              className="input text-xs flex-1"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="ALL">All Academic Years</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2024/2025">2024/2025</option>
            </select>
          </div>
        </div>
      </div>

      {/* Clubs Grid */}
      {clubsLoading ? (
        <PageLoader />
      ) : filteredClubs.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-gray-200">
          <EmptyState
            icon={Sparkles}
            title="No clubs found"
            description="Try selecting a different category, clearing your search query, or propose a new club!"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClubs.map((club) => {
            const statusStyle = STATUS_CONFIG[club.status] || STATUS_CONFIG.ACTIVE;
            const isMember = club.members?.some(
              (m) => m.student?.userId === user?.id,
            );

            return (
              <div
                key={club.id}
                className="card bg-white border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all flex flex-col overflow-hidden"
              >
                {/* Banner / Category Header */}
                <div className="h-20 bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 p-4 relative flex items-start justify-between text-white">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/20 backdrop-blur-xs text-white border border-white/20">
                    {club.category}
                  </span>
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      statusStyle.bg,
                    )}
                  >
                    {statusStyle.label}
                  </span>
                </div>

                <div className="p-4 pt-3 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-base text-gray-900 leading-snug">
                        {club.name}
                      </h3>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                        Year: {club.academicYear}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed">
                    {club.purpose || club.description}
                  </p>

                  <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100 text-xs">
                    {club.advisor && (
                      <div className="flex items-center gap-1.5 text-gray-600 text-[11px]">
                        <UserCheck className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                        <span className="truncate">
                          Advisor:{" "}
                          <strong>
                            {club.advisor.firstName} {club.advisor.lastName}
                          </strong>
                        </span>
                      </div>
                    )}
                    {club.preferredMeetingSchedule && (
                      <div className="flex items-center gap-1.5 text-gray-600 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="truncate">
                          {club.preferredMeetingSchedule}
                        </span>
                      </div>
                    )}
                    {club.meetingLocation && (
                      <div className="flex items-center gap-1.5 text-gray-600 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        <span className="truncate">{club.meetingLocation}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-600">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span>{club._count?.members || 0} Members</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isStudent() && !isMember && club.status === "ACTIVE" && (
                        <button
                          className="btn-secondary btn-sm text-[11px] py-1 px-2.5"
                          onClick={() => {
                            setSelectedClubForJoin(club);
                            setJoinModalOpen(true);
                          }}
                        >
                          Join Club
                        </button>
                      )}

                      <Link
                        to={`/clubs/${club.id}`}
                        className="btn-primary btn-sm text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                      >
                        View Club <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Propose Club Modal */}
      <ProposeClubModal
        open={proposeModalOpen}
        onClose={() => setProposeModalOpen(false)}
      />

      {/* Join Club Modal */}
      <JoinClubModal
        open={joinModalOpen}
        onClose={() => {
          setJoinModalOpen(false);
          setSelectedClubForJoin(null);
        }}
        club={selectedClubForJoin}
      />
    </div>
  );
}
