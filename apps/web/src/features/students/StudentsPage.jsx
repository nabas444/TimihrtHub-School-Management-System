import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Download,
  MoreVertical,
  Power,
  Trash2,
  Edit2,
  GraduationCap,
  Users,
  Search,
  Filter,
  X,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  Layers,
  Sparkles,
  UserCheck,
  UserX,
  BookOpen,
  CreditCard,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import {
  Avatar,
  Badge,
  EmptyState,
  Pagination,
} from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import { useAuthStore } from "../../store/authStore";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function StudentsPage() {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // ── Modals & View Mode State ─────────────────────────────────────
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("table"); // "table" | "grid"
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);

  // ── Advanced Multi-Criteria Filter States ────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [genderFilter, setGenderFilter] = useState("ALL"); // "ALL" | "MALE" | "FEMALE"
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "true" | "false"
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState("ALL"); // "ALL" | "ENROLLED" | "GRADUATED"
  const [sortBy, setSortBy] = useState("created-desc"); // "created-desc" | "created-asc" | "name-asc" | "name-desc"

  // ── Form States ──────────────────────────────────────────────────
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "Welcome@123",
    admissionNumber: "",
    classId: "",
    gender: "",
    age: "",
    rollNumber: "",
  });

  const buildStudentCreatePayload = () => {
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
      admissionNumber: form.admissionNumber?.trim() || undefined,
      classId: form.classId || undefined,
      gender: form.gender || undefined,
      rollNumber: form.rollNumber?.trim() || undefined,
    };

    if (form.age) {
      const ageNumber = Number(form.age);
      if (!Number.isNaN(ageNumber)) {
        const birthYear = new Date().getFullYear() - ageNumber;
        payload.dateOfBirth = new Date(birthYear, 0, 1).toISOString();
      }
    }

    return payload;
  };

  const buildStudentUpdatePayload = () => {
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      gender: form.gender || undefined,
      rollNumber: form.rollNumber?.trim() || undefined,
    };

    if (form.age) {
      const ageNumber = Number(form.age);
      if (!Number.isNaN(ageNumber)) {
        const birthYear = new Date().getFullYear() - ageNumber;
        payload.dateOfBirth = new Date(birthYear, 0, 1).toISOString();
      }
    }

    return payload;
  };

  // ── Data Fetching Queries ────────────────────────────────────────
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/users/me").then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

  const { data: gradeLevels } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data),
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
  });

  const sortedGradeLevels = useMemo(() => {
    return (gradeLevels ?? []).slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [gradeLevels]);

  const availableClasses = useMemo(() => {
    const raw = classesData ?? [];
    if (gradeFilter === "ALL") return raw;
    return raw.filter((c) => c.gradeLevelId === gradeFilter);
  }, [classesData, gradeFilter]);

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: [
      "users",
      "STUDENT",
      page,
      searchQuery,
      gradeFilter,
      classFilter,
      genderFilter,
      statusFilter,
      enrollmentStatusFilter,
      sortBy,
      meData?.id,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("role", "STUDENT");
      params.append("page", page.toString());
      params.append("limit", "20");
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (gradeFilter !== "ALL") params.append("gradeLevelId", gradeFilter);
      if (classFilter !== "ALL") params.append("classId", classFilter);
      if (genderFilter !== "ALL") params.append("gender", genderFilter);
      if (statusFilter !== "ALL") params.append("isActive", statusFilter);
      if (enrollmentStatusFilter !== "ALL") params.append("enrollmentStatus", enrollmentStatusFilter);
      if (sortBy) params.append("sortBy", sortBy);

      if (meData?.role === "TEACHER") {
        const teacherClassIds = meData?.teacherProfile?.assignedClasses?.map((c) => c.id) || [];
        if (teacherClassIds.length > 0 && classFilter === "ALL") {
          params.append("classIds", teacherClassIds.join(","));
        }
      }

      return api.get(`/users?${params.toString()}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  // ── Mutations ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d) => api.post("/users", { ...d, role: "STUDENT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "STUDENT"] });
      toast.success("Student enrolled successfully");
      setAddOpen(false);
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "Welcome@123",
        admissionNumber: "",
        classId: "",
        gender: "",
        age: "",
        rollNumber: "",
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create student");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d) => api.patch(`/users/${selectedStudent.id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "STUDENT"] });
      toast.success("Student profile updated");
      setEditOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update student");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/toggle-status`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "STUDENT"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Student account status updated");
      setMenuOpen(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "STUDENT"] });
      toast.success("Student deleted");
      setDeleteConfirmStudent(null);
      setMenuOpen(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete student");
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────
  const handleEditOpen = (student) => {
    setSelectedStudent(student);
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      password: "Welcome@123",
      admissionNumber: student.studentProfile?.admissionNumber ?? "",
      classId: student.studentProfile?.classId ?? "",
      gender: student.gender ?? "",
      age: student.dateOfBirth
        ? String(new Date().getFullYear() - new Date(student.dateOfBirth).getFullYear())
        : "",
      rollNumber: student.studentProfile?.rollNumber ?? "",
    });
    setEditOpen(true);
  };

  const handleExportCSV = () => {
    const raw = studentsData?.data ?? [];
    if (raw.length === 0) {
      toast.error("No students to export");
      return;
    }

    const headers = ["Admission No", "First Name", "Last Name", "Gender", "Class", "Grade", "Email", "Status"];
    const rows = raw.map((s) => [
      s.studentProfile?.admissionNumber ?? "",
      s.firstName,
      s.lastName,
      s.gender ?? "",
      s.studentProfile?.class?.name ?? "",
      s.studentProfile?.class?.gradeLevel?.name ?? s.studentProfile?.gradeLevel?.name ?? "",
      s.email,
      s.isActive ? "Active" : "Inactive",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `students_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export downloaded");
  };

  // ── Filter Logic & Metrics ───────────────────────────────────────
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (gradeFilter !== "ALL") count++;
    if (classFilter !== "ALL") count++;
    if (genderFilter !== "ALL") count++;
    if (statusFilter !== "ALL") count++;
    if (enrollmentStatusFilter !== "ALL") count++;
    return count;
  }, [searchQuery, gradeFilter, classFilter, genderFilter, statusFilter, enrollmentStatusFilter]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setGradeFilter("ALL");
    setClassFilter("ALL");
    setGenderFilter("ALL");
    setStatusFilter("ALL");
    setEnrollmentStatusFilter("ALL");
    setSortBy("created-desc");
    setPage(1);
  };

  const students = studentsData?.data ?? [];
  const meta = studentsData?.meta ?? {};

  // Metrics summary
  const metrics = useMemo(() => {
    const raw = students;
    const maleCount = raw.filter((s) => s.gender === "MALE").length;
    const femaleCount = raw.filter((s) => s.gender === "FEMALE").length;
    const activeAccounts = raw.filter((s) => s.isActive).length;

    return {
      total: meta.total ?? raw.length,
      maleCount,
      femaleCount,
      activeAccounts,
    };
  }, [students, meta.total]);

  return (
    <div className="space-y-6">
      {/* ── Page Header & Stats Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-primary-600" />
            Student Directory
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage student admissions, classroom enrollments, and academic profiles
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs">
            <button
              onClick={() => setViewMode("table")}
              className={clsx(
                "p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all",
                viewMode === "table" ? "bg-white text-primary-700 shadow-xs" : "text-gray-500 hover:text-gray-900"
              )}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={clsx(
                "p-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all",
                viewMode === "grid" ? "bg-white text-primary-700 shadow-xs" : "text-gray-500 hover:text-gray-900"
              )}
              title="Grid Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button className="btn-secondary text-xs inline-flex items-center gap-1.5" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

          {isAdmin() && (
            <button
              className="btn-primary inline-flex items-center gap-1.5 shadow-sm"
              onClick={() => {
                setSelectedStudent(null);
                setAddOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Summary Pills ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Total Students</span>
            <span className="text-lg font-black text-gray-900">{metrics.total}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Boys / Girls</span>
            <span className="text-lg font-black text-gray-900">
              {metrics.maleCount} <span className="text-xs text-gray-400 font-normal">M / {metrics.femaleCount} F</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Active Accounts</span>
            <span className="text-lg font-black text-gray-900">{metrics.activeAccounts}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Classes Configured</span>
            <span className="text-lg font-black text-gray-900">{classesData?.length ?? 0}</span>
          </div>
        </div>
      </div>

      {/* ── Advanced Search & Filter Control Panel ─────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10 pr-9 text-xs py-2 w-full bg-gray-50 focus:bg-white transition-colors"
              placeholder="Search by student name, admission number (e.g. ADM-001), roll number, email, or phone…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown Selectors Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex items-center gap-2 text-xs flex-wrap">
            {/* Grade Level Dropdown */}
            <div className="flex-1 min-w-[135px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={gradeFilter}
                onChange={(e) => {
                  setGradeFilter(e.target.value);
                  setClassFilter("ALL");
                  setPage(1);
                }}
              >
                <option value="ALL">🎓 All Grades</option>
                {sortedGradeLevels.map((gl) => (
                  <option key={gl.id} value={gl.id}>
                    {gl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Section Dropdown */}
            <div className="flex-1 min-w-[130px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">🏫 All Classes</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender Dropdown - Only Male & Female */}
            <div className="flex-1 min-w-[120px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={genderFilter}
                onChange={(e) => {
                  setGenderFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Genders</option>
                <option value="MALE">👦 Male</option>
                <option value="FEMALE">👧 Female</option>
              </select>
            </div>

            {/* Account Status Dropdown */}
            <div className="flex-1 min-w-[125px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">🟢 All Accounts</option>
                <option value="true">Active Accounts</option>
                <option value="false">Inactive Accounts</option>
              </select>
            </div>

            {/* Enrollment Status Dropdown */}
            <div className="flex-1 min-w-[135px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={enrollmentStatusFilter}
                onChange={(e) => {
                  setEnrollmentStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">📜 All Status</option>
                <option value="ENROLLED">Enrolled Currently</option>
                <option value="GRADUATED">Graduated / Alumni</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex-1 min-w-[140px]">
              <select
                className="input py-2 text-xs bg-gray-50 font-medium"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
              >
                <option value="created-desc">Sort: Recently Added</option>
                <option value="created-asc">Sort: Oldest Registered</option>
                <option value="name-asc">Sort: Name (A → Z)</option>
                <option value="name-desc">Sort: Name (Z → A)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Active Filter Badges & Match Count ─────────────────────────── */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 font-medium">
              Showing <strong className="text-gray-900 font-bold">{students.length}</strong> of{" "}
              {meta.total ?? students.length} students
            </span>

            {/* Search Pill */}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery("")}>
                  <X className="w-3 h-3 hover:text-primary-900" />
                </button>
              </span>
            )}

            {/* Grade Pill */}
            {gradeFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Grade: {sortedGradeLevels.find((g) => g.id === gradeFilter)?.name}
                <button onClick={() => setGradeFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-purple-900" />
                </button>
              </span>
            )}

            {/* Class Pill */}
            {classFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Class: {availableClasses.find((c) => c.id === classFilter)?.name}
                <button onClick={() => setClassFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-blue-900" />
                </button>
              </span>
            )}

            {/* Gender Pill */}
            {genderFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Gender: {genderFilter === "MALE" ? "Male" : "Female"}
                <button onClick={() => setGenderFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-emerald-900" />
                </button>
              </span>
            )}

            {/* Status Pill */}
            {statusFilter !== "ALL" && (
              <span
                className={clsx(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                  statusFilter === "true"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                )}
              >
                Account: {statusFilter === "true" ? "Active" : "Inactive"}
                <button onClick={() => setStatusFilter("ALL")}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Enrollment Status Pill */}
            {enrollmentStatusFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Status: {enrollmentStatusFilter}
                <button onClick={() => setEnrollmentStatusFilter("ALL")}>
                  <X className="w-3 h-3 hover:text-amber-900" />
                </button>
              </span>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="text-xs text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Content View (Table vs Grid) ─────────────────────────────────── */}
      {studentsLoading ? (
        <PageLoader />
      ) : students.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={GraduationCap}
            title="No students found"
            description={
              activeFiltersCount > 0
                ? "No student records match your current search and filter criteria. Try clearing some filters."
                : "Add your first student to get started."
            }
          />
          {activeFiltersCount > 0 && (
            <button onClick={resetAllFilters} className="btn-secondary text-xs mt-4 inline-flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* ════ TABLE VIEW ════ */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Student Profile</th>
                  <th className="py-3 px-4">Admission No.</th>
                  <th className="py-3 px-4">Roll No.</th>
                  <th className="py-3 px-4">Class & Grade</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Status</th>
                  {isAdmin() && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                    <td
                      className="py-3.5 px-4 cursor-pointer"
                      onClick={() => navigate(`/students/${s.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={`${s.firstName} ${s.lastName}`}
                          src={s.avatar}
                          className="w-9 h-9 text-xs"
                        />
                        <div>
                          <p className="font-extrabold text-gray-900 hover:text-primary-600 transition-colors">
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {s.gender ? (s.gender === "MALE" ? "Male 👦" : "Female 👧") : "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="py-3.5 px-4 font-mono font-bold text-gray-700 cursor-pointer"
                      onClick={() => navigate(`/students/${s.id}`)}
                    >
                      <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {s.studentProfile?.admissionNumber ?? "—"}
                      </span>
                    </td>
                    <td
                      className="py-3.5 px-4 font-mono font-bold text-gray-600 cursor-pointer"
                      onClick={() => navigate(`/students/${s.id}`)}
                    >
                      {s.studentProfile?.rollNumber ?? "—"}
                    </td>
                    <td
                      className="py-3.5 px-4 cursor-pointer"
                      onClick={() => navigate(`/students/${s.id}`)}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {s.studentProfile?.class ? (
                          <Badge variant="blue">
                            <Users className="w-3 h-3 inline mr-1" />
                            {s.studentProfile.class.name}
                          </Badge>
                        ) : null}
                        {s.studentProfile?.class?.gradeLevel ? (
                          <Badge variant="purple">
                            <GraduationCap className="w-3 h-3 inline mr-1" />
                            {s.studentProfile.class.gradeLevel.name}
                          </Badge>
                        ) : s.studentProfile?.gradeLevel ? (
                          <Badge variant="purple">
                            <GraduationCap className="w-3 h-3 inline mr-1" />
                            {s.studentProfile.gradeLevel.name}
                          </Badge>
                        ) : null}
                        {!s.studentProfile?.class && !s.studentProfile?.gradeLevel && (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td
                      className="py-3.5 px-4 text-gray-600 font-medium cursor-pointer"
                      onClick={() => navigate(`/students/${s.id}`)}
                    >
                      {s.email}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={s.isActive ? "green" : "red"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="btn-ghost p-1.5 text-gray-400 hover:text-primary-600 rounded"
                          onClick={() =>
                            downloadFile(
                              `/users/${s.id}/id-card`,
                              `id-card-${s.studentProfile?.admissionNumber ?? s.id}.pdf`
                            ).catch(() => toast.error("Could not generate ID card"))
                          }
                          title="Download Student ID Card"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin() && (
                          <>
                            <button
                              className="btn-ghost p-1.5 text-gray-400 hover:text-primary-600 rounded"
                              onClick={() => handleEditOpen(s)}
                              title="Edit Student"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className={clsx(
                                "btn-ghost p-1.5 rounded",
                                s.isActive
                                  ? "text-amber-500 hover:text-amber-700"
                                  : "text-emerald-500 hover:text-emerald-700"
                              )}
                              onClick={() => toggleStatusMutation.mutate(s.id)}
                              title={
                                s.isActive
                                  ? "Deactivate Account"
                                  : "Activate Account"
                              }
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="btn-ghost p-1.5 text-gray-400 hover:text-red-600 rounded"
                              onClick={() => setDeleteConfirmStudent(s)}
                              title="Delete Student"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ════ GRID CARD VIEW ════ */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {students.map((s) => (
            <div
              key={s.id}
              className="card p-5 hover:shadow-md transition-all duration-200 border border-gray-200 flex flex-col justify-between group bg-white"
            >
              <div>
                {/* Top Profile Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={`${s.firstName} ${s.lastName}`}
                      src={s.avatar}
                      className="w-12 h-12 rounded-2xl shadow-xs"
                    />
                    <div>
                      <h3
                        className="font-extrabold text-sm text-gray-900 group-hover:text-primary-600 transition-colors cursor-pointer"
                        onClick={() => navigate(`/students/${s.id}`)}
                      >
                        {s.firstName} {s.lastName}
                      </h3>
                      <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 inline-block mt-0.5">
                        {s.studentProfile?.admissionNumber ?? "No ADM"}
                      </span>
                    </div>
                  </div>

                  <Badge variant={s.isActive ? "green" : "red"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Class & Grade Badges */}
                <div className="flex items-center gap-1.5 flex-wrap my-2.5">
                  {s.studentProfile?.class && (
                    <Badge variant="blue">
                      <Users className="w-3 h-3 inline mr-1" />
                      {s.studentProfile.class.name}
                    </Badge>
                  )}
                  {s.studentProfile?.class?.gradeLevel ? (
                    <Badge variant="purple">
                      <GraduationCap className="w-3 h-3 inline mr-1" />
                      {s.studentProfile.class.gradeLevel.name}
                    </Badge>
                  ) : s.studentProfile?.gradeLevel ? (
                    <Badge variant="purple">
                      <GraduationCap className="w-3 h-3 inline mr-1" />
                      {s.studentProfile.gradeLevel.name}
                    </Badge>
                  ) : null}
                  {s.gender && (
                    <Badge variant="gray">
                      {s.gender === "MALE" ? "Boy 👦" : "Girl 👧"}
                    </Badge>
                  )}
                </div>

                {/* Contact details */}
                <div className="space-y-1 mt-3 pt-2.5 border-t border-gray-100 text-[11px] text-gray-500">
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{s.email}</span>
                  </p>
                  {s.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{s.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <button
                  className="text-[11px] font-bold text-primary-600 hover:underline cursor-pointer"
                  onClick={() => navigate(`/students/${s.id}`)}
                >
                  View Profile →
                </button>

                <div className="flex items-center gap-1">
                  <button
                    className="btn-ghost p-1 text-gray-400 hover:text-primary-600 rounded"
                    onClick={() =>
                      downloadFile(
                        `/users/${s.id}/id-card`,
                        `id-card-${s.studentProfile?.admissionNumber ?? s.id}.pdf`
                      ).catch(() => toast.error("Could not generate ID card"))
                    }
                    title="Download ID Card"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin() && (
                    <>
                      <button
                        className="btn-ghost p-1 text-gray-400 hover:text-primary-600 rounded"
                        onClick={() => handleEditOpen(s)}
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn-ghost p-1 text-gray-400 hover:text-red-600 rounded"
                        onClick={() => setDeleteConfirmStudent(s)}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {meta.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={meta.totalPages ?? 1}
          onChange={setPage}
        />
      )}

      {/* ── Add / Edit Student Modal ────────────────────────────────────────── */}
      <Modal
        open={addOpen || editOpen}
        onClose={() => {
          setEditOpen(false);
          setAddOpen(false);
        }}
        title={selectedStudent ? `Edit Student: ${selectedStudent.firstName} ${selectedStudent.lastName}` : "Add New Student"}
        size="md"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                setEditOpen(false);
                setAddOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() =>
                selectedStudent
                  ? updateMutation.mutate(buildStudentUpdatePayload())
                  : createMutation.mutate(buildStudentCreatePayload())
              }
              disabled={
                selectedStudent
                  ? updateMutation.isPending || !form.firstName.trim() || !form.lastName.trim()
                  : createMutation.isPending || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()
              }
            >
              {selectedStudent
                ? updateMutation.isPending
                  ? "Updating…"
                  : "Save Changes"
                : createMutation.isPending
                ? "Creating…"
                : "Create Student"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">First Name *</label>
              <input
                className="input text-xs"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label font-bold">Last Name *</label>
              <input
                className="input text-xs"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Email Address *</label>
            <input
              className="input text-xs"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Gender</label>
              <select
                className="input text-xs"
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              >
                <option value="">— Select Gender —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="label font-bold">Age (Years)</label>
              <input
                className="input text-xs"
                type="number"
                min="1"
                max="30"
                value={form.age}
                onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                placeholder="e.g. 15"
              />
            </div>
            <div>
              <label className="label font-bold">Roll Number</label>
              <input
                className="input text-xs"
                value={form.rollNumber}
                onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          {!selectedStudent && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold">Admission Number</label>
                  <input
                    className="input text-xs font-mono uppercase"
                    value={form.admissionNumber}
                    onChange={(e) => setForm((f) => ({ ...f, admissionNumber: e.target.value }))}
                    placeholder="Auto-generated if blank"
                  />
                </div>
                <div>
                  <label className="label font-bold">Assign to Class</label>
                  <select
                    className="input text-xs"
                    value={form.classId}
                    onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                  >
                    <option value="">— Select Class —</option>
                    {(classesData ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label font-bold">Temporary Password</label>
                <input
                  className="input text-xs"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── Confirm Delete Student Modal ────────────────────────────────────── */}
      <Modal
        open={!!deleteConfirmStudent}
        onClose={() => setDeleteConfirmStudent(null)}
        title="Confirm Delete Student"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteConfirmStudent(null)}>
              Cancel
            </button>
            <button
              className="btn-primary bg-red-600 hover:bg-red-700 inline-flex items-center gap-1.5"
              onClick={() => deleteMutation.mutate(deleteConfirmStudent.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteMutation.isPending ? "Deleting…" : "Delete Student"}
            </button>
          </>
        }
      >
        <p className="text-xs text-gray-600">
          Are you sure you want to delete student{" "}
          <strong className="text-gray-900">
            {deleteConfirmStudent?.firstName} {deleteConfirmStudent?.lastName}
          </strong>? All grades, attendance, and records associated with this student account will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}
