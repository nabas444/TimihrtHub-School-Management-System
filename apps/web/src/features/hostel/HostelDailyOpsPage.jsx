import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Moon,
  Compass,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  LogIn,
  LogOut,
  Plus,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getHostels,
  getNightAttendanceGrid,
  recordNightAttendance,
  getOutpasses,
  scanGateOut,
  scanGateIn,
  getVisitorLogs,
  logVisitorCheckIn,
  logVisitorCheckOut,
} from "./hostelApi";

export default function HostelDailyOpsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("rollcall");
  const [selectedHostelId, setSelectedHostelId] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [attendanceEdits, setAttendanceEdits] = useState({});
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    studentProfileId: "",
    visitorName: "",
    relationToStudent: "",
    purpose: "",
  });

  const { data: hostelsRes } = useQuery({
    queryKey: ["hostels"],
    queryFn: () => getHostels(),
  });
  const hostels = hostelsRes?.data || [];
  const activeHostelId = selectedHostelId || hostels[0]?.id;

  // 1. Night Attendance Query
  const { data: attendanceRes, isLoading: loadingAttendance } = useQuery({
    queryKey: ["hostel-night-attendance", activeHostelId, attendanceDate],
    queryFn: () => getNightAttendanceGrid(activeHostelId, { date: attendanceDate }),
    enabled: Boolean(activeHostelId),
  });
  const attendanceList = attendanceRes?.data || [];

  // Save Attendance Mutation
  const saveAttendanceMutation = useMutation({
    mutationFn: () => {
      const records = attendanceList.map((item) => ({
        allocationId: item.allocationId,
        status: attendanceEdits[item.allocationId] || item.status,
      }));
      return recordNightAttendance(activeHostelId, {
        date: attendanceDate,
        records,
      });
    },
    onSuccess: () => {
      toast.success("Night roll call recorded successfully!");
      queryClient.invalidateQueries(["hostel-night-attendance", activeHostelId, attendanceDate]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save roll call");
    },
  });

  // 2. Outpasses Query
  const { data: outpassesRes } = useQuery({
    queryKey: ["hostel-outpasses", activeHostelId],
    queryFn: () => getOutpasses({ hostelId: activeHostelId }),
    enabled: Boolean(activeHostelId),
  });
  const outpasses = outpassesRes?.data || [];

  const gateOutMutation = useMutation({
    mutationFn: (id) => scanGateOut(id),
    onSuccess: () => {
      toast.success("Student gated OUT");
      queryClient.invalidateQueries(["hostel-outpasses"]);
    },
  });

  const gateInMutation = useMutation({
    mutationFn: (id) => scanGateIn(id),
    onSuccess: () => {
      toast.success("Student gated IN (Returned)");
      queryClient.invalidateQueries(["hostel-outpasses"]);
    },
  });

  // 3. Visitor Logs Query
  const { data: visitorsRes } = useQuery({
    queryKey: ["hostel-visitors"],
    queryFn: () => getVisitorLogs(),
  });
  const visitors = visitorsRes?.data || [];

  const visitorCheckInMutation = useMutation({
    mutationFn: (data) => logVisitorCheckIn(data),
    onSuccess: () => {
      toast.success("Visitor arrival logged");
      setShowVisitorModal(false);
      queryClient.invalidateQueries(["hostel-visitors"]);
    },
  });

  const visitorCheckOutMutation = useMutation({
    mutationFn: (id) => logVisitorCheckOut(id),
    onSuccess: () => {
      toast.success("Visitor checked out");
      queryClient.invalidateQueries(["hostel-visitors"]);
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Daily Hostel Operations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Night roll call, outpass gate scanner & visitor registry
          </p>
        </div>

        {/* Hostel Selector */}
        <select
          value={activeHostelId || ""}
          onChange={(e) => setSelectedHostelId(e.target.value)}
          className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {hostels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab("rollcall")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "rollcall"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          <Moon className="w-4 h-4" />
          Night Roll Call
        </button>

        <button
          onClick={() => setActiveTab("outpasses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "outpasses"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          <Compass className="w-4 h-4" />
          Outpasses & Gate Scanner
        </button>

        <button
          onClick={() => setActiveTab("visitors")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "visitors"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          <Users className="w-4 h-4" />
          Visitor Registry
        </button>
      </div>

      {/* TAB 1: NIGHT ROLL CALL */}
      {activeTab === "rollcall" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white"
              />
            </div>

            <button
              onClick={() => saveAttendanceMutation.mutate()}
              disabled={saveAttendanceMutation.isPending}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              {saveAttendanceMutation.isPending ? "Saving..." : "Save Roll Call"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-750 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Outpass Status</th>
                  <th className="px-4 py-3 text-right">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {attendanceList.map((row) => {
                  const currentStatus = attendanceEdits[row.allocationId] || row.status;
                  return (
                    <tr key={row.allocationId} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                        {row.blockName} • Rm {row.roomNumber} [{row.bedNumber}]
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{row.studentName}</p>
                        <p className="text-xs text-gray-400">{row.className || "Resident"}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.activeOutpass ? (
                          <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full font-medium">
                            On Outpass ({row.activeOutpass.destination})
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">On Campus</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <select
                          value={currentStatus}
                          onChange={(e) =>
                            setAttendanceEdits({
                              ...attendanceEdits,
                              [row.allocationId]: e.target.value,
                            })
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                            currentStatus === "PRESENT"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : currentStatus === "ABSENT"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-purple-50 text-purple-700 border-purple-200"
                          }`}
                        >
                          <option value="PRESENT">PRESENT</option>
                          <option value="ABSENT">ABSENT</option>
                          <option value="ON_OUTPASS">ON OUTPASS</option>
                          <option value="SICK_BAY">SICK BAY</option>
                          <option value="LATE">LATE</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: OUTPASSES & SCANNER */}
      {activeTab === "outpasses" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active & Pending Outpasses</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-750 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Type & Destination</th>
                  <th className="px-4 py-3">Expected Return</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Gate Scanner Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {outpasses.map((op) => (
                  <tr key={op.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {op.allocation?.studentProfile?.user?.firstName}{" "}
                        {op.allocation?.studentProfile?.user?.lastName}
                      </p>
                      <p className="text-xs text-gray-400">
                        Room {op.allocation?.bed?.room?.roomNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{op.destination}</p>
                      <p className="text-xs text-gray-400">{op.type}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(op.expectedReturnAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          op.status === "OUT"
                            ? "bg-blue-100 text-blue-700"
                            : op.status === "OVERDUE"
                            ? "bg-rose-100 text-rose-700 animate-pulse"
                            : op.status === "RETURNED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {op.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {op.status === "APPROVED" && (
                        <button
                          onClick={() => gateOutMutation.mutate(op.id)}
                          className="flex items-center gap-1 ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Scan Gate OUT
                        </button>
                      )}
                      {(op.status === "OUT" || op.status === "OVERDUE") && (
                        <button
                          onClick={() => gateInMutation.mutate(op.id)}
                          className="flex items-center gap-1 ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Scan Gate IN
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VISITOR REGISTRY */}
      {activeTab === "visitors" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Visitor Registry</h2>
            <button
              onClick={() => setShowVisitorModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Log Visitor
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-750 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-4 py-3">Visitor Name</th>
                  <th className="px-4 py-3">Student Visiting</th>
                  <th className="px-4 py-3">Check-in Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {visitors.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{v.visitorName}</p>
                      <p className="text-xs text-gray-400">{v.relationToStudent} • {v.purpose || "Visit"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {v.studentProfile?.user?.firstName} {v.studentProfile?.user?.lastName}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(v.checkInAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {v.checkOutAt ? (
                        <span className="text-xs text-gray-400">Departed ({new Date(v.checkOutAt).toLocaleTimeString()})</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                          On Campus
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!v.checkOutAt && (
                        <button
                          onClick={() => visitorCheckOutMutation.mutate(v.id)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium"
                        >
                          Check Out
                        </button>
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
