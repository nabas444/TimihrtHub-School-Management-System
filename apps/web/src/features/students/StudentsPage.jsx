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
  Building,
  User,
  Heart,
  FileText,
  Shield,
  Bus,
  Clock,
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
import LookupSelect from "../../components/shared/LookupSelect";
import PhotoUploadInput from "../../components/shared/PhotoUploadInput";
import { useAuthStore } from "../../store/authStore";
import clsx from "clsx";
import toast from "react-hot-toast";

const initialFormState = {
  avatar: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  password: "Welcome@123",
  gender: "",
  dateOfBirth: "",
  birthPlace: "",
  nationality: "Ethiopian",
  city: "",
  state: "",
  pincode: "",
  address: "",
  bloodGroup: "",
  medicalNotes: "",

  // Parents
  fatherFirstName: "",
  fatherMiddleName: "",
  fatherLastName: "",
  fatherMobile: "",
  fatherPhoto: "",
  motherFirstName: "",
  motherMiddleName: "",
  motherLastName: "",
  motherMobile: "",
  motherPhoto: "",
  landline: "",

  // Classification & Program
  religionId: "",
  categoryId: "",
  feeCategoryId: "",
  houseId: "",
  curriculumId: "",
  classId: "",
  gradeLevelId: "",
  rollNumber: "",
  programType: "REGULAR",
  programTypeLabel: "",

  // Transportation
  usesTransport: false,
  busRouteId: "",

  // Admissions
  admissionNumber: "",
  sourceId: "",
  reference: "",
  previousSchoolId: "",
  previousClassYear: "",

  // Status
  status: "ACTIVE",
};

