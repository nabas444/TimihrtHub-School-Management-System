import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  ShieldAlert,
  Repeat,
  CheckCircle,
  Plus,
  AlertTriangle,
  Clock,
  DollarSign,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getMaintenanceTickets,
  updateMaintenanceTicket,
  createMaintenanceTicket,
  getIncidentReports,
  createIncidentReport,
  getTransferRequests,
  decideTransferRequest,
} from "./hostelApi";

export default function HostelCarePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("maintenance");

  // 1. Maintenance
  const { data: ticketsRes } = useQuery({
    queryKey: ["hostel-maintenance"],
    queryFn: () => getMaintenanceTickets(),
  });
  const tickets = ticketsRes?.data || [];

  const resolveTicketMutation = useMutation({
    mutationFn: ({ id, cost }) =>
      updateMaintenanceTicket(id, { status: "RESOLVED", cost }),
    onSuccess: () => {
      toast.success("Maintenance ticket marked as resolved!");
      queryClient.invalidateQueries(["hostel-maintenance"]);
    },
  });

  // 2. Incident Reports
  const { data: incidentsRes } = useQuery({
    queryKey: ["hostel-incidents"],
    queryFn: () => getIncidentReports(),
  });
  const incidents = incidentsRes?.data || [];

  // 3. Transfer Requests
  const { data: transfersRes } = useQuery({
    queryKey: ["hostel-transfers"],
    queryFn: () => getTransferRequests(),
  });
  const transfers = transfersRes?.data || [];

  const decideTransferMutation = useMutation({
    mutationFn: ({ id, status, toBedId }) =>
      decideTransferRequest(id, { status, toBedId }),
    onSuccess: (res) => {
      toast.success("Transfer request processed!");
      queryClient.invalidateQueries(["hostel-transfers"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to decide transfer");
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Care, Maintenance & Residential Life
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Track maintenance requests, residential incidents, and student room transfers
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab("maintenance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "maintenance"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100"
          }`}
        >
          <Wrench className="w-4 h-4" />
          Maintenance Tickets
        </button>

        <button
          onClick={() => setActiveTab("incidents")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "incidents"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Incident Reports
        </button>

        <button
          onClick={() => setActiveTab("transfers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "transfers"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100"
          }`}
        >
          <Repeat className="w-4 h-4" />
          Room Transfers
        </button>
      </div>

      {/* TAB 1: MAINTENANCE */}
      {activeTab === "maintenance" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Maintenance Tickets</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3 bg-gray-50/50 dark:bg-gray-750"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white">
                    Room {t.room?.roomNumber} ({t.room?.block?.name})
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      t.priority === "URGENT"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {t.priority}
                  </span>
                </div>

                <p className="text-xs font-semibold text-indigo-600 uppercase">{t.category}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{t.description}</p>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600 text-xs">
                  <span className="font-medium text-gray-500">Status: {t.status}</span>
                  {t.status !== "RESOLVED" && t.status !== "CLOSED" && (
                    <button
                      onClick={() => resolveTicketMutation.mutate({ id: t.id, cost: 0 })}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: INCIDENTS */}
      {activeTab === "incidents" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Residential Incident Log</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-750 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-3">Resident</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Action Taken</th>
                  <th className="px-4 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {inc.allocation?.studentProfile?.user?.firstName}{" "}
                      {inc.allocation?.studentProfile?.user?.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          inc.severity === "CRITICAL" || inc.severity === "SEVERE"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-sm">
                      {inc.description}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{inc.actionTaken || "None"}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                      {new Date(inc.occurredAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRANSFERS */}
      {activeTab === "transfers" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Room Transfer Requests</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-750 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Current Room</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {transfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {tr.studentProfile?.user?.firstName} {tr.studentProfile?.user?.lastName}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      Room {tr.fromAllocation?.bed?.room?.roomNumber} [{tr.fromAllocation?.bed?.room?.block?.name}]
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 max-w-sm">
                      {tr.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          tr.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : tr.status === "REJECTED"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {tr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tr.status === "PENDING" && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              decideTransferMutation.mutate({
                                id: tr.id,
                                status: "REJECTED",
                              })
                            }
                            className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-medium"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
