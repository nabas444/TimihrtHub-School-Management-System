import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MoreVertical,
  Power,
  Trash2,
  Plus,
  Edit2,
  Users,
  GraduationCap,
  BookOpen,
  Mail,
  Phone,
  Sparkles,
  PenTool,
  Check,
  Search,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import api from "../../lib/api";
import {
  Avatar,
  Badge,
  SearchInput,
  Pagination,
} from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import { useAuthStore } from "../../store/authStore";
import clsx from "clsx";
import toast from "react-hot-toast";

// ── Standard Presets ────────────────────────────────────────────────
const COMMON_QUALIFICATIONS = [
  "B.Ed (Bachelor of Education)",
  "B.Sc (Bachelor of Science)",
  "B.A (Bachelor of Arts)",
  "M.Ed (Master of Education)",
  "M.Sc (Master of Science)",
  "M.A (Master of Arts)",
  "Ph.D / Doctorate in Education",
  "PGDE (Postgraduate Diploma in Education)",
  "Diploma in Education",
  "Higher Diploma in Education (HDP)",
  "Associate Degree / Teaching Certificate",
  "High School Diploma / TVET Certificate",
];

const COMMON_SPECIALIZATIONS = [
  "Mathematics",
  "English & Literature",
  "Amharic Language",
  "Physics",
  "Chemistry",
  "Biology",
  "General Science",
  "History & Civics",
  "Geography & Social Studies",
  "Information Technology (ICT)",
  "Physical & Health Education",
  "Art, Music & Performing Arts",
  "Economics & Business Studies",
  "Primary Education (Generalist)",
  "Early Childhood Education (KG)",
  "Special Needs & Inclusive Education",
  "Guidance & Counseling",
  "School Administration / Leadership",
];

