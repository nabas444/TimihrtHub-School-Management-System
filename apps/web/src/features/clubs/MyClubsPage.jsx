import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  Award,
  Calendar,
  CalendarDays,
  Sparkles,
  ChevronRight,
  Plus,
} from "lucide-react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import StatCard from "../../components/shared/StatCard";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, EmptyState } from "../../components/ui/index";
import { STATUS_CONFIG } from "./clubConstants";
import ProposeClubModal from "./components/ProposeClubModal";
import clsx from "clsx";

export default function MyClubsPage() {
  const { user, isAdmin } = useAuthStore();
  const [proposeModalOpen, setProposeModalOpen] = useState(false);

  const { data: myClubsData, isLoading: myClubsLoading } = useQuery({
    queryKey: ["my-clubs"],
    queryFn: () => api.get("/clubs/my").then((r) => r.data.data),
  });

  const myClubs = myClubsData?.clubs ?? [];
  const myLeadership = myClubsData?.leadership ?? [];
  const myUpcomingMeetings = myClubsData?.upcomingMeetings ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">My Clubs & Extracurricular Activities</h1>
          <p className="page-subtitle">
            View the clubs you are actively enrolled in, leadership roles you hold, and your upcoming meeting calendar.
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
          icon={Users}
          label="My Enrolled Clubs"
          value={myClubs.length}
          color="indigo"
        />
        <StatCard
          icon={Award}
          label="Clubs I Lead / Officer"
          value={myLeadership.length}
          color="amber"
        />
        <StatCard
          icon={Calendar}
          label="Upcoming Meetings"
          value={myUpcomingMeetings.length}
          color="green"
        />
        <StatCard
          icon={CalendarDays}
          label="Club Events & Contests"
          value={myClubsData?.upcomingEvents?.length ?? 0}
          color="blue"
        />
      </div>

      {/* My Clubs Content */}
      {myClubsLoading ? (
        <PageLoader />
      ) : myClubs.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-gray-200 space-y-4">
          <EmptyState
            icon={Sparkles}
            title="You haven't joined any clubs yet"
            description="Explore our rich catalog of extracurricular activities, STEM clubs, debate, and music societies."
          />
          <Link to="/clubs/directory" className="btn-primary inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Browse Clubs Directory
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myClubs.map((club) => {
              const myRoleInClub = myLeadership.find(
                (l) => l.clubId === club.id,
              );
              const statusStyle =
                STATUS_CONFIG[club.status] || STATUS_CONFIG.ACTIVE;

              return (
                <div
                  key={club.id}
                  className="card bg-white border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    <div className="p-4 bg-gradient-to-r from-primary-50 via-indigo-50/50 to-white border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="indigo">{club.category}</Badge>
                        {myRoleInClub && (
                          <Badge variant="amber">
                            👑 {myRoleInClub.role}
                          </Badge>
                        )}
                      </div>
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          statusStyle.bg,
                        )}
                      >
                        {statusStyle.label}
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-extrabold text-base text-gray-900 leading-snug">
                          {club.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {club.purpose || club.description}
                        </p>
                      </div>

                      <div className="p-2.5 bg-gray-50 rounded-xl text-xs space-y-1 text-gray-600">
                        {club.preferredMeetingSchedule && (
                          <p className="truncate">
                            🕒 Schedule:{" "}
                            <strong>{club.preferredMeetingSchedule}</strong>
                          </p>
                        )}
                        {club.meetingLocation && (
                          <p className="truncate">
                            📍 Room: <strong>{club.meetingLocation}</strong>
                          </p>
                        )}
                        {club.advisor && (
                          <p className="truncate">
                            👨‍🏫 Advisor:{" "}
                            <strong>
                              {club.advisor.firstName} {club.advisor.lastName}
                            </strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0 border-t border-gray-100 mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-semibold">
                      {club._count?.members || 0} Members
                    </span>
                    <Link
                      to={`/clubs/${club.id}`}
                      className="btn-primary btn-sm text-xs inline-flex items-center gap-1 mt-3"
                    >
                      Open Club Hub <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Propose Club Modal */}
      <ProposeClubModal
        open={proposeModalOpen}
        onClose={() => setProposeModalOpen(false)}
      />
    </div>
  );
}