export default function StudentsPage() {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // ── Modals & View Mode State ─────────────────────────────────────
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("table"); // "table" | "grid"
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState("personal"); // "personal" | "parents" | "classification" | "admissions" | "status"
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState(null);

  // ── Advanced Multi-Criteria Filter States ────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [genderFilter, setGenderFilter] = useState("ALL"); // "ALL" | "MALE" | "FEMALE"
  const [statusFilter, setStatusFilter] = useState("ACTIVE"); // "ACTIVE" | "INACTIVE" | "ARCHIVE" | "ALL"
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState("ALL"); // "ALL" | "ENROLLED" | "GRADUATED"
  const [transportFilter, setTransportFilter] = useState("ALL"); // "ALL" | "YES" | "NO" | "NOT_SET"
  const [programTypeFilter, setProgramTypeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("created-desc");

  // ── Form State ───────────────────────────────────────────────────
  const [form, setForm] = useState(initialFormState);

  const buildStudentCreatePayload = () => {
    const payload = {
      role: "STUDENT",
      avatar: form.avatar || undefined,
      firstName: form.firstName.trim(),
      middleName: form.middleName?.trim() || undefined,
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
      gender: form.gender || undefined,
      dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
      birthPlace: form.birthPlace?.trim() || undefined,
      nationality: form.nationality?.trim() || undefined,
      city: form.city?.trim() || undefined,
      state: form.state?.trim() || undefined,
      pincode: form.pincode?.trim() || undefined,
      address: form.address?.trim() || undefined,
      bloodGroup: form.bloodGroup?.trim() || undefined,
      medicalNotes: form.medicalNotes?.trim() || undefined,

      admissionNumber: form.admissionNumber?.trim() || undefined,
      classId: form.classId || undefined,
      gradeLevelId: form.gradeLevelId || undefined,
      rollNumber: form.rollNumber?.trim() || undefined,

      // Program Type
      programType: form.programType || undefined,
      programTypeLabel:
        form.programType === "OTHER"
          ? form.programTypeLabel?.trim() || undefined
          : undefined,

      // Transportation
      usesTransport: form.usesTransport,
      busRouteId: form.usesTransport ? form.busRouteId || undefined : undefined,

      fatherFirstName: form.fatherFirstName?.trim() || undefined,
      fatherMiddleName: form.fatherMiddleName?.trim() || undefined,
      fatherLastName: form.fatherLastName?.trim() || undefined,
      fatherMobile: form.fatherMobile?.trim() || undefined,
      fatherPhoto: form.fatherPhoto || undefined,
      motherFirstName: form.motherFirstName?.trim() || undefined,
      motherMiddleName: form.motherMiddleName?.trim() || undefined,
      motherLastName: form.motherLastName?.trim() || undefined,
      motherMobile: form.motherMobile?.trim() || undefined,
      motherPhoto: form.motherPhoto || undefined,
      landline: form.landline?.trim() || undefined,

      religionId: form.religionId || undefined,
      categoryId: form.categoryId || undefined,
      feeCategoryId: form.feeCategoryId || undefined,
      houseId: form.houseId || undefined,
      curriculumId: form.curriculumId || undefined,
      sourceId: form.sourceId || undefined,
      reference: form.reference?.trim() || undefined,
      previousSchoolId: form.previousSchoolId || undefined,
      previousClassYear: form.previousClassYear?.trim() || undefined,
      status: "ACTIVE",
    };

    return payload;
  };

  const buildStudentUpdatePayload = () => {
    const payload = {
      avatar: form.avatar || null,
      firstName: form.firstName.trim(),
      middleName: form.middleName?.trim() || null,
      lastName: form.lastName.trim(),
      gender: form.gender || undefined,
      dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
      birthPlace: form.birthPlace?.trim() || null,
      nationality: form.nationality?.trim() || null,
      city: form.city?.trim() || null,
      state: form.state?.trim() || null,
      pincode: form.pincode?.trim() || null,
      address: form.address?.trim() || null,
      bloodGroup: form.bloodGroup?.trim() || null,
      medicalNotes: form.medicalNotes?.trim() || null,

      admissionNumber: form.admissionNumber?.trim() || null,
      rollNumber: form.rollNumber?.trim() || null,
      classId: form.classId || null,
      gradeLevelId: form.gradeLevelId || null,

      // Program Type
      programType: form.programType || null,
      programTypeLabel:
        form.programType === "OTHER"
          ? form.programTypeLabel?.trim() || null
          : null,

      // Transportation
      usesTransport: form.usesTransport,
      busRouteId: form.usesTransport ? form.busRouteId || null : null,

      fatherFirstName: form.fatherFirstName?.trim() || null,
      fatherMiddleName: form.fatherMiddleName?.trim() || null,
      fatherLastName: form.fatherLastName?.trim() || null,
      fatherMobile: form.fatherMobile?.trim() || null,
      fatherPhoto: form.fatherPhoto || null,
      motherFirstName: form.motherFirstName?.trim() || null,
      motherMiddleName: form.motherMiddleName?.trim() || null,
      motherLastName: form.motherLastName?.trim() || null,
      motherMobile: form.motherMobile?.trim() || null,
      motherPhoto: form.motherPhoto || null,
      landline: form.landline?.trim() || null,

      religionId: form.religionId || null,
      categoryId: form.categoryId || null,
      feeCategoryId: form.feeCategoryId || null,
      houseId: form.houseId || null,
      curriculumId: form.curriculumId || null,
      sourceId: form.sourceId || null,
      reference: form.reference?.trim() || null,
      previousSchoolId: form.previousSchoolId || null,
      previousClassYear: form.previousClassYear?.trim() || null,
      status: form.status || "ACTIVE",
    };

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

  const { data: busRoutesData } = useQuery({
    queryKey: ["bus-routes-lookup"],
    queryFn: () => api.get("/lookup-values/bus-routes").then((r) => r.data.data),
  });
  const busRoutes = busRoutesData || [];

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
      transportFilter,
      programTypeFilter,
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
      if (statusFilter && statusFilter !== "ALL") params.append("status", statusFilter);
      else if (statusFilter === "ALL") params.append("status", "ALL");
      if (enrollmentStatusFilter !== "ALL") params.append("enrollmentStatus", enrollmentStatusFilter);
      if (transportFilter !== "ALL") {
        params.append(
          "usesTransport",
          transportFilter === "YES" ? "true" : transportFilter === "NO" ? "false" : "null"
        );
      }
      if (programTypeFilter !== "ALL") params.append("programType", programTypeFilter);
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

  const students = studentsData?.data ?? [];
  const meta = studentsData?.meta ?? { total: 0, totalPages: 1 };

  // ── Mutations ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => api.post("/users", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["school-stats"] });
      toast.success("Student registered successfully");
      setAddOpen(false);
      setForm(initialFormState);
      setActiveFormTab("personal");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create student");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.patch(`/users/${selectedStudent?.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user", selectedStudent?.id] });
      toast.success("Student profile updated successfully");
      setEditOpen(false);
      setSelectedStudent(null);
      setForm(initialFormState);
      setActiveFormTab("personal");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update student");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["school-stats"] });
      toast.success("Student deleted successfully");
      setDeleteConfirmStudent(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete student");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/toggle-status`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Student status updated");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to toggle status");
    },
  });

  const handleEditOpen = (student) => {
    setSelectedStudent(student);
    const sp = student.studentProfile || {};
    setForm({
      avatar: student.avatar || "",
      firstName: student.firstName || "",
      middleName: student.middleName || sp.middleName || "",
      lastName: student.lastName || "",
      email: student.email || "",
      password: "",
      gender: student.gender || "",
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split("T")[0] : "",
      birthPlace: student.birthPlace || sp.birthPlace || "",
      nationality: student.nationality || sp.nationality || "Ethiopian",
      city: student.city || sp.city || "",
      state: student.state || sp.state || "",
      pincode: student.pincode || sp.pincode || "",
      address: student.address || "",
      bloodGroup: sp.bloodGroup || "",
      medicalNotes: sp.medicalNotes || "",

      fatherFirstName: sp.fatherFirstName || "",
      fatherMiddleName: sp.fatherMiddleName || "",
      fatherLastName: sp.fatherLastName || "",
      fatherMobile: sp.fatherMobile || "",
      fatherPhoto: sp.fatherPhoto || "",
      motherFirstName: sp.motherFirstName || "",
      motherMiddleName: sp.motherMiddleName || "",
      motherLastName: sp.motherLastName || "",
      motherMobile: sp.motherMobile || "",
      motherPhoto: sp.motherPhoto || "",
      landline: sp.landline || "",

      religionId: sp.religion?.id || sp.religionId || "",
      categoryId: sp.category?.id || sp.categoryId || "",
      feeCategoryId: sp.feeCategory?.id || sp.feeCategoryId || "",
      houseId: sp.house?.id || sp.houseId || "",
      curriculumId: sp.curriculum?.id || sp.curriculumId || "",
      classId: sp.classId || "",
      gradeLevelId: sp.gradeLevelId || "",
      rollNumber: sp.rollNumber || "",

      admissionNumber: sp.admissionNumber || "",
      sourceId: sp.source?.id || sp.sourceId || "",
      reference: sp.reference || "",
      previousSchoolId: sp.previousSchool?.id || sp.previousSchoolId || "",
      previousClassYear: sp.previousClassYear || "",

      // Program Type
      programType: sp.programType || "REGULAR",
      programTypeLabel: sp.programTypeLabel || "",

      // Transportation
      usesTransport: sp.usesTransport ?? false,
      busRouteId: sp.busRouteId || sp.busRoute?.id || "",

      status: sp.status || (student.isActive ? "ACTIVE" : "INACTIVE"),
    });
    setActiveFormTab("personal");
    setEditOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setGradeFilter("ALL");
    setClassFilter("ALL");
    setGenderFilter("ALL");
    setStatusFilter("ACTIVE");
    setEnrollmentStatusFilter("ALL");
    setTransportFilter("ALL");
    setProgramTypeFilter("ALL");
    setSortBy("created-desc");
    setPage(1);
  };

  const activeFiltersCount = [
    searchQuery !== "",
    gradeFilter !== "ALL",
    classFilter !== "ALL",
    genderFilter !== "ALL",
    statusFilter !== "ACTIVE",
    enrollmentStatusFilter !== "ALL",
    transportFilter !== "ALL",
    programTypeFilter !== "ALL",
    sortBy !== "created-desc",
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-primary-600" /> Student Directory
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage comprehensive student profiles, parent contacts, classification & admissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isAdmin() && (
            <button
              className="btn-primary text-xs inline-flex items-center gap-1.5 shadow-sm"
              onClick={() => {
                setSelectedStudent(null);
                setForm(initialFormState);
                setActiveFormTab("personal");
                setAddOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Add Student
            </button>
          )}

          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              className={clsx(
                "p-1.5 rounded-md transition-colors",
                viewMode === "table" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-700"
              )}
              onClick={() => setViewMode("table")}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              className={clsx(
                "p-1.5 rounded-md transition-colors",
                viewMode === "grid" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-700"
              )}
              onClick={() => setViewMode("grid")}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Search and Filter Bar ─────────────────────────────────────────── */}
      <div className="card p-4 bg-white border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-9 text-xs"
              placeholder="Search by student name, admission no, roll no, email, phone…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchQuery("")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Status Filter */}
            <select
              className="input text-xs font-semibold max-w-[130px]"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ACTIVE">● Active Only</option>
              <option value="INACTIVE">○ Inactive Only</option>
              <option value="ARCHIVE">🗄️ Archived Only</option>
              <option value="ALL">All Statuses</option>
            </select>

            {/* Grade Level Filter */}
            <select
              className="input text-xs max-w-[130px]"
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setClassFilter("ALL");
                setPage(1);
              }}
            >
              <option value="ALL">All Grades</option>
              {sortedGradeLevels.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            {/* Class Filter */}
            <select
              className="input text-xs max-w-[130px]"
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Classes</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Gender Filter */}
            <select
              className="input text-xs max-w-[110px]"
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>

            {/* Transport Filter */}
            <select
              className="input text-xs max-w-[130px]"
              value={transportFilter}
              onChange={(e) => {
                setTransportFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Transport</option>
              <option value="YES">🚌 Uses Transport</option>
              <option value="NO">🚶 No Transport</option>
              <option value="NOT_SET">Not Set</option>
            </select>

            {/* Program Type Filter */}
            <select
              className="input text-xs max-w-[130px]"
              value={programTypeFilter}
              onChange={(e) => {
                setProgramTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Programs</option>
              <option value="REGULAR">Regular</option>
              <option value="SUMMER">Summer</option>
              <option value="NIGHT">Night</option>
              <option value="WEEKEND">Weekend</option>
              <option value="EXTENSION">Extension</option>
              <option value="OTHER">Other</option>
            </select>

            {/* Sort Order */}
            <select
              className="input text-xs max-w-[130px]"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <option value="created-desc">Newest First</option>
              <option value="created-asc">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>

            {activeFiltersCount > 0 && (
              <button
                className="btn-ghost text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
                onClick={handleResetFilters}
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
          <span>
            Found <strong>{meta.total}</strong> students
          </span>
          <span className="text-[11px] text-gray-400">
            Page {page} of {meta.totalPages || 1}
          </span>
        </div>
      </div>

      {/* ── Student List (Table or Grid) ──────────────────────────────────── */}
      {studentsLoading ? (
        <PageLoader />
      ) : students.length === 0 ? (
        <div className="card p-12 bg-white border border-gray-200 text-center">
          <EmptyState
            icon={GraduationCap}
            title="No students found"
            description="Try adjusting your search criteria, changing status filters, or register a new student."
          />
        </div>
      ) : viewMode === "table" ? (
        /* ════ TABLE VIEW ════ */
        <div className="card bg-white border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Adm No.</th>
                  <th className="py-3 px-4">Roll</th>
                  <th className="py-3 px-4">Class / Grade</th>
                  <th className="py-3 px-4">House & Category</th>
                  <th className="py-3 px-4">Parent / Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => {
                  const sp = s.studentProfile || {};
                  const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
                  const houseColor = sp.house?.colorHex || "#4F46E5";

                  return (
                    <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                      <td
                        className="py-3.5 px-4 cursor-pointer"
                        onClick={() => navigate(`/students/${s.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={fullName}
                            src={s.avatar}
                            className="w-9 h-9 text-xs"
                          />
                          <div>
                            <p className="font-extrabold text-gray-900 hover:text-primary-600 transition-colors">
                              {fullName}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {s.gender ? (s.gender === "MALE" ? "Male 👦" : "Female 👧") : "—"}
                              {s.email ? ` · ${s.email}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td
                        className="py-3.5 px-4 font-mono font-bold text-gray-700 cursor-pointer"
                        onClick={() => navigate(`/students/${s.id}`)}
                      >
                        <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          {sp.admissionNumber ?? "—"}
                        </span>
                      </td>

                      <td
                        className="py-3.5 px-4 font-mono font-bold text-gray-600 cursor-pointer"
                        onClick={() => navigate(`/students/${s.id}`)}
                      >
                        {sp.rollNumber ?? "—"}
                      </td>

                      <td
                        className="py-3.5 px-4 cursor-pointer"
                        onClick={() => navigate(`/students/${s.id}`)}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {sp.class ? (
                            <Badge variant="blue">
                              <Users className="w-3 h-3 inline mr-1" />
                              {sp.class.name}
                            </Badge>
                          ) : null}
                          {sp.class?.gradeLevel ? (
                            <Badge variant="purple">
                              <GraduationCap className="w-3 h-3 inline mr-1" />
                              {sp.class.gradeLevel.name}
                            </Badge>
                          ) : sp.gradeLevel ? (
                            <Badge variant="purple">
                              <GraduationCap className="w-3 h-3 inline mr-1" />
                              {sp.gradeLevel.name}
                            </Badge>
                          ) : null}
                          {sp.usesTransport && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-[10px] inline-flex items-center gap-1 border border-amber-200/60">
                              <Bus className="w-3 h-3" />
                              {sp.busRoute?.name || "Transport"}
                            </span>
                          )}
                          {(sp.class?.programType || sp.programType) &&
                            (sp.class?.programType || sp.programType) !== "REGULAR" && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200/60">
                                {sp.programTypeLabel || sp.class?.programTypeLabel || (sp.class?.programType || sp.programType)}
                              </span>
                            )}
                          {!sp.class && !sp.gradeLevel && (
                            <span className="text-gray-400 italic">Unassigned</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {sp.house && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white shadow-2xs inline-block"
                              style={{ backgroundColor: houseColor }}
                            >
                              🏠 {sp.house.value}
                            </span>
                          )}
                          {sp.category && (
                            <Badge variant="gray" className="text-[10px]">
                              {sp.category.value}
                            </Badge>
                          )}
                          {!sp.house && !sp.category && (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-gray-600 text-xs">
                        {sp.fatherMobile || sp.motherMobile || s.phone ? (
                          <div className="space-y-0.5">
                            {(sp.fatherMobile || s.phone) && (
                              <p className="flex items-center gap-1 text-[11px]">
                                <Phone className="w-3 h-3 text-gray-400" />
                                {sp.fatherMobile || s.phone}
                              </p>
                            )}
                            {sp.motherMobile && (
                              <p className="text-[10px] text-gray-400">
                                M: {sp.motherMobile}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {sp.status === "ARCHIVE" ? (
                          <Badge variant="purple">Archived</Badge>
                        ) : sp.status === "INACTIVE" || !s.isActive ? (
                          <Badge variant="red">Inactive</Badge>
                        ) : (
                          <Badge variant="green">Active</Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn-ghost p-1.5 text-gray-400 hover:text-primary-600 rounded"
                            onClick={() =>
                              downloadFile(
                                `/users/${s.id}/id-card`,
                                `id-card-${sp.admissionNumber ?? s.id}.pdf`
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ════ GRID CARD VIEW ════ */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {students.map((s) => {
            const sp = s.studentProfile || {};
            const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
            const houseColor = sp.house?.colorHex || "#4F46E5";

            return (
              <div
                key={s.id}
                className="card p-5 hover:shadow-md transition-all duration-200 border border-gray-200 flex flex-col justify-between group bg-white relative overflow-hidden"
              >
                {sp.house && (
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: houseColor }}
                  />
                )}

                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={fullName}
                        src={s.avatar}
                        className="w-11 h-11 rounded-2xl shadow-xs"
                      />
                      <div>
                        <h3
                          className="font-extrabold text-sm text-gray-900 group-hover:text-primary-600 transition-colors cursor-pointer"
                          onClick={() => navigate(`/students/${s.id}`)}
                        >
                          {fullName}
                        </h3>
                        <p className="font-mono text-[11px] font-bold text-gray-500">
                          {sp.admissionNumber || "—"}
                        </p>
                      </div>
                    </div>

                    <div>
                      {sp.status === "ARCHIVE" ? (
                        <Badge variant="purple" className="text-[10px]">Archived</Badge>
                      ) : sp.status === "INACTIVE" || !s.isActive ? (
                        <Badge variant="red" className="text-[10px]">Inactive</Badge>
                      ) : (
                        <Badge variant="green" className="text-[10px]">Active</Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 my-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {sp.class && <Badge variant="blue">{sp.class.name}</Badge>}
                      {sp.class?.gradeLevel && <Badge variant="purple">{sp.class.gradeLevel.name}</Badge>}
                      {sp.usesTransport && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-[10px] inline-flex items-center gap-1 border border-amber-200/60">
                          <Bus className="w-3 h-3" />
                          {sp.busRoute?.name || "Transport"}
                        </span>
                      )}
                      {(sp.class?.programType || sp.programType) &&
                        (sp.class?.programType || sp.programType) !== "REGULAR" && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200/60">
                            {sp.programTypeLabel || sp.class?.programTypeLabel || (sp.class?.programType || sp.programType)}
                          </span>
                        )}
                      {sp.house && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: houseColor }}
                        >
                          {sp.house.value}
                        </span>
                      )}
                    </div>

                    <p className="flex items-center gap-1 text-gray-500 text-[11px] truncate">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </p>

                    {(sp.fatherMobile || s.phone) && (
                      <p className="flex items-center gap-1 text-gray-500 text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{sp.fatherMobile || s.phone}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
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
                          `id-card-${sp.admissionNumber ?? s.id}.pdf`
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
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={meta.totalPages ?? 1}
          onChange={setPage}
        />
      )}

      {/* ── EXPANDED ADD / EDIT STUDENT MODAL ────────────────────────────── */}
      <Modal
        open={addOpen || editOpen}
        onClose={() => {
          setEditOpen(false);
          setAddOpen(false);
        }}
        title={selectedStudent ? `Edit Student: ${selectedStudent.firstName} ${selectedStudent.lastName}` : "Student Admission & Registration"}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <span className="font-bold text-gray-700">*</span> Required fields marked
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary text-xs"
                onClick={() => {
                  setEditOpen(false);
                  setAddOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary text-xs inline-flex items-center gap-1.5"
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
                  ? "Registering…"
                  : "Complete Registration"}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Tabs Navigation */}
          <div className="flex border-b border-gray-200 overflow-x-auto gap-1 pb-1">
            {[
              { id: "personal", label: "1. Personal", icon: User },
              { id: "parents", label: "2. Parents & Guardians", icon: Users },
              { id: "classification", label: "3. Classification", icon: Sparkles },
              { id: "admissions", label: "4. Admissions", icon: FileText },
              ...(selectedStudent ? [{ id: "status", label: "5. Lifecycle & Status", icon: Shield }] : []),
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFormTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFormTab(tab.id)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap",
                    isActive
                      ? "bg-primary-50 text-primary-700 border border-primary-200 shadow-2xs"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: PERSONAL INFORMATION */}
          {activeFormTab === "personal" && (
            <div className="space-y-3 text-xs">
              {/* Student Photo Upload & Live Camera */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 shadow-2xs">
                <PhotoUploadInput
                  value={form.avatar}
                  onChange={(url) => setForm((f) => ({ ...f, avatar: url }))}
                  label="Student Portrait Photo"
                  name={`${form.firstName} ${form.lastName}`}
                  category="STUDENT_PHOTO"
                  hint="Upload a clear portrait or take a picture live with your camera"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label font-bold">First Name *</label>
                  <input
                    className="input text-xs"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="e.g. Abebe"
                    required
                  />
                </div>
                <div>
                  <label className="label font-bold">Middle Name</label>
                  <input
                    className="input text-xs"
                    value={form.middleName}
                    onChange={(e) => setForm((f) => ({ ...f, middleName: e.target.value }))}
                    placeholder="e.g. Kebede"
                  />
                </div>
                <div>
                  <label className="label font-bold">Last Name *</label>
                  <input
                    className="input text-xs"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="e.g. Tadesse"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold">Email Address *</label>
                  <input
                    className="input text-xs"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    disabled={!!selectedStudent}
                    required
                  />
                </div>
                {!selectedStudent && (
                  <div>
                    <label className="label font-bold">Temporary Password</label>
                    <input
                      className="input text-xs"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label font-bold">Gender</label>
                  <select
                    className="input text-xs"
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
                <div>
                  <label className="label font-bold">Full Date of Birth</label>
                  <input
                    type="date"
                    className="input text-xs"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label font-bold">Place of Birth</label>
                  <input
                    className="input text-xs"
                    value={form.birthPlace}
                    onChange={(e) => setForm((f) => ({ ...f, birthPlace: e.target.value }))}
                    placeholder="e.g. Addis Ababa"
                  />
                </div>
                <div>
                  <label className="label font-bold">Nationality</label>
                  <input
                    className="input text-xs"
                    value={form.nationality}
                    onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                    placeholder="e.g. Ethiopian"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label font-bold">City</label>
                  <input
                    className="input text-xs"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="e.g. Addis Ababa"
                  />
                </div>
                <div>
                  <label className="label font-bold">State / Region</label>
                  <input
                    className="input text-xs"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    placeholder="e.g. Oromia / Sheger"
                  />
                </div>
                <div>
                  <label className="label font-bold">Pincode / Postal</label>
                  <input
                    className="input text-xs"
                    value={form.pincode}
                    onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                    placeholder="e.g. 1000"
                  />
                </div>
                <div>
                  <label className="label font-bold">Blood Group</label>
                  <select
                    className="input text-xs"
                    value={form.bloodGroup}
                    onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label font-bold">Full Residential Address</label>
                <input
                  className="input text-xs"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Subcity, Woreda, House No…"
                />
              </div>

              <div>
                <label className="label font-bold">Medical / Allergy Notes</label>
                <input
                  className="input text-xs"
                  value={form.medicalNotes}
                  onChange={(e) => setForm((f) => ({ ...f, medicalNotes: e.target.value }))}
                  placeholder="Any allergies or chronic health considerations…"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PARENTS / GUARDIANS */}
          {activeFormTab === "parents" && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <h4 className="font-extrabold text-gray-900 text-xs flex items-center gap-1.5 border-b border-gray-200 pb-2">
                  <User className="w-3.5 h-3.5 text-blue-600" /> Father's Details & Photo
                </h4>

                <PhotoUploadInput
                  value={form.fatherPhoto}
                  onChange={(url) => setForm((f) => ({ ...f, fatherPhoto: url }))}
                  label="Father's Photo"
                  name={`${form.fatherFirstName} ${form.fatherLastName}`}
                  category="PARENT_PHOTO"
                  hint="Upload father's photo or capture live with camera"
                  size="md"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label font-bold">First Name</label>
                    <input
                      className="input text-xs"
                      value={form.fatherFirstName}
                      onChange={(e) => setForm((f) => ({ ...f, fatherFirstName: e.target.value }))}
                      placeholder="Father's first name"
                    />
                  </div>
                  <div>
                    <label className="label font-bold">Middle Name</label>
                    <input
                      className="input text-xs"
                      value={form.fatherMiddleName}
                      onChange={(e) => setForm((f) => ({ ...f, fatherMiddleName: e.target.value }))}
                      placeholder="Father's middle name"
                    />
                  </div>
                  <div>
                    <label className="label font-bold">Last Name</label>
                    <input
                      className="input text-xs"
                      value={form.fatherLastName}
                      onChange={(e) => setForm((f) => ({ ...f, fatherLastName: e.target.value }))}
                      placeholder="Father's last name"
                    />
                  </div>
                </div>
                <div>
                  <label className="label font-bold">Father's Mobile Number</label>
                  <input
                    className="input text-xs"
                    value={form.fatherMobile}
                    onChange={(e) => setForm((f) => ({ ...f, fatherMobile: e.target.value }))}
                    placeholder="+251 9..."
                  />
                </div>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <h4 className="font-extrabold text-gray-900 text-xs flex items-center gap-1.5 border-b border-gray-200 pb-2">
                  <User className="w-3.5 h-3.5 text-pink-600" /> Mother's Details & Photo
                </h4>

                <PhotoUploadInput
                  value={form.motherPhoto}
                  onChange={(url) => setForm((f) => ({ ...f, motherPhoto: url }))}
                  label="Mother's Photo"
                  name={`${form.motherFirstName} ${form.motherLastName}`}
                  category="PARENT_PHOTO"
                  hint="Upload mother's photo or capture live with camera"
                  size="md"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label font-bold">First Name</label>
                    <input
                      className="input text-xs"
                      value={form.motherFirstName}
                      onChange={(e) => setForm((f) => ({ ...f, motherFirstName: e.target.value }))}
                      placeholder="Mother's first name"
                    />
                  </div>
                  <div>
                    <label className="label font-bold">Middle Name</label>
                    <input
                      className="input text-xs"
                      value={form.motherMiddleName}
                      onChange={(e) => setForm((f) => ({ ...f, motherMiddleName: e.target.value }))}
                      placeholder="Mother's middle name"
                    />
                  </div>
                  <div>
                    <label className="label font-bold">Last Name</label>
                    <input
                      className="input text-xs"
                      value={form.motherLastName}
                      onChange={(e) => setForm((f) => ({ ...f, motherLastName: e.target.value }))}
                      placeholder="Mother's last name"
                    />
                  </div>
                </div>
                <div>
                  <label className="label font-bold">Mother's Mobile Number</label>
                  <input
                    className="input text-xs"
                    value={form.motherMobile}
                    onChange={(e) => setForm((f) => ({ ...f, motherMobile: e.target.value }))}
                    placeholder="+251 9..."
                  />
                </div>
              </div>

              <div>
                <label className="label font-bold">Home Landline Telephone</label>
                <input
                  className="input text-xs"
                  value={form.landline}
                  onChange={(e) => setForm((f) => ({ ...f, landline: e.target.value }))}
                  placeholder="e.g. 011 1..."
                />
              </div>
            </div>
          )}

          {/* TAB 3: CLASSIFICATION & HOUSE */}
          {activeFormTab === "classification" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LookupSelect
                  type="RELIGION"
                  label="Religion"
                  value={form.religionId}
                  onChange={(id) => setForm((f) => ({ ...f, religionId: id }))}
                  placeholder="— Select Religion —"
                />
                <LookupSelect
                  type="CATEGORY"
                  label="Student Category / Group"
                  value={form.categoryId}
                  onChange={(id) => setForm((f) => ({ ...f, categoryId: id }))}
                  placeholder="— Select Category —"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LookupSelect
                  type="FEE_CATEGORY"
                  label="Fee Category / Structure"
                  value={form.feeCategoryId}
                  onChange={(id) => setForm((f) => ({ ...f, feeCategoryId: id }))}
                  placeholder="— Select Fee Category —"
                />
                <LookupSelect
                  type="HOUSE"
                  label="School House"
                  value={form.houseId}
                  onChange={(id) => setForm((f) => ({ ...f, houseId: id }))}
                  placeholder="— Select House —"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <LookupSelect
                  type="CURRICULUM"
                  label="Curriculum"
                  value={form.curriculumId}
                  onChange={(id) => setForm((f) => ({ ...f, curriculumId: id }))}
                  placeholder="— Select Curriculum —"
                />
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
                <div>
                  <label className="label font-bold">Roll Number</label>
                  <input
                    className="input text-xs"
                    value={form.rollNumber}
                    onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
                    placeholder="e.g. 01"
                  />
                </div>
              </div>

              {/* Program / Session Type */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
                <h4 className="font-extrabold text-gray-900 text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" /> Program / Session Type
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label font-bold">Session Type</label>
                    <select
                      className="input text-xs"
                      value={form.programType}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, programType: e.target.value }))
                      }
                    >
                      <option value="REGULAR">Regular Day School</option>
                      <option value="SUMMER">Summer Program / Camp</option>
                      <option value="NIGHT">Night / Evening School</option>
                      <option value="WEEKEND">Weekend Program</option>
                      <option value="EXTENSION">Extension Program</option>
                      <option value="OTHER">Other Custom Session</option>
                    </select>
                  </div>
                  {form.programType === "OTHER" && (
                    <div>
                      <label className="label font-bold">Custom Session Label *</label>
                      <input
                        className="input text-xs"
                        value={form.programTypeLabel}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            programTypeLabel: e.target.value,
                          }))
                        }
                        placeholder="e.g. Distance / Remedial Session"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Transportation Section */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-gray-900 text-xs flex items-center gap-1.5">
                    <Bus className="w-3.5 h-3.5 text-amber-600" /> School Transportation
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, usesTransport: false, busRouteId: "" }))
                      }
                      className={clsx(
                        "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all",
                        !form.usesTransport
                          ? "bg-gray-200 text-gray-800 shadow-2xs"
                          : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      No Transport
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, usesTransport: true }))
                      }
                      className={clsx(
                        "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all",
                        form.usesTransport
                          ? "bg-amber-500 text-white shadow-2xs"
                          : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      🚌 Needs Transport
                    </button>
                  </div>
                </div>

                {form.usesTransport && (
                  <div className="pt-1">
                    <label className="label font-bold">Select Bus Route</label>
                    <select
                      className="input text-xs"
                      value={form.busRouteId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, busRouteId: e.target.value }))
                      }
                    >
                      <option value="">— Select Bus Route —</option>
                      {busRoutes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.driver ? `(Driver: ${r.driver})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ADMISSIONS & HISTORY */}
          {activeFormTab === "admissions" && (
            <div className="space-y-3 text-xs">
              <div>
                <label className="label font-bold">Admission / Registration Number</label>
                <input
                  className="input text-xs font-mono uppercase"
                  value={form.admissionNumber}
                  onChange={(e) => setForm((f) => ({ ...f, admissionNumber: e.target.value }))}
                  placeholder="Leave empty for auto-generated STU..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LookupSelect
                  type="SOURCE"
                  label="Admissions Lead Source"
                  value={form.sourceId}
                  onChange={(id) => setForm((f) => ({ ...f, sourceId: id }))}
                  placeholder="— Select Lead Source —"
                />
                <div>
                  <label className="label font-bold">Reference / Referred By</label>
                  <input
                    className="input text-xs"
                    value={form.reference}
                    onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                    placeholder="Name or details of referring party…"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LookupSelect
                  type="PREVIOUS_SCHOOL"
                  label="Previous School"
                  value={form.previousSchoolId}
                  onChange={(id) => setForm((f) => ({ ...f, previousSchoolId: id }))}
                  placeholder="— Select Previous School —"
                />
                <div>
                  <label className="label font-bold">Previous Class / Academic Year</label>
                  <input
                    className="input text-xs"
                    value={form.previousClassYear}
                    onChange={(e) => setForm((f) => ({ ...f, previousClassYear: e.target.value }))}
                    placeholder="e.g. Grade 9 (2023/24)"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: STATUS & LIFECYCLE (EDIT ONLY) */}
          {activeFormTab === "status" && selectedStudent && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary-600" /> Student Lifecycle Status
                </h4>
                <p className="text-gray-500 text-xs">
                  Changing the student's status controls account access and visibility in standard class/fee lists.
                </p>

                <div className="space-y-2 mt-2">
                  <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-primary-300 transition-colors">
                    <input
                      type="radio"
                      name="status"
                      value="ACTIVE"
                      checked={form.status === "ACTIVE"}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-gray-900">Active</p>
                      <p className="text-gray-500 text-[11px]">Student is currently enrolled and attends classes.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-primary-300 transition-colors">
                    <input
                      type="radio"
                      name="status"
                      value="INACTIVE"
                      checked={form.status === "INACTIVE"}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-gray-900">Inactive / Suspended</p>
                      <p className="text-gray-500 text-[11px]">Temporarily disabled account. Preserves student records.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-primary-300 transition-colors">
                    <input
                      type="radio"
                      name="status"
                      value="ARCHIVE"
                      checked={form.status === "ARCHIVE"}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-gray-900 text-purple-700">Archived (Soft-Deleted)</p>
                      <p className="text-gray-500 text-[11px]">
                        Graduated, transferred, or withdrawn student. Hidden from daily active rosters by default.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
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
            <button className="btn-secondary text-xs" onClick={() => setDeleteConfirmStudent(null)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs bg-red-600 hover:bg-red-700 inline-flex items-center gap-1.5"
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
          </strong>? All records associated with this student account will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}
