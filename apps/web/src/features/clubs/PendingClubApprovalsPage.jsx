import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, EmptyState } from "../../components/ui/index";
import ReviewProposalModal from "./components/ReviewProposalModal";
import toast from "react-hot-toast";

export default function PendingClubApprovalsPage() {
  const qc = useQueryClient();
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedClubForReview, setSelectedClubForReview] = useState(null);

  const { data: pendingClubsData, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-clubs"],
    queryFn: () =>
      api.get("/clubs?status=PENDING_APPROVAL").then((r) => r.data.data),
  });

  const pendingClubs = pendingClubsData ?? [];

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }) =>
      api.patch(`/clubs/${id}/status`, { status, reviewNotes: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clubs"] });
      qc.invalidateQueries({ queryKey: ["pending-clubs"] });
      toast.success("Club proposal status updated successfully!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update proposal");
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Pending Club Approval Requests</h1>
          <p className="page-subtitle">
            Review student and faculty club charter applications, evaluate advisors, and approve official clubs.
          </p>
        </div>
      </div>

      {pendingLoading ? (
        <PageLoader />
      ) : pendingClubs.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-gray-200">
          <EmptyState
            icon={ShieldCheck}
            title="All caught up!"
            description="There are currently no student club proposals waiting for administrative approval."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {pendingClubs.map((club) => (
            <div
              key={club.id}
              className="card p-5 bg-white border border-amber-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                    PENDING APPROVAL
                  </span>
                  <Badge variant="indigo">{club.category}</Badge>
                  <span className="text-xs text-gray-500 font-mono">
                    Year: {club.academicYear}
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-gray-900">
                  {club.name}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {club.purpose || club.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap pt-1">
                  {club.advisor && (
                    <span>
                      Faculty Advisor:{" "}
                      <strong className="text-gray-700">
                        {club.advisor.firstName} {club.advisor.lastName}
                      </strong>
                    </span>
                  )}
                  {club.preferredMeetingSchedule && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {club.preferredMeetingSchedule}
                    </span>
                  )}
                  {club.meetingLocation && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {club.meetingLocation}
                    </span>
                  )}
                  {club.expectedMembership && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      Exp. {club.expectedMembership} students
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  className="btn-secondary btn-sm text-xs inline-flex items-center gap-1 text-rose-600 hover:bg-rose-50 border-rose-200"
                  onClick={() => {
                    setSelectedClubForReview(club);
                    setReviewModalOpen(true);
                  }}
                  disabled={updateStatusMutation.isPending}
                >
                  <XCircle className="w-4 h-4" /> Reject Proposal
                </button>

                <button
                  className="btn-primary btn-sm text-xs inline-flex items-center gap-1"
                  onClick={() =>
                    updateStatusMutation.mutate({
                      id: club.id,
                      status: "ACTIVE",
                      reason: "Approved by administration.",
                    })
                  }
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve & Activate Club
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Proposal Modal */}
      <ReviewProposalModal
        open={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setSelectedClubForReview(null);
        }}
        club={selectedClubForReview}
      />
    </div>
  );
}