export default function StaffPage() {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);
  const [activeRole, setActiveRole] = useState("ALL");

  // Modals state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  // Custom mode toggles for Add Modal
  const [isCustomQualAdd, setIsCustomQualAdd] = useState(false);
  const [isCustomSpecAdd, setIsCustomSpecAdd] = useState(false);

  // Custom mode toggles for Edit Modal
  const [isCustomQualEdit, setIsCustomQualEdit] = useState(false);
  const [isCustomSpecEdit, setIsCustomSpecEdit] = useState(false);

  // Add Form state
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "Welcome@123",
    employeeId: "",
    qualification: "",
    specialization: "",
    classIds: [],
    studentIds: [],
    role: "TEACHER",
  });

  // Edit Form state
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    gender: "",
    employeeId: "",
    qualification: "",
    specialization: "",
    department: "",
  });

  const roleTabs = [
    { label: "All Staff", value: "ALL" },
    { label: "Teachers", value: "TEACHER" },
    { label: "Parents", value: "PARENT" },
    { label: "Finance", value: "FINANCE" },
    { label: "Admins", value: "ADMIN" },
    { label: "Super Admins", value: "SUPER_ADMIN" },
  ];

  // ── Queries ──────────────────────────────────────────────────────
  const { data: studentOptionsData } = useQuery({
    queryKey: ["student-options"],
    queryFn: () =>
      api.get("/users?role=STUDENT&page=1&limit=200").then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get("/academics/subjects").then((r) => r.data.data),
  });

  const recordedSubjects = useMemo(() => {
    return (subjectsData ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [subjectsData]);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", page, search, activeRole],
    queryFn: () => {
      const roleParam = activeRole === "ALL" ? "" : `&role=${activeRole}`;
      return api
        .get(
          `/staff/teachers?page=${page}&limit=15&search=${search}${roleParam}`,
        )
        .then((r) => r.data);
    },
    keepPreviousData: true,
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
  });

  const classes = classesData ?? [];

  // ── Mutations ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d) => api.post("/users", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member created successfully");
      setAddOpen(false);
      resetAddForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create staff");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member updated successfully");
      setEditOpen(false);
      setEditingStaff(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update staff");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/toggle-status`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Status updated");
      setMenuOpen(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member deleted");
      setMenuOpen(null);
    },
  });

  const resetAddForm = () => {
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      password: "Welcome@123",
      employeeId: "",
      qualification: "",
      specialization: "",
      classIds: [],
      studentIds: [],
      role: "TEACHER",
    });
    setIsCustomQualAdd(false);
    setIsCustomSpecAdd(false);
  };

  const handleOpenEdit = (staffUser) => {
    setEditingStaff(staffUser);
    const qual = staffUser.teacherProfile?.qualification || "";
    const spec = staffUser.teacherProfile?.specialization || "";
    const isQualCustom = qual && !COMMON_QUALIFICATIONS.includes(qual);
    const isSpecCustom =
      spec &&
      !COMMON_SPECIALIZATIONS.includes(spec) &&
      !recordedSubjects.some((s) => s.name.toLowerCase() === spec.toLowerCase());

    setEditForm({
      firstName: staffUser.firstName || "",
      lastName: staffUser.lastName || "",
      phone: staffUser.phone || "",
      gender: staffUser.gender || "",
      employeeId: staffUser.teacherProfile?.employeeId || "",
      qualification: qual,
      specialization: spec,
      department: staffUser.adminProfile?.department || "",
    });

    setIsCustomQualEdit(isQualCustom);
    setIsCustomSpecEdit(isSpecCustom);
    setEditOpen(true);
    setMenuOpen(null);
  };

  const staff = data?.data ?? [];
  const meta = data?.meta ?? {};
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setEdit = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleClass = (classId) => {
    setForm((f) => {
      const ids = new Set(f.classIds || []);
      if (ids.has(classId)) ids.delete(classId);
      else ids.add(classId);
      return { ...f, classIds: Array.from(ids) };
    });
  };

  const toggleStudent = (studentId) => {
    setForm((f) => {
      const ids = new Set(f.studentIds || []);
      if (ids.has(studentId)) ids.delete(studentId);
      else ids.add(studentId);
      return { ...f, studentIds: Array.from(ids) };
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-600" />
            Staff & HR Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage teachers, administrative officers, finance staff, and school faculty
          </p>
        </div>
        {isAdmin() && (
          <button
            className="btn-primary inline-flex items-center gap-1.5 shadow-sm"
            onClick={() => {
              resetAddForm();
              setAddOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add Staff Member
          </button>
        )}
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by name, email, specialization, or qualification…"
          />
        </div>

        {/* Role Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {roleTabs.map((tab) => (
            <button
              key={tab.value}
              className={clsx(
                "px-3 py-1.5 rounded-xl font-bold transition-all flex-shrink-0",
                activeRole === tab.value
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900"
              )}
              onClick={() => {
                setActiveRole(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Staff Cards Grid ──────────────────────────────────────────────── */}
      {isLoading ? (
        <PageLoader />
      ) : staff.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm font-bold text-gray-900">No staff members found</p>
          <p className="text-xs text-gray-500 mt-1">
            Try adjusting your search criteria or role filters.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((t) => (
            <div
              key={t.id}
              className="card p-5 relative bg-white border border-gray-200 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Menu dropdown */}
                {isAdmin() && (
                  <div className="absolute top-4 right-4">
                    <div className="relative">
                      <button
                        className="btn-ghost p-1.5 text-gray-400 hover:text-gray-700 rounded"
                        onClick={() =>
                          setMenuOpen(menuOpen === t.id ? null : t.id)
                        }
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpen === t.id && (
                        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-40 py-1 text-xs divide-y divide-gray-100">
                          <button
                            className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-semibold"
                            onClick={() => handleOpenEdit(t)}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-primary-600" /> Edit Profile
                          </button>
                          <button
                            className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-semibold"
                            onClick={() => {
                              toggleStatusMutation.mutate(t.id);
                            }}
                          >
                            <Power className="w-3.5 h-3.5" />{" "}
                            {t.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            className="w-full text-left px-3.5 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 font-semibold"
                            onClick={() => {
                              if (confirm(`Delete staff member ${t.firstName} ${t.lastName}?`))
                                deleteMutation.mutate(t.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Staff
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Profile Header */}
                <div className="flex items-start gap-3 mb-3">
                  <Avatar
                    name={`${t.firstName} ${t.lastName}`}
                    src={t.avatar}
                    size="lg"
                    className="shadow-xs flex-shrink-0"
                  />
                  <div className="min-w-0 pr-6">
                    <h3 className="font-extrabold text-sm text-gray-900 truncate">
                      {t.firstName} {t.lastName}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <Badge variant="blue">{t.role}</Badge>
                      {t.teacherProfile?.employeeId && (
                        <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded border border-gray-200">
                          {t.teacherProfile.employeeId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Qualification & Specialization Badges */}
                <div className="space-y-1.5 my-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                  {t.role === "TEACHER" && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                        <span className="font-bold text-gray-800 truncate">
                          {t.teacherProfile?.qualification || "General Qualified Teacher"}
                        </span>
                      </div>
                      {t.teacherProfile?.specialization && (
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                          <span className="text-primary-700 font-semibold truncate">
                            Spec: {t.teacherProfile.specialization}
                          </span>
                        </div>
                      )}
                      {t.teacherProfile?.assignedClasses?.length > 0 && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          Classes:{" "}
                          <span className="font-semibold text-gray-800">
                            {t.teacherProfile.assignedClasses.map((c) => c.name).join(", ")}
                          </span>
                        </p>
                      )}
                    </>
                  )}

                  {t.role === "ADMIN" && (
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary-600" />
                      <span className="font-bold text-gray-800">
                        Dept: {t.adminProfile?.department || "Administration"}
                      </span>
                    </div>
                  )}

                  {t.role === "PARENT" && t.parentProfile?.studentLinks?.length > 0 && (
                    <p className="text-[11px] text-gray-600">
                      Child:{" "}
                      <span className="font-bold text-gray-900">
                        {t.parentProfile.studentLinks
                          .map(
                            (l) =>
                              `${l.studentProfile.user.firstName} ${l.studentProfile.user.lastName}`
                          )
                          .join(", ")}
                      </span>
                    </p>
                  )}
                </div>

                {/* Contact info */}
                <div className="space-y-1 text-xs text-gray-500">
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{t.email}</span>
                  </p>
                  {t.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{t.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Status footer */}
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                <Badge variant={t.isActive ? "green" : "red"}>
                  {t.isActive ? "Active Account" : "Inactive"}
                </Badge>
                {isAdmin() && (
                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="text-[11px] font-bold text-primary-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={meta.totalPages ?? 1}
        onChange={setPage}
      />

      {/* ════ ADD STAFF MODAL ════ */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Staff Member"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
            >
              {createMutation.isPending ? "Creating Staff…" : "Create Staff"}
            </button>
          </>
        }
      >
        <div className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">First Name *</label>
              <input
                className="input text-xs"
                value={form.firstName}
                onChange={set("firstName")}
                placeholder="e.g. Abebe"
                required
              />
            </div>
            <div>
              <label className="label font-bold">Last Name *</label>
              <input
                className="input text-xs"
                value={form.lastName}
                onChange={set("lastName")}
                placeholder="e.g. Kebede"
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
              onChange={set("email")}
              placeholder="e.g. abebe.k@timhirthub.edu"
              required
            />
          </div>

          <div>
            <label className="label font-bold">Staff Role *</label>
            <select className="input text-xs font-semibold" value={form.role} onChange={set("role")}>
              <option value="TEACHER">Teacher</option>
              <option value="FINANCE">Finance / Accountant</option>
              <option value="PARENT">Parent / Guardian</option>
              <option value="ADMIN">School Administrator</option>
              <option value="SUPER_ADMIN">Super Administrator</option>
            </select>
          </div>

          <div>
            <label className="label font-bold">Employee / Staff ID</label>
            <input
              className="input text-xs font-mono"
              value={form.employeeId}
              onChange={set("employeeId")}
              placeholder="e.g. TCH-001 (Auto-generated if left blank)"
            />
          </div>

          {/* ── Qualification Field (Custom Configurable + Presets) ────────── */}
          {form.role === "TEACHER" && (
            <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="label font-bold text-gray-900 mb-0 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  Academic Qualification
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomQualAdd(!isCustomQualAdd)}
                  className="text-[11px] font-bold text-purple-700 hover:underline flex items-center gap-1"
                >
                  <PenTool className="w-3 h-3" />
                  {isCustomQualAdd ? "Pick from Presets" : "Type Custom Qualification"}
                </button>
              </div>

              {isCustomQualAdd ? (
                <div className="space-y-1">
                  <input
                    className="input text-xs bg-white border-purple-200 focus:border-purple-500"
                    value={form.qualification}
                    onChange={set("qualification")}
                    placeholder="Type custom qualification, e.g. B.Sc in Applied Mathematics, Certified Montessori Teacher..."
                    autoFocus
                  />
                  <p className="text-[10px] text-gray-400">
                    Entering a custom qualification degree or certificate
                  </p>
                </div>
              ) : (
                <select
                  className="input text-xs bg-white font-medium"
                  value={
                    COMMON_QUALIFICATIONS.includes(form.qualification)
                      ? form.qualification
                      : form.qualification
                      ? "__CUSTOM__"
                      : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__CUSTOM__") {
                      setIsCustomQualAdd(true);
                    } else {
                      setForm((f) => ({ ...f, qualification: val }));
                    }
                  }}
                >
                  <option value="">— Select Common Qualification —</option>
                  {COMMON_QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="__CUSTOM__">✏️ Custom Qualification (Type your own...)</option>
                </select>
              )}
            </div>
          )}

          {/* ── Specialization Field (Recorded Subjects + Presets + Custom) ─── */}
          {form.role === "TEACHER" && (
            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="label font-bold text-gray-900 mb-0 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary-600" />
                  Subject Specialization
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomSpecAdd(!isCustomSpecAdd)}
                  className="text-[11px] font-bold text-primary-700 hover:underline flex items-center gap-1"
                >
                  <PenTool className="w-3 h-3" />
                  {isCustomSpecAdd ? "Pick from Subjects" : "Type Custom Specialization"}
                </button>
              </div>

              {isCustomSpecAdd ? (
                <div className="space-y-1">
                  <input
                    className="input text-xs bg-white border-blue-200 focus:border-blue-500"
                    value={form.specialization}
                    onChange={set("specialization")}
                    placeholder="Type custom specialization, e.g. Quantum Physics, Advanced Amharic Grammar..."
                    autoFocus
                  />
                  <p className="text-[10px] text-gray-400">
                    Entering a custom teaching subject or domain
                  </p>
                </div>
              ) : (
                <select
                  className="input text-xs bg-white font-medium"
                  value={form.specialization}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__CUSTOM__") {
                      setIsCustomSpecAdd(true);
                      setForm((f) => ({ ...f, specialization: "" }));
                    } else {
                      setForm((f) => ({ ...f, specialization: val }));
                    }
                  }}
                >
                  <option value="">— Select Subject / Specialization —</option>

                  {/* Recorded School Subjects Optgroup */}
                  {recordedSubjects.length > 0 && (
                    <optgroup label="📚 Recorded School Subjects">
                      {recordedSubjects.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} {s.code ? `(${s.code})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Common Educational Fields Optgroup */}
                  <optgroup label="🎓 Common Academic Disciplines">
                    {COMMON_SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>

                  <option value="__CUSTOM__">✏️ Custom Specialization (Type your own...)</option>
                </select>
              )}
            </div>
          )}

          {/* Teacher Class Assignments */}
          {form.role === "TEACHER" && (
            <div>
              <label className="label font-bold">
                Assign Class(es) (Optional)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50 text-xs">
                {classes.length === 0 ? (
                  <p className="text-gray-400 col-span-2 text-center">No classes created yet</p>
                ) : (
                  classes.map((klass) => (
                    <label
                      key={klass.id}
                      className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(form.classIds || []).includes(klass.id)}
                        onChange={() => toggleClass(klass.id)}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      <span className="font-semibold text-gray-800">{klass.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Parent Student Links */}
          {form.role === "PARENT" && (
            <div>
              <label className="label font-bold">
                Linked Child Students
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50 text-xs">
                {(studentOptionsData || []).map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={(form.studentIds || []).includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <span className="font-semibold text-gray-800">
                      {student.firstName} {student.lastName}
                      {student.studentProfile?.class?.name
                        ? ` — Class ${student.studentProfile.class.name}`
                        : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label font-bold">Initial / Temporary Password</label>
            <input
              className="input text-xs font-mono"
              value={form.password}
              onChange={set("password")}
            />
          </div>
        </div>
      </Modal>

      {/* ════ EDIT STAFF MODAL ════ */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Staff Profile — ${editingStaff?.firstName} ${editingStaff?.lastName}`}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() =>
                updateMutation.mutate({
                  id: editingStaff.id,
                  data: editForm,
                })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving Changes…" : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">First Name *</label>
              <input
                className="input text-xs"
                value={editForm.firstName}
                onChange={setEdit("firstName")}
                required
              />
            </div>
            <div>
              <label className="label font-bold">Last Name *</label>
              <input
                className="input text-xs"
                value={editForm.lastName}
                onChange={setEdit("lastName")}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Phone Number</label>
              <input
                className="input text-xs"
                value={editForm.phone}
                onChange={setEdit("phone")}
                placeholder="e.g. +251 911 000 000"
              />
            </div>
            <div>
              <label className="label font-bold">Gender</label>
              <select
                className="input text-xs"
                value={editForm.gender}
                onChange={setEdit("gender")}
              >
                <option value="">— Select Gender —</option>
                <option value="MALE">👦 Male</option>
                <option value="FEMALE">👧 Female</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label font-bold">Employee ID</label>
            <input
              className="input text-xs font-mono"
              value={editForm.employeeId}
              onChange={setEdit("employeeId")}
              placeholder="e.g. TCH-001"
            />
          </div>

          {/* Teacher Qualification Edit */}
          {editingStaff?.role === "TEACHER" && (
            <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="label font-bold text-gray-900 mb-0 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  Academic Qualification
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomQualEdit(!isCustomQualEdit)}
                  className="text-[11px] font-bold text-purple-700 hover:underline flex items-center gap-1"
                >
                  <PenTool className="w-3 h-3" />
                  {isCustomQualEdit ? "Pick from Presets" : "Type Custom Qualification"}
                </button>
              </div>

              {isCustomQualEdit ? (
                <input
                  className="input text-xs bg-white border-purple-200 focus:border-purple-500"
                  value={editForm.qualification}
                  onChange={setEdit("qualification")}
                  placeholder="Type custom qualification..."
                  autoFocus
                />
              ) : (
                <select
                  className="input text-xs bg-white font-medium"
                  value={
                    COMMON_QUALIFICATIONS.includes(editForm.qualification)
                      ? editForm.qualification
                      : editForm.qualification
                      ? "__CUSTOM__"
                      : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__CUSTOM__") {
                      setIsCustomQualEdit(true);
                    } else {
                      setEditForm((f) => ({ ...f, qualification: val }));
                    }
                  }}
                >
                  <option value="">— Select Common Qualification —</option>
                  {COMMON_QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="__CUSTOM__">✏️ Custom Qualification (Type your own...)</option>
                </select>
              )}
            </div>
          )}

          {/* Teacher Specialization Edit */}
          {editingStaff?.role === "TEACHER" && (
            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="label font-bold text-gray-900 mb-0 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary-600" />
                  Subject Specialization
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomSpecEdit(!isCustomSpecEdit)}
                  className="text-[11px] font-bold text-primary-700 hover:underline flex items-center gap-1"
                >
                  <PenTool className="w-3 h-3" />
                  {isCustomSpecEdit ? "Pick from Subjects" : "Type Custom Specialization"}
                </button>
              </div>

              {isCustomSpecEdit ? (
                <input
                  className="input text-xs bg-white border-blue-200 focus:border-blue-500"
                  value={editForm.specialization}
                  onChange={setEdit("specialization")}
                  placeholder="Type custom specialization..."
                  autoFocus
                />
              ) : (
                <select
                  className="input text-xs bg-white font-medium"
                  value={editForm.specialization}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__CUSTOM__") {
                      setIsCustomSpecEdit(true);
                      setEditForm((f) => ({ ...f, specialization: "" }));
                    } else {
                      setEditForm((f) => ({ ...f, specialization: val }));
                    }
                  }}
                >
                  <option value="">— Select Subject / Specialization —</option>
                  {recordedSubjects.length > 0 && (
                    <optgroup label="📚 Recorded School Subjects">
                      {recordedSubjects.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} {s.code ? `(${s.code})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="🎓 Common Academic Disciplines">
                    {COMMON_SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                  <option value="__CUSTOM__">✏️ Custom Specialization (Type your own...)</option>
                </select>
              )}
            </div>
          )}

          {/* Admin Department Edit */}
          {editingStaff?.role === "ADMIN" && (
            <div>
              <label className="label font-bold">Administrative Department</label>
              <input
                className="input text-xs"
                value={editForm.department}
                onChange={setEdit("department")}
                placeholder="e.g. Academic Affairs, HR, Registrar"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
