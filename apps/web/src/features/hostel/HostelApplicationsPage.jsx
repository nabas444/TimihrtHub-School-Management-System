import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  User,
  Star,
  Bed,
  Check,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getHostelApplications,
  reviewHostelApplication,
  getHostels,
  manualAllocate,
} from "./hostelApi";

export default function HostelApplicationsPage() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeApplication, setActiveApplication] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: applicationsRes, isLoading } = useQuery({
    queryKey: ["hostel-applications", selectedStatus],
    queryFn: () =>
      getHostelApplications({
        status: selectedStatus === "ALL" ? undefined : selectedStatus,
      }),
  });

  const applications = applicationsRes?.data || [];

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, notes }) =>
      reviewHostelApplication(id, { status, reviewNotes: notes }),
    onSuccess: () => {
      toast.success("Application review submitted");
      setActiveApplication(null);
      setReviewNotes("");
      queryClient.invalidateQueries(["hostel-applications"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit review");
    },
  });

  const filteredApps = applications.filter((app) => {
    if (!searchTerm) return true;
    const name = `${app.studentProfile?.user?.firstName || ""} ${app.studentProfile?.user?.lastName || ""}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Hostel Applications & Intake Queue
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review student applications and prioritized admission requests
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="WAITLISTED">Waitlisted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-750 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Priority Score</th>
                <th className="px-6 py-4">Preferences</th>
                <th className="px-6 py-4">Special / Medical Notes</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center font-bold">
                        {app.studentProfile?.user?.firstName?.[0] || "S"}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {app.studentProfile?.user?.firstName} {app.studentProfile?.user?.lastName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {app.studentProfile?.class?.name || "General"} • {app.studentProfile?.user?.gender}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold rounded-lg text-xs">
                      <Star className="w-3 h-3 fill-current" />
                      {app.priorityScore} pts
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                      {app.preferredRoomType || "Any Room Type"}
                    </p>
                    {app.roommatePreference && (
                      <p className="text-xs text-indigo-500">Pair: {app.roommatePreference}</p>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <p className="text-xs text-gray-500 max-w-xs truncate">
                      {app.medicalNotes || app.specialRequests || "None"}
                    </p>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        app.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : app.status === "WAITLISTED"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : app.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}
                    >
                      {app.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setActiveApplication(app);
                        }}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs font-medium transition"
                      >
                        Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {activeApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Review Application
            </h3>

            <p className="text-sm text-gray-500">
              Student: <span className="font-semibold text-gray-900 dark:text-white">{activeApplication.studentProfile?.user?.firstName} {activeApplication.studentProfile?.user?.lastName}</span>
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Review Notes / Decision Remarks
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Enter notes for student..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setActiveApplication(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    reviewMutation.mutate({
                      id: activeApplication.id,
                      status: "REJECTED",
                      notes: reviewNotes,
                    })
                  }
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
                >
                  Reject
                </button>
                <button
                  onClick={() =>
                    reviewMutation.mutate({
                      id: activeApplication.id,
                      status: "WAITLISTED",
                      notes: reviewNotes,
                    })
                  }
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold"
                >
                  Waitlist
                </button>
                <button
                  onClick={() =>
                    reviewMutation.mutate({
                      id: activeApplication.id,
                      status: "APPROVED",
                      notes: reviewNotes,
                    })
                  }
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
