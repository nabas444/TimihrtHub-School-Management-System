import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  Check,
  GraduationCap,
  Briefcase,
  Building2,
  Layers,
} from "lucide-react";
import api from "../../lib/api";
import PageLoader from "../../components/ui/PageLoader";
import { Badge, Avatar } from "../../components/ui/index";
import EditStaffAttendanceModal from "./components/EditStaffAttendanceModal";
import IssuePenaltyModal from "./components/IssuePenaltyModal";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function StaffDailyAttendancePage() {
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [staffSearch, setStaffSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL"); // "ALL" | "TEACHER" | "FINANCE" | "ADMIN"
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "UNRECORDED"
  const [viewMode, setViewMode] = useState("GROUPED"); // "GROUPED" | "FLAT"

  const [editAttendanceModal, setEditAttendanceModal] = useState(null);
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [selectedStaffForPenalty, setSelectedStaffForPenalty] = useState(null);

  const { data: staffDailyData, isLoading: staffDailyLoading } = useQuery({
    queryKey: [
      "staff-attendance-daily",
      selectedDate,
      staffSearch,
      activeCategory,
    ],
    queryFn: () =>
      api
        .get(
          `/attendance/staff?date=${selectedDate}&search=${encodeURIComponent(
            staffSearch,
          )}&category=${activeCategory}`,
        )
        .then((r) => r.data.data),
  });

  const recordAttendanceMutation = useMutation({
    mutationFn: (d) => api.post("/attendance/staff", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-attendance-daily"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Staff attendance record saved");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save attendance");
    },
  });

  const batchRecordMutation = useMutation({
    mutationFn: (d) => api.post("/attendance/staff/batch", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-attendance-daily"] });
      qc.invalidateQueries({ queryKey: ["staff-punctuality-analytics"] });
      toast.success("Batch attendance updated successfully");
    },
  });

  const filteredRoster = useMemo(() => {
    const rawList = staffDailyData?.roster ?? [];
    return rawList.filter((item) => {
      if (activeCategory !== "ALL" && item.category !== activeCategory) {
        return false;
      }
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      if (staffSearch.trim()) {
        const q = staffSearch.toLowerCase();
        const fullName = `${item.staff?.firstName || ""} ${
          item.staff?.lastName || ""
        }`.toLowerCase();
        const email = (item.staff?.email || "").toLowerCase();
        const empId = (item.employeeId || "").toLowerCase();
        const dept = (item.department || "").toLowerCase();
        const notes = (item.notes || "").toLowerCase();
        if (
          !fullName.includes(q) &&
          !email.includes(q) &&
          !empId.includes(q) &&
          !dept.includes(q) &&
          !notes.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [staffDailyData?.roster, activeCategory, statusFilter, staffSearch]);

  const groupedRoster = useMemo(() => {
    const groups = {
      TEACHER: {
        title: "👨‍🏫 Teachers & Academic Faculty",
        icon: GraduationCap,
        items: [],
      },
      FINANCE: {
        title: "💰 Finance & Accounting Staff",
        icon: Briefcase,
        items: [],
      },
      ADMIN: {
        title: "🏛️ Administration & HR Management",
        icon: Building2,
        items: [],
      },
    };

    for (const item of filteredRoster) {
      if (groups[item.category]) {
        groups[item.category].items.push(item);
      } else {
        groups.ADMIN.items.push(item);
      }
    }
    return groups;
  }, [filteredRoster]);

  const handleQuickStatus = (staffId, status) => {
    recordAttendanceMutation.mutate({
      staffId,
      date: selectedDate,
      status,
      checkInTime: status === "PRESENT" ? "08:00" : status === "LATE" ? "08:20" : null,
      expectedTime: "08:00",
      lateMinutes: status === "LATE" ? 20 : 0,
    });
  };

  const handleMarkAllPresent = () => {
    if (filteredRoster.length === 0) return;
    const records = filteredRoster.map((item) => ({
      staffId: item.staffId,
      status: "PRESENT",
      checkInTime: item.checkInTime || "08:00",
      expectedTime: "08:00",
      lateMinutes: 0,
    }));
    batchRecordMutation.mutate({ date: selectedDate, records });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Staff Daily Attendance Register</h1>
          <p className="page-subtitle">
            Track daily staff presence, check-in times, lateness, and record staff attendance.
          </p>
        </div>
      </div>

      {/* Stat Cards for Today */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 bg-white border border-gray-200">
          <span className="text-xs font-bold text-gray-500 uppercase block">
            Total Staff
          </span>
          <span className="text-2xl font-black text-gray-900">
            {staffDailyData?.totalStaff ?? 0}
          </span>
        </div>
        <div className="card p-4 bg-emerald-50 border border-emerald-200">
          <span className="text-xs font-bold text-emerald-800 uppercase block">
            Present On Time
          </span>
          <span className="text-2xl font-black text-emerald-900">
            {staffDailyData?.counts?.present ?? 0}
          </span>
        </div>
        <div className="card p-4 bg-amber-50 border border-amber-200">
          <span className="text-xs font-bold text-amber-800 uppercase block">
            Late Arrivals
          </span>
          <span className="text-2xl font-black text-amber-900">
            {staffDailyData?.counts?.late ?? 0}
          </span>
        </div>
        <div className="card p-4 bg-rose-50 border border-rose-200">
          <span className="text-xs font-bold text-rose-800 uppercase block">
            Absent / Unrecorded
          </span>
          <span className="text-2xl font-black text-rose-900">
            {(staffDailyData?.counts?.absent ?? 0) +
              (staffDailyData?.counts?.unrecorded ?? 0)}
          </span>
        </div>
      </div>

      {/* Category Tabs: Teachers, Finance, Admin */}
      <div className="card p-3 bg-gray-50/80 border border-gray-200 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveCategory("ALL")}
              className={clsx(
                "px-3 py-1.5 rounded-xl font-extrabold transition-all inline-flex items-center gap-1.5",
                activeCategory === "ALL"
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
              )}
            >
              <Users className="w-3.5 h-3.5" /> All Staff (
              {staffDailyData?.totalStaff ?? 0})
            </button>

            <button
              onClick={() => setActiveCategory("TEACHER")}
              className={clsx(
                "px-3 py-1.5 rounded-xl font-extrabold transition-all inline-flex items-center gap-1.5",
                activeCategory === "TEACHER"
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
              )}
            >
              <GraduationCap className="w-3.5 h-3.5 text-indigo-500" /> Teachers (
              {staffDailyData?.categories?.TEACHER?.total ?? 0})
            </button>

            <button
              onClick={() => setActiveCategory("FINANCE")}
              className={clsx(
                "px-3 py-1.5 rounded-xl font-extrabold transition-all inline-flex items-center gap-1.5",
                activeCategory === "FINANCE"
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
              )}
            >
              <Briefcase className="w-3.5 h-3.5 text-emerald-500" /> Finance (
              {staffDailyData?.categories?.FINANCE?.total ?? 0})
            </button>

            <button
              onClick={() => setActiveCategory("ADMIN")}
              className={clsx(
                "px-3 py-1.5 rounded-xl font-extrabold transition-all inline-flex items-center gap-1.5",
                activeCategory === "ADMIN"
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
              )}
            >
              <Building2 className="w-3.5 h-3.5 text-purple-500" /> Admins & HR (
              {staffDailyData?.categories?.ADMIN?.total ?? 0})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setViewMode(viewMode === "GROUPED" ? "FLAT" : "GROUPED")
              }
              className="btn-ghost btn-sm text-xs text-gray-600 inline-flex items-center gap-1 border border-gray-200 bg-white"
              title="Toggle Categorical Grouping"
            >
              <Layers className="w-3.5 h-3.5" />
              {viewMode === "GROUPED" ? "Grouped View" : "Flat List View"}
            </button>

            <button
              onClick={handleMarkAllPresent}
              disabled={batchRecordMutation.isPending || filteredRoster.length === 0}
              className="btn-primary btn-sm text-xs inline-flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Mark Filtered as Present
            </button>
          </div>
        </div>

        {/* Multi-Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              className="input text-xs pl-8 font-medium"
              placeholder="Search by name, email, employee ID, specialization, department…"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
            />
            {staffSearch && (
              <button
                onClick={() => setStaffSearch("")}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-gray-600 whitespace-nowrap">
              Date:
            </span>
            <input
              type="date"
              className="input text-xs font-bold flex-1"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-gray-600 whitespace-nowrap">
              Status:
            </span>
            <select
              className="input text-xs flex-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Presence Statuses</option>
              <option value="PRESENT">Present (On Time)</option>
              <option value="LATE">Late Arrivals</option>
              <option value="ABSENT">Absent (Unexcused)</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="EXCUSED">Excused</option>
              <option value="UNRECORDED">Unrecorded Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Attendance Register Table */}
      {staffDailyLoading ? (
        <PageLoader />
      ) : filteredRoster.length === 0 ? (
        <div className="card p-12 text-center bg-white border border-gray-200 space-y-2">
          <Users className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="font-bold text-gray-700">No staff members found</h3>
          <p className="text-xs text-gray-400">
            Try clearing your search query or selecting a different role filter.
          </p>
          <button
            className="btn-secondary btn-sm text-xs inline-flex items-center gap-1 mt-2"
            onClick={() => {
              setStaffSearch("");
              setStatusFilter("ALL");
              setActiveCategory("ALL");
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>
      ) : viewMode === "GROUPED" && activeCategory === "ALL" ? (
        <div className="space-y-5">
          {Object.entries(groupedRoster).map(([catKey, catGroup]) => {
            if (catGroup.items.length === 0) return null;
            const CatIcon = catGroup.icon;
            return (
              <div
                key={catKey}
                className="card bg-white border border-gray-200 overflow-hidden"
              >
                <div className="p-3.5 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-gray-900 flex items-center gap-2">
                    <CatIcon className="w-4 h-4 text-primary-600" />
                    {catGroup.title} ({catGroup.items.length})
                  </h4>
                  <span className="text-[10px] text-gray-500 font-bold uppercase">
                    {catGroup.items.filter((i) => i.status === "PRESENT").length}{" "}
                    Present •{" "}
                    {catGroup.items.filter((i) => i.status === "LATE").length} Late
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="table w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50/40 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                        <th className="py-2.5 px-4">Faculty / Staff</th>
                        <th className="py-2.5 px-4">Department / Subject</th>
                        <th className="py-2.5 px-4">Presence Status</th>
                        <th className="py-2.5 px-4">Check-In / Expected</th>
                        <th className="py-2.5 px-4">Lateness</th>
                        <th className="py-2.5 px-4">Notes</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {catGroup.items.map((item) => (
                        <tr key={item.staffId} className="hover:bg-gray-50/60">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                name={`${item.staff?.firstName} ${item.staff?.lastName}`}
                                src={item.staff?.avatar}
                                size="sm"
                              />
                              <div>
                                <p className="font-bold text-gray-900">
                                  {item.staff?.firstName} {item.staff?.lastName}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  ID: {item.employeeId} • {item.staff?.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700 font-medium">
                            {item.department}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={clsx(
                                "px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                                item.status === "PRESENT" &&
                                  "bg-emerald-50 text-emerald-700 border-emerald-200",
                                item.status === "LATE" &&
                                  "bg-amber-50 text-amber-700 border-amber-200",
                                item.status === "ABSENT" &&
                                  "bg-rose-50 text-rose-700 border-rose-200",
                                item.status === "EXCUSED" &&
                                  "bg-blue-50 text-blue-700 border-blue-200",
                                item.status === "UNRECORDED" &&
                                  "bg-gray-100 text-gray-500 border-gray-200",
                              )}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {item.checkInTime ? (
                              <span className="font-bold text-gray-900">
                                {item.checkInTime}{" "}
                                <span className="text-gray-400 font-normal text-[10px]">
                                  (exp: {item.expectedTime})
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            {item.lateMinutes > 0 ? (
                              <span className="text-amber-700">
                                +{item.lateMinutes}m
                              </span>
                            ) : item.status === "PRESENT" ? (
                              <span className="text-emerald-700">0m</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-500 max-w-44 truncate">
                            {item.notes || "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleQuickStatus(item.staffId, "PRESENT")}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Mark Present"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleQuickStatus(item.staffId, "LATE")}
                                className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                                title="Mark Late (+20m)"
                              >
                                <AlertCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleQuickStatus(item.staffId, "ABSENT")}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                title="Mark Absent"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                className="btn-secondary btn-sm text-[10px] py-0.5 px-2 ml-1"
                                onClick={() => setEditAttendanceModal(item)}
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card bg-white border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Faculty / Staff Member</th>
                  <th className="py-3 px-4">Category & Department</th>
                  <th className="py-3 px-4">Presence Status</th>
                  <th className="py-3 px-4">Check-In / Expected</th>
                  <th className="py-3 px-4">Lateness</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRoster.map((item) => (
                  <tr key={item.staffId} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={`${item.staff?.firstName} ${item.staff?.lastName}`}
                          src={item.staff?.avatar}
                          size="sm"
                        />
                        <div>
                          <p className="font-bold text-gray-900">
                            {item.staff?.firstName} {item.staff?.lastName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            ID: {item.employeeId} • {item.staff?.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          item.category === "TEACHER"
                            ? "indigo"
                            : item.category === "FINANCE"
                            ? "green"
                            : "purple"
                        }
                      >
                        {item.category}
                      </Badge>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {item.department}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                          item.status === "PRESENT" &&
                            "bg-emerald-50 text-emerald-700 border-emerald-200",
                          item.status === "LATE" &&
                            "bg-amber-50 text-amber-700 border-amber-200",
                          item.status === "ABSENT" &&
                            "bg-rose-50 text-rose-700 border-rose-200",
                          item.status === "EXCUSED" &&
                            "bg-blue-50 text-blue-700 border-blue-200",
                          item.status === "UNRECORDED" &&
                            "bg-gray-100 text-gray-500 border-gray-200",
                        )}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {item.checkInTime ? (
                        <span className="font-bold text-gray-900">
                          {item.checkInTime}{" "}
                          <span className="text-gray-400 font-normal text-[10px]">
                            (exp: {item.expectedTime})
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      {item.lateMinutes > 0 ? (
                        <span className="text-amber-700">
                          +{item.lateMinutes}m
                        </span>
                      ) : item.status === "PRESENT" ? (
                        <span className="text-emerald-700">0m</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500 max-w-44 truncate">
                      {item.notes || "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleQuickStatus(item.staffId, "PRESENT")}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Mark Present"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickStatus(item.staffId, "LATE")}
                          className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                          title="Mark Late (+20m)"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickStatus(item.staffId, "ABSENT")}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Mark Absent"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button
                          className="btn-secondary btn-sm text-[10px] py-0.5 px-2 ml-1"
                          onClick={() => setEditAttendanceModal(item)}
                        >
                          Edit
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

      {/* Edit Staff Attendance Modal */}
      <EditStaffAttendanceModal
        open={!!editAttendanceModal}
        onClose={() => setEditAttendanceModal(null)}
        record={editAttendanceModal}
        selectedDate={selectedDate}
      />

      {/* Issue Penalty Modal */}
      <IssuePenaltyModal
        open={penaltyModalOpen}
        onClose={() => {
          setPenaltyModalOpen(false);
          setSelectedStaffForPenalty(null);
        }}
        selectedStaff={selectedStaffForPenalty}
      />
    </div>
  );
}
