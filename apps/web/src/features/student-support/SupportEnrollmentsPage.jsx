import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Award,
  Utensils,
  HelpCircle,
  MoreVertical,
  Percent,
  Calendar,
  Layers,
  ArrowLeft,
  FileCheck,
  RotateCcw,
  Check,
  AlertCircle,
  Eye,
  Trash2,
} from "lucide-react";
import api from "../../lib/api";
import {
  Avatar,
  Badge,
  EmptyState,
  PageLoader,
  Pagination,
} from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function SupportEnrollmentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const programIdParam = searchParams.get("programId") || "ALL";

  // ── Filters ─────────────────────────────────────────────────────────────
  const [selectedProgramId, setSelectedProgramId] = useState(programIdParam);
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedClassId, setSelectedClassId] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("roster"); // "roster" | "meal_distribution"

  // ── Modals State ────────────────────────────────────────────────────────
  const [isSingleEnrollOpen, setIsSingleEnrollOpen] = useState(false);
  const [isBulkEnrollOpen, setIsBulkEnrollOpen] = useState(false);
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState(null);

  // Single Form State
  const [singleForm, setSingleForm] = useState({
    supportProgramId: programIdParam !== "ALL" ? programIdParam : "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    notes: "",
  });

  // Bulk Form State
  const [bulkForm, setBulkForm] = useState({
    supportProgramId: programIdParam !== "ALL" ? programIdParam : "",
    classId: "",
    selectedStudentIds: [],
    startDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Meal Distribution State
  const [mealDate, setMealDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedMealProgramId, setSelectedMealProgramId] = useState("");

  // ── Fetch Programs ──────────────────────────────────────────────────────
  const { data: programsData } = useQuery({
    queryKey: ["support-programs-list"],
    queryFn: async () => {
      const res = await api.get("/student-support/programs");
      return res.data?.data?.programs || [];
    },
  });
  const programs = programsData || [];

  // ── Fetch Classes for filtering & bulk enrollment ────────────────────────
  const { data: classesData } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const res = await api.get("/academics/classes");
      return res.data?.data || [];
    },
  });
  const classes = classesData || [];

  // ── Fetch Enrollments ───────────────────────────────────────────────────
  const { data: enrollmentsData, isLoading: isEnrollmentsLoading } = useQuery({
    queryKey: [
      "support-enrollments",
      selectedProgramId,
      selectedStatus,
      selectedType,
      selectedClassId,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProgramId !== "ALL")
        params.append("supportProgramId", selectedProgramId);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);
      if (selectedType !== "ALL") params.append("type", selectedType);
      if (selectedClassId !== "ALL") params.append("classId", selectedClassId);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await api.get(
        `/student-support/enrollments?${params.toString()}`
      );
      return res.data?.data?.enrollments || [];
    },
  });
  const enrollments = enrollmentsData || [];

  // ── Fetch Students for Search & Bulk selection ───────────────────────────
  const { data: searchedStudentsData } = useQuery({
    queryKey: ["students-search-enroll", studentSearchInput],
    queryFn: async () => {
      if (!studentSearchInput || studentSearchInput.length < 2) return [];
      const res = await api.get(
        `/users?role=STUDENT&search=${encodeURIComponent(studentSearchInput)}&limit=10`
      );
      return res.data?.data || [];
    },
    enabled: studentSearchInput.length >= 2,
  });

  const { data: classStudentsData } = useQuery({
    queryKey: ["class-students-bulk", bulkForm.classId],
    queryFn: async () => {
      if (!bulkForm.classId) return [];
      const res = await api.get(
        `/users?role=STUDENT&classId=${bulkForm.classId}&limit=100`
      );
      return res.data?.data || [];
    },
    enabled: Boolean(bulkForm.classId),
  });

  // ── Fetch Meal Distribution Records for the selected date ───────────────
  const {
    data: mealRecordsData,
    refetch: refetchMealRecords,
  } = useQuery({
    queryKey: ["meal-distribution-records", mealDate, selectedMealProgramId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("date", mealDate);
      if (selectedMealProgramId)
        params.append("supportProgramId", selectedMealProgramId);
      const res = await api.get(
        `/student-support/meal-distribution?${params.toString()}`
      );
      return res.data?.data?.records || [];
    },
    enabled: activeTab === "meal_distribution",
  });
  const mealRecords = mealRecordsData || [];
  const loggedEnrollmentIds = useMemo(() => {
    return new Set(mealRecords.map((r) => r.studentSupportEnrollmentId));
  }, [mealRecords]);

  // ── Mutations ───────────────────────────────────────────────────────────
  // Single enroll
  const enrollMutation = useMutation({
    mutationFn: (payload) => api.post("/student-support/enrollments", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-enrollments"] });
      qc.invalidateQueries({ queryKey: ["support-programs"] });
      toast.success("Student enrolled in support program successfully");
      setIsSingleEnrollOpen(false);
      setSelectedStudentForEnroll(null);
      setStudentSearchInput("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to enroll student");
    },
  });

  // Bulk enroll
  const bulkEnrollMutation = useMutation({
    mutationFn: (payload) =>
      api.post("/student-support/enrollments/bulk", payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["support-enrollments"] });
      qc.invalidateQueries({ queryKey: ["support-programs"] });
      toast.success(
        res.data?.data?.message || "Bulk enrollment completed successfully"
      );
      setIsBulkEnrollOpen(false);
      setBulkForm({
        supportProgramId: "",
        classId: "",
        selectedStudentIds: [],
        startDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Bulk enrollment failed");
    },
  });

  // Status update
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/student-support/enrollments/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-enrollments"] });
      toast.success("Enrollment status updated");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update status");
    },
  });

  // Apply fee waiver mutation
  const applyWaiverMutation = useMutation({
    mutationFn: (id) =>
      api.post(`/student-support/enrollments/${id}/apply-waiver`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["support-enrollments"] });
      qc.invalidateQueries({ queryKey: ["fees"] });
      toast.success(res.data?.data?.message || "Fee waiver applied to invoices!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to apply fee waiver");
    },
  });

  // Delete enrollment
  const deleteEnrollmentMutation = useMutation({
    mutationFn: (id) => api.delete(`/student-support/enrollments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-enrollments"] });
      qc.invalidateQueries({ queryKey: ["support-programs"] });
      toast.success("Enrollment removed");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to remove enrollment");
    },
  });

  // Log meal distribution
  const logMealMutation = useMutation({
    mutationFn: (payload) =>
      api.post("/student-support/meal-distribution", payload),
    onSuccess: (res) => {
      refetchMealRecords();
      toast.success(res.data?.data?.message || "Meal distribution logged");
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.message || "Failed to log meal distribution"
      );
    },
  });

  // Handlers
  const handleSingleEnrollSubmit = (e) => {
    e.preventDefault();
    if (!selectedStudentForEnroll) {
      toast.error("Please select a student");
      return;
    }
    if (!singleForm.supportProgramId) {
      toast.error("Please select a support program");
      return;
    }

    enrollMutation.mutate({
      studentProfileId: selectedStudentForEnroll.studentProfile?.id,
      supportProgramId: singleForm.supportProgramId,
      startDate: singleForm.startDate,
      endDate: singleForm.endDate || null,
      notes: singleForm.notes.trim() || null,
    });
  };

  const handleBulkEnrollSubmit = (e) => {
    e.preventDefault();
    if (!bulkForm.supportProgramId) {
      toast.error("Please select a support program");
      return;
    }
    if (bulkForm.selectedStudentIds.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    bulkEnrollMutation.mutate({
      supportProgramId: bulkForm.supportProgramId,
      studentProfileIds: bulkForm.selectedStudentIds,
      startDate: bulkForm.startDate,
      notes: bulkForm.notes.trim() || null,
    });
  };

  const mealPrograms = programs.filter((p) => p.type === "MEAL_SUPPORT");
  const mealEnrollments = enrollments.filter(
    (e) => e.supportProgram?.type === "MEAL_SUPPORT" && e.status === "ACTIVE"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/student-support")}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Student Support Enrollments
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track student beneficiaries, apply tuition waivers, and log meal distributions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBulkEnrollOpen(true)}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"
          >
            <Layers className="w-4 h-4" />
            <span>Bulk Enroll</span>
          </button>

          <button
            onClick={() => {
              setSelectedStudentForEnroll(null);
              setStudentSearchInput("");
              setIsSingleEnrollOpen(true);
            }}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll Student</span>
          </button>
        </div>
      </div>

      {/* Main Tabs (Roster vs Meal Distribution Checklist) */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("roster")}
          className={clsx(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "roster"
              ? "border-primary-600 text-primary-600 dark:text-primary-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Active Roster ({enrollments.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("meal_distribution");
            if (!selectedMealProgramId && mealPrograms.length > 0) {
              setSelectedMealProgramId(mealPrograms[0].id);
            }
          }}
          className={clsx(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "meal_distribution"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Utensils className="w-4 h-4" />
          <span>Daily Meal Distribution Checklist</span>
        </button>
      </div>

      {activeTab === "roster" && (
        <>
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Search */}
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search student / program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Program Filter */}
            <div>
              <select
                value={selectedProgramId}
                onChange={(e) => {
                  setSelectedProgramId(e.target.value);
                  setSearchParams({ programId: e.target.value });
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All Categories</option>
                <option value="SCHOLARSHIP">Scholarships</option>
                <option value="FINANCIAL_AID">Financial Aid</option>
                <option value="MEAL_SUPPORT">Meal Support</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="ENDED">Ended</option>
              </select>
            </div>

            {/* Class Filter */}
            <div>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Roster Table */}
          {isEnrollmentsLoading ? (
            <PageLoader />
          ) : enrollments.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No student enrollments found"
              description="Enroll students individually or via bulk selection into support programs."
              action={
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setIsSingleEnrollOpen(true)}
                >
                  Enroll Student
                </button>
              }
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Support Program</th>
                      <th className="px-4 py-3">Fee Waiver</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {enrollments.map((item) => {
                      const student = item.studentProfile;
                      const user = student?.user;
                      const program = item.supportProgram;
                      const studentName = user
                        ? `${user.firstName} ${user.middleName || ""} ${user.lastName}`
                        : "Unknown Student";

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Student */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={user?.avatar}
                                name={studentName}
                                size="sm"
                              />
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {studentName}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {student?.admissionNumber || "No ID"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Class */}
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                            {student?.class?.name || "—"}
                          </td>

                          {/* Program */}
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                {program?.name}
                              </p>
                              <p className="text-[10px] text-slate-400 capitalize">
                                {program?.type?.replace("_", " ").toLowerCase()}
                              </p>
                            </div>
                          </td>

                          {/* Waiver */}
                          <td className="px-4 py-3.5">
                            {program?.waiverPercent !== null &&
                            program?.waiverPercent !== undefined ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md text-[11px]">
                                {program.waiverPercent}% Waived
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Duration */}
                          <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                            {new Date(item.startDate).toLocaleDateString()}
                            {item.endDate && (
                              <span>
                                {" "}
                                - {new Date(item.endDate).toLocaleDateString()}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            <span
                              className={clsx(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1",
                                item.status === "ACTIVE"
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                  : item.status === "SUSPENDED"
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              )}
                            >
                              <span
                                className={clsx(
                                  "w-1.5 h-1.5 rounded-full",
                                  item.status === "ACTIVE"
                                    ? "bg-emerald-500"
                                    : item.status === "SUSPENDED"
                                    ? "bg-amber-500"
                                    : "bg-slate-400"
                                )}
                              />
                              {item.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Apply Fee Waiver Shortcut */}
                              {program?.waiverPercent !== null &&
                                program?.waiverPercent > 0 &&
                                item.status === "ACTIVE" && (
                                  <button
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Apply ${program.waiverPercent}% waiver to active fee invoices for ${studentName}?`
                                        )
                                      ) {
                                        applyWaiverMutation.mutate(item.id);
                                      }
                                    }}
                                    disabled={applyWaiverMutation.isPending}
                                    className="px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                                    title="Apply Waiver to Pending Invoices"
                                  >
                                    <Percent className="w-3 h-3" />
                                    <span>Apply Waiver</span>
                                  </button>
                                )}

                              {/* Recognition Certificate Shortcut */}
                              <button
                                onClick={() => {
                                  navigate(
                                    `/certificates?studentId=${student?.id}&recipientName=${encodeURIComponent(
                                      studentName
                                    )}&type=SCHOLARSHIP`
                                  );
                                }}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                title="Issue Recognition Certificate"
                              >
                                <Award className="w-4 h-4" />
                              </button>

                              {/* Status Toggle Menu */}
                              <select
                                value={item.status}
                                onChange={(e) =>
                                  updateStatusMutation.mutate({
                                    id: item.id,
                                    status: e.target.value,
                                  })
                                }
                                className="text-[10px] font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-1 text-slate-700 dark:text-slate-300 focus:outline-none"
                              >
                                <option value="ACTIVE">Active</option>
                                <option value="SUSPENDED">Suspend</option>
                                <option value="ENDED">End</option>
                              </select>

                              {/* Remove */}
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Remove ${studentName} from this support program?`
                                    )
                                  ) {
                                    deleteEnrollmentMutation.mutate(item.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                title="Remove Enrollment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Daily Meal Distribution Checklist Tab */}
      {activeTab === "meal_distribution" && (
        <div className="space-y-4">
          {/* Meal Header & Date Controller */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Daily Meal Verification Checklist
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a date to check off student meal collections
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Program
                </label>
                <select
                  value={selectedMealProgramId}
                  onChange={(e) => setSelectedMealProgramId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                >
                  {mealPrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={mealDate}
                  onChange={(e) => setMealDate(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={() => {
                    const unloggedEnrollments = mealEnrollments.filter(
                      (e) => !loggedEnrollmentIds.has(e.id)
                    );
                    if (unloggedEnrollments.length === 0) {
                      toast.success("All students already logged for this date!");
                      return;
                    }
                    logMealMutation.mutate({
                      date: mealDate,
                      studentSupportEnrollmentIds: unloggedEnrollments.map(
                        (e) => e.id
                      ),
                    });
                  }}
                  disabled={logMealMutation.isPending}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Log All Distributed Today</span>
                </button>
              </div>
            </div>
          </div>

          {/* Checklist Table */}
          {mealEnrollments.length === 0 ? (
            <EmptyState
              icon={Utensils}
              title="No active students enrolled in meal support"
              description="Enroll students into a meal assistance program to begin tracking daily distributions."
              action={
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setIsSingleEnrollOpen(true)}
                >
                  Enroll in Meal Support
                </button>
              }
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Program</th>
                    <th className="px-4 py-3">Distribution Status ({mealDate})</th>
                    <th className="px-4 py-3 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {mealEnrollments.map((item) => {
                    const student = item.studentProfile;
                    const user = student?.user;
                    const studentName = user
                      ? `${user.firstName} ${user.middleName || ""} ${user.lastName}`
                      : "Unknown Student";
                    const isDistributed = loggedEnrollmentIds.has(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={clsx(
                          "transition-colors",
                          isDistributed
                            ? "bg-amber-50/30 dark:bg-amber-950/10"
                            : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                        )}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={user?.avatar}
                              name={studentName}
                              size="sm"
                            />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {studentName}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {student?.admissionNumber || "No ID"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                          {student?.class?.name || "—"}
                        </td>

                        <td className="px-4 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                          {item.supportProgram?.name}
                        </td>

                        <td className="px-4 py-3.5">
                          {isDistributed ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Meal Distributed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-full">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pending Collection</span>
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() =>
                              logMealMutation.mutate({
                                studentSupportEnrollmentId: item.id,
                                date: mealDate,
                              })
                            }
                            disabled={logMealMutation.isPending}
                            className={clsx(
                              "px-3 py-1 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5",
                              isDistributed
                                ? "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                : "bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
                            )}
                          >
                            <Check className="w-3 h-3" />
                            <span>
                              {isDistributed ? "Log Again" : "Mark Collected"}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Single Student Enrollment Modal ───────────────────────────────── */}
      <Modal
        isOpen={isSingleEnrollOpen}
        onClose={() => setIsSingleEnrollOpen(false)}
        title="Enroll Student in Support Program"
      >
        <form onSubmit={handleSingleEnrollSubmit} className="space-y-4 pt-2">
          {/* Student Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Student *
            </label>
            {selectedStudentForEnroll ? (
              <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={`${selectedStudentForEnroll.firstName} ${selectedStudentForEnroll.lastName}`}
                    size="sm"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {selectedStudentForEnroll.firstName}{" "}
                      {selectedStudentForEnroll.middleName || ""}{" "}
                      {selectedStudentForEnroll.lastName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Admission:{" "}
                      {selectedStudentForEnroll.studentProfile?.admissionNumber ||
                        "N/A"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentForEnroll(null)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Type student name or admission number..."
                  value={studentSearchInput}
                  onChange={(e) => setStudentSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
                />

                {/* Autocomplete Dropdown */}
                {searchedStudentsData && searchedStudentsData.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50 divide-y divide-slate-100 dark:divide-slate-700">
                    {searchedStudentsData.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentForEnroll(s);
                          setStudentSearchInput("");
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {s.firstName} {s.middleName || ""} {s.lastName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            ID: {s.studentProfile?.admissionNumber || "N/A"} |
                            Class: {s.studentProfile?.class?.name || "Unassigned"}
                          </p>
                        </div>
                        <Check className="w-3.5 h-3.5 text-primary-500 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Program Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Support Program *
            </label>
            <select
              required
              value={singleForm.supportProgramId}
              onChange={(e) =>
                setSingleForm({
                  ...singleForm,
                  supportProgramId: e.target.value,
                })
              }
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
            >
              <option value="">-- Choose Program --</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (
                  {p.waiverPercent ? `${p.waiverPercent}% Waiver` : p.type})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={singleForm.startDate}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, startDate: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={singleForm.endDate}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, endDate: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Confidential Notes (Admin/Finance only)
            </label>
            <textarea
              rows={2}
              placeholder="Reason for aid, verification reference, sponsor details..."
              value={singleForm.notes}
              onChange={(e) =>
                setSingleForm({ ...singleForm, notes: e.target.value })
              }
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSingleEnrollOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={enrollMutation.isPending}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              Enroll Student
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Bulk Enrollment Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={isBulkEnrollOpen}
        onClose={() => setIsBulkEnrollOpen(false)}
        title="Bulk Enroll Students in Support Program"
      >
        <form onSubmit={handleBulkEnrollSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Support Program *
            </label>
            <select
              required
              value={bulkForm.supportProgramId}
              onChange={(e) =>
                setBulkForm({ ...bulkForm, supportProgramId: e.target.value })
              }
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
            >
              <option value="">-- Choose Program --</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (
                  {p.waiverPercent ? `${p.waiverPercent}% Waiver` : p.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Filter by Class
            </label>
            <select
              value={bulkForm.classId}
              onChange={(e) =>
                setBulkForm({
                  ...bulkForm,
                  classId: e.target.value,
                  selectedStudentIds: [],
                })
              }
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
            >
              <option value="">-- Select Class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student Checkbox List */}
          {classStudentsData && classStudentsData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Students ({bulkForm.selectedStudentIds.length} of{" "}
                  {classStudentsData.length})
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      bulkForm.selectedStudentIds.length ===
                      classStudentsData.length
                    ) {
                      setBulkForm({ ...bulkForm, selectedStudentIds: [] });
                    } else {
                      setBulkForm({
                        ...bulkForm,
                        selectedStudentIds: classStudentsData
                          .map((s) => s.studentProfile?.id)
                          .filter(Boolean),
                      });
                    }
                  }}
                  className="text-[11px] font-semibold text-primary-600 hover:underline"
                >
                  {bulkForm.selectedStudentIds.length ===
                  classStudentsData.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
                {classStudentsData.map((s) => {
                  const studentProfileId = s.studentProfile?.id;
                  const isChecked =
                    bulkForm.selectedStudentIds.includes(studentProfileId);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkForm({
                              ...bulkForm,
                              selectedStudentIds: [
                                ...bulkForm.selectedStudentIds,
                                studentProfileId,
                              ],
                            });
                          } else {
                            setBulkForm({
                              ...bulkForm,
                              selectedStudentIds: bulkForm.selectedStudentIds.filter(
                                (id) => id !== studentProfileId
                              ),
                            });
                          }
                        }}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-700"
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {s.firstName} {s.lastName}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {s.studentProfile?.admissionNumber}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Start Date *
            </label>
            <input
              type="date"
              required
              value={bulkForm.startDate}
              onChange={(e) =>
                setBulkForm({ ...bulkForm, startDate: e.target.value })
              }
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsBulkEnrollOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bulkEnrollMutation.isPending}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              Bulk Enroll ({bulkForm.selectedStudentIds.length})
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
