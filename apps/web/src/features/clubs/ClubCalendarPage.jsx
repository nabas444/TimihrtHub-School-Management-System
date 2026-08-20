import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, EmptyState } from "../../components/ui/index";

export default function ClubCalendarPage() {
  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ["upcoming-club-events"],
    queryFn: () => api.get("/clubs/events/upcoming").then((r) => r.data.data),
  });

  const meetings = upcomingData?.meetings ?? [];
  const events = upcomingData?.events ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Club Schedule & Upcoming Events</h1>
          <p className="page-subtitle">
            Never miss a meeting, workshop, or competition. Overview of scheduled sessions across all student clubs.
          </p>
        </div>
      </div>

      {upcomingLoading ? (
        <PageLoader />
      ) : meetings.length === 0 && events.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-gray-200">
          <EmptyState
            icon={CalendarDays}
            title="No scheduled meetings or events"
            description="Upcoming club meetings, competitions, workshops, and guest lectures will show up here."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Meetings List */}
          <div className="card bg-white border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600" />
                Scheduled Club Meetings ({meetings.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 p-2">
              {meetings.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  No upcoming meetings scheduled.
                </div>
              ) : (
                meetings.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 hover:bg-gray-50/60 rounded-xl transition-all flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full uppercase">
                        {m.club?.name}
                      </span>
                      <h4 className="font-bold text-sm text-gray-900 mt-1">
                        {m.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {new Date(m.date).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {m.startTime} – {m.endTime}
                        </span>
                        {m.location && (
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {m.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      to={`/clubs/${m.clubId}`}
                      className="btn-ghost btn-sm text-xs p-2 text-primary-600 hover:bg-primary-50 rounded-lg flex-shrink-0"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Events & Workshops List */}
          <div className="card bg-white border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Workshops, Competitions & Events ({events.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 p-2">
              {events.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  No upcoming major events or competitions.
                </div>
              ) : (
                events.map((e) => (
                  <div
                    key={e.id}
                    className="p-3.5 hover:bg-gray-50/60 rounded-xl transition-all flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full uppercase">
                          {e.club?.name}
                        </span>
                        <Badge variant="purple">{e.eventType}</Badge>
                      </div>
                      <h4 className="font-bold text-sm text-gray-900 mt-1">
                        {e.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {e.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {new Date(e.date).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {e.startTime} – {e.endTime}
                        </span>
                        {e.location && (
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {e.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      to={`/clubs/${e.clubId}`}
                      className="btn-ghost btn-sm text-xs p-2 text-primary-600 hover:bg-primary-50 rounded-lg flex-shrink-0"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
