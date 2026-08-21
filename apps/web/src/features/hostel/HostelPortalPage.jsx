import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Bed,
  Users,
  Compass,
  FileText,
  Repeat,
  Plus,
  Send,
  CheckCircle,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../store/authStore";
import {
  getHostels,
  submitHostelApplication,
  createOutpass,
  createTransferRequest,
  getStudentAllocationHistory,
  getOutpasses,
} from "./hostelApi";

export default function HostelPortalPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const studentProfileId = user?.studentProfile?.id || user?.id;

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showOutpassModal, setShowOutpassModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const [applyForm, setApplyForm] = useState({
    preferredRoomType: "DOUBLE",
    medicalNotes: "",
    specialRequests: "",
    roommatePreference: "",
  });

  const [outpassForm, setOutpassForm] = useState({
    type: "DAY",
    fromDateTime: "",
    expectedReturnAt: "",
    destination: "",
    reason: "",
  });

  const [transferReason, setTransferReason] = useState("");

  // Student Allocation History & Current Active Bed
  const { data: historyRes } = useQuery({
    queryKey: ["student-hostel-history", studentProfileId],
    queryFn: () => getStudentAllocationHistory(studentProfileId),
    enabled: Boolean(studentProfileId),
  });

  const allocations = historyRes?.data || [];
  const activeAllocation = allocations.find((a) => a.status === "ACTIVE");

  // Student Outpass History
  const { data: outpassesRes } = useQuery({
    queryKey: ["student-outpasses", studentProfileId],
    queryFn: () => getOutpasses({ studentProfileId }),
    enabled: Boolean(studentProfileId),
  });
  const myOutpasses = outpassesRes?.data || [];

  // Submit Application Mutation
  const applyMutation = useMutation({
    mutationFn: (data) =>
      submitHostelApplication({
        studentProfileId,
        ...data,
      }),
    onSuccess: () => {
      toast.success("Hostel application submitted successfully!");
      setShowApplyModal(false);
      queryClient.invalidateQueries(["student-hostel-history", studentProfileId]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit application");
    },
  });

  // Request Outpass Mutation
  const outpassMutation = useMutation({
    mutationFn: (data) =>
      createOutpass({
        allocationId: activeAllocation.id,
        ...data,
      }),
    onSuccess: () => {
      toast.success("Outpass request submitted to warden!");
      setShowOutpassModal(false);
      queryClient.invalidateQueries(["student-outpasses"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to request outpass");
    },
  });

  // Request Transfer Mutation
  const transferMutation = useMutation({
    mutationFn: (reason) =>
      createTransferRequest({
        fromAllocationId: activeAllocation.id,
        reason,
      }),
    onSuccess: () => {
      toast.success("Room transfer request submitted!");
      setShowTransferModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit transfer request");
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              My Hostel & Residential Portal
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your room assignment, outpasses, and dormitory services
            </p>
          </div>
        </div>

        {!activeAllocation && (
          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Apply for Hostel
          </button>
        )}
      </div>

      {/* Current Room Status Card */}
      {activeAllocation ? (
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-6 rounded-2xl shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
              Active Resident
            </span>
            <span className="text-xs text-white/80">
              Checked In: {activeAllocation.checkedInAt ? new Date(activeAllocation.checkedInAt).toLocaleDateString() : "Pending"}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-bold">{activeAllocation.hostel?.name}</h2>
            <p className="text-indigo-100 mt-1">
              Block: <span className="font-semibold">{activeAllocation.bed?.room?.block?.name}</span> • Room:{" "}
              <span className="font-semibold">{activeAllocation.bed?.room?.roomNumber}</span> • Bed:{" "}
              <span className="font-semibold">{activeAllocation.bed?.bedNumber}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setShowOutpassModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Compass className="w-4 h-4" />
              Request Outpass
            </button>

            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold transition"
            >
              <Repeat className="w-4 h-4" />
              Request Room Transfer
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center space-y-3">
          <Bed className="w-12 h-12 text-gray-400 mx-auto" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            No Active Hostel Allocation
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            You do not currently occupy a dormitory room. Submit an intake application to request placement for the upcoming academic term.
          </p>
        </div>
      )}

      {/* Outpass History Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">My Outpasses</h3>
        {myOutpasses.length === 0 ? (
          <p className="text-sm text-gray-400">No outpasses requested yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-750 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {myOutpasses.map((op) => (
                  <tr key={op.id}>
                    <td className="px-4 py-3 font-semibold">{op.type}</td>
                    <td className="px-4 py-3">{op.destination}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(op.fromDateTime).toLocaleDateString()} – {new Date(op.expectedReturnAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          op.status === "APPROVED" || op.status === "RETURNED"
                            ? "bg-emerald-100 text-emerald-700"
                            : op.status === "OUT"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {op.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Hostel Accommodation Application
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Preferred Room Type
              </label>
              <select
                value={applyForm.preferredRoomType}
                onChange={(e) => setApplyForm({ ...applyForm, preferredRoomType: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
              >
                <option value="SINGLE">Single Room</option>
                <option value="DOUBLE">Double Sharing</option>
                <option value="TRIPLE">Triple Sharing</option>
                <option value="QUAD">Quad (4 Beds)</option>
                <option value="DORMITORY">Large Dormitory</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Medical & Accessibility Requirements (adds +50 Priority)
              </label>
              <textarea
                value={applyForm.medicalNotes}
                onChange={(e) => setApplyForm({ ...applyForm, medicalNotes: e.target.value })}
                placeholder="Allergies, chronic conditions, wheelchair ground floor requirement..."
                rows={2}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Roommate Preference (Optional)
              </label>
              <input
                type="text"
                value={applyForm.roommatePreference}
                onChange={(e) => setApplyForm({ ...applyForm, roommatePreference: e.target.value })}
                placeholder="Student Name or ID..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => applyMutation.mutate(applyForm)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
              >
                Submit Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outpass Modal */}
      {showOutpassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Request Outpass</h3>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select
                value={outpassForm.type}
                onChange={(e) => setOutpassForm({ ...outpassForm, type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 rounded-xl text-sm"
              >
                <option value="DAY">Day Pass</option>
                <option value="WEEKEND">Weekend Pass</option>
                <option value="EMERGENCY">Emergency / Medical Pass</option>
                <option value="VACATION">Vacation / Term Break</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">From Date & Time</label>
              <input
                type="datetime-local"
                value={outpassForm.fromDateTime}
                onChange={(e) => setOutpassForm({ ...outpassForm, fromDateTime: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Expected Return Date & Time</label>
              <input
                type="datetime-local"
                value={outpassForm.expectedReturnAt}
                onChange={(e) => setOutpassForm({ ...outpassForm, expectedReturnAt: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Destination</label>
              <input
                type="text"
                value={outpassForm.destination}
                onChange={(e) => setOutpassForm({ ...outpassForm, destination: e.target.value })}
                placeholder="Home, hospital, family event..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Reason</label>
              <textarea
                value={outpassForm.reason}
                onChange={(e) => setOutpassForm({ ...outpassForm, reason: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-xl text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setShowOutpassModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={() => outpassMutation.mutate(outpassForm)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold">Submit Outpass</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
