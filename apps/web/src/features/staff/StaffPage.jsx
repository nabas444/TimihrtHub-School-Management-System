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
  CreditCard,
  Building,
  User,
  Heart,
  Shield,
  Briefcase,
  MapPin,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import {
  Avatar,
  Badge,
  SearchInput,
  Pagination,
} from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import LookupSelect from "../../components/shared/LookupSelect";
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

const initialStaffForm = {
  role: "TEACHER",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  password: "Welcome@123",
  phone: "",
  gender: "",
  dateOfBirth: "",
  birthPlace: "",
  nationality: "Ethiopian",
  city: "",
  state: "",
  pincode: "",
  address: "",
  emergencyContact: "",
  emergencyPhone: "",
  religionId: "",
  houseId: "",
  employeeId: "",
  designation: "",
  qualification: "",
  specialization: "",
  experienceYears: "",
  department: "",
  occupation: "",
  relation: "",
  annualIncome: "",
  education: "",
  classIds: [],
  studentIds: [],
};

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
  const [activeTab, setActiveTab] = useState("personal"); // "personal" | "academic" | "contact"

  // Custom mode toggles for Add Modal
  const [isCustomQualAdd, setIsCustomQualAdd] = useState(false);
  const [isCustomSpecAdd, setIsCustomSpecAdd] = useState(false);

  // Custom mode toggles for Edit Modal
  const [isCustomQualEdit, setIsCustomQualEdit] = useState(false);
  const [isCustomSpecEdit, setIsCustomSpecEdit] = useState(false);

  // Forms state
  const [form, setForm] = useState(initialStaffForm);
  const [editForm, setEditForm] = useState(initialStaffForm);

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
    mutationFn: (d) => {
      const payload = {
        ...d,
        experienceYears: d.experienceYears ? Number(d.experienceYears) : undefined,
        dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth).toISOString() : undefined,
      };
      return api.post("/users", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member created successfully");
      setAddOpen(false);
      setForm(initialStaffForm);
      setActiveTab("personal");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create staff");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const payload = {
        ...data,
        experienceYears: data.experienceYears ? Number(data.experienceYears) : null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : null,
      };
      return api.patch(`/users/${id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member updated successfully");
      setEditOpen(false);
      setEditingStaff(null);
      setEditForm(initialStaffForm);
      setActiveTab("personal");
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

  const handleOpenEdit = (staffUser) => {
    setEditingStaff(staffUser);
    const tp = staffUser.teacherProfile || {};
    const ap = staffUser.adminProfile || {};
    const pp = staffUser.parentProfile || {};

    const qual = tp.qualification || "";
    const spec = tp.specialization || "";
    const isQualCustom = qual && !COMMON_QUALIFICATIONS.includes(qual);
    const isSpecCustom =
      spec &&
      !COMMON_SPECIALIZATIONS.includes(spec) &&
      !recordedSubjects.some((s) => s.name.toLowerCase() === spec.toLowerCase());

    setEditForm({
      role: staffUser.role,
      firstName: staffUser.firstName || "",
      middleName: staffUser.middleName || "",
      lastName: staffUser.lastName || "",
      email: staffUser.email || "",
      phone: staffUser.phone || "",
      gender: staffUser.gender || "",
      dateOfBirth: staffUser.dateOfBirth ? staffUser.dateOfBirth.split("T")[0] : "",
      birthPlace: staffUser.birthPlace || "",
      nationality: staffUser.nationality || "Ethiopian",
      city: staffUser.city || "",
      state: staffUser.state || "",
      pincode: staffUser.pincode || "",
      address: staffUser.address || "",
      emergencyContact: staffUser.emergencyContact || "",
      emergencyPhone: staffUser.emergencyPhone || "",
      religionId: tp.religion?.id || ap.religion?.id || tp.religionId || ap.religionId || "",
      houseId: tp.house?.id || tp.houseId || "",
      employeeId: tp.employeeId || ap.employeeId || "",
      designation: tp.designation || ap.designation || "",
      qualification: qual,
      specialization: spec,
      experienceYears: tp.experienceYears ? String(tp.experienceYears) : "",
      department: ap.department || "",
      occupation: pp.occupation || "",
      relation: pp.relation || "",
      annualIncome: pp.annualIncome || "",
      education: pp.education || "",
      classIds: tp.assignedClasses?.map((c) => c.id) || [],
      studentIds: pp.studentLinks?.map((l) => l.studentProfileId) || [],
    });

    setIsCustomQualEdit(isQualCustom);
    setIsCustomSpecEdit(isSpecCustom);
    setActiveTab("personal");
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
            Staff & Faculty Directory
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage teachers, administrative officers, finance staff, and school faculty with comprehensive registration details
          </p>
        </div>
        {isAdmin() && (
          <button
            className="btn-primary inline-flex items-center gap-1.5 shadow-sm text-xs"
            onClick={() => {
              setForm(initialStaffForm);
              setActiveTab("personal");
              setAddOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add Staff Member
          </button>
        )}
      </div>

      {/* ── Search & Filters ─────────────────────────────────────────────── */}
      <div className="card p-4 bg-white border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-9 text-xs"
              placeholder="Search staff by name, email, phone, employee ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {roleTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveRole(tab.value);
                  setPage(1);
                }}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap",
                  activeRole === tab.value
                    ? "bg-primary-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Staff Table ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <PageLoader />
      ) : staff.length === 0 ? (
        <div className="card p-12 bg-white border border-gray-200 text-center">
          <p className="text-gray-400 text-sm font-semibold">No staff members found matching criteria.</p>
        </div>
      ) : (
        <div className="card bg-white border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role & ID</th>
                  <th className="py-3 px-4">Designation / Subject</th>
                  <th className="py-3 px-4">House & Religion</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((u) => {
                  const tp = u.teacherProfile || {};
                  const ap = u.adminProfile || {};
                  const fullName = [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ");
                  const empId = tp.employeeId || ap.employeeId || "—";
                  const house = tp.house;

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={fullName} src={u.avatar} className="w-9 h-9 text-xs" />
                          <div>
                            <p className="font-extrabold text-gray-900">{fullName}</p>
                            <p className="text-[11px] text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <Badge variant="purple" className="text-[10px]">{u.role}</Badge>
                          <p className="font-mono text-[11px] font-bold text-gray-500">{empId}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-gray-700">
                        {tp.specialization ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-gray-900">{tp.specialization}</span>
                            {tp.qualification && (
                              <p className="text-[11px] text-gray-400">{tp.qualification}</p>
                            )}
                          </div>
                        ) : ap.department ? (
                          <span className="font-bold text-gray-900">{ap.department}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {house && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                              style={{ backgroundColor: house.colorHex || "#4F46E5" }}
                            >
                              🏠 {house.value}
                            </span>
                          )}
                          {(tp.religion || ap.religion) && (
                            <Badge variant="gray" className="text-[10px]">
                              {(tp.religion || ap.religion)?.value}
                            </Badge>
                          )}
                          {!house && !tp.religion && !ap.religion && (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-gray-600">
                        {u.phone ? (
                          <p className="flex items-center gap-1 text-[11px]">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {u.phone}
                          </p>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                        {u.emergencyContact && (
                          <p className="text-[10px] text-gray-400">
                            Emerg: {u.emergencyContact} {u.emergencyPhone ? `(${u.emergencyPhone})` : ""}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={u.isActive ? "green" : "red"}>
                          {u.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn-ghost p-1.5 text-gray-400 hover:text-primary-600 rounded"
                            onClick={() =>
                              downloadFile(
                                `/users/${u.id}/id-card`,
                                `id-card-${empId !== "—" ? empId : u.id}.pdf`
                              ).catch(() => toast.error("Could not generate staff ID card"))
                            }
                            title="Download Staff ID Card"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin() && (
                            <>
                              <button
                                className="btn-ghost p-1.5 text-gray-400 hover:text-primary-600 rounded"
                                onClick={() => handleOpenEdit(u)}
                                title="Edit Profile"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className={clsx(
                                  "btn-ghost p-1.5 rounded",
                                  u.isActive
                                    ? "text-amber-500 hover:text-amber-700"
                                    : "text-emerald-500 hover:text-emerald-700"
                                )}
                                onClick={() => toggleStatusMutation.mutate(u.id)}
                                title={u.isActive ? "Deactivate" : "Activate"}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="btn-ghost p-1.5 text-gray-400 hover:text-red-600 rounded"
                                onClick={() => deleteMutation.mutate(u.id)}
                                title="Delete"
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
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
      )}

      {/* ── ADD STAFF MODAL ──────────────────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Staff Member / Teacher Registration"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-gray-400">* Required fields</span>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary text-xs inline-flex items-center gap-1.5"
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
              >
                {createMutation.isPending ? "Creating…" : "Register Staff Member"}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 gap-1 pb-1">
            {[
              { id: "personal", label: "1. Personal & Identity", icon: User },
              { id: "academic", label: "2. Role & Academic Info", icon: Briefcase },
              { id: "contact", label: "3. Contact & Address", icon: MapPin },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors",
                    activeTab === tab.id
                      ? "bg-primary-50 text-primary-700 border border-primary-200"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: PERSONAL */}
          {activeTab === "personal" && (
            <div className="space-y-3 text-xs">
              <div>
                <label className="label font-bold">System Role *</label>
                <select className="input text-xs font-bold" value={form.role} onChange={set("role")}>
                  <option value="TEACHER">Teacher / Faculty</option>
                  <option value="ADMIN">Administrator</option>
                  <option value="FINANCE">Finance Officer</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="PARENT">Parent / Guardian</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label font-bold">First Name *</label>
                  <input className="input text-xs" value={form.firstName} onChange={set("firstName")} required />
                </div>
                <div>
                  <label className="label font-bold">Middle Name</label>
                  <input className="input text-xs" value={form.middleName} onChange={set("middleName")} placeholder="Optional" />
                </div>
                <div>
                  <label className="label font-bold">Last Name *</label>
                  <input className="input text-xs" value={form.lastName} onChange={set("lastName")} required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold">Email Address *</label>
                  <input className="input text-xs" type="email" value={form.email} onChange={set("email")} required />
                </div>
                <div>
                  <label className="label font-bold">Initial Password</label>
                  <input className="input text-xs font-mono" value={form.password} onChange={set("password")} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label font-bold">Gender</label>
                  <select className="input text-xs" value={form.gender} onChange={set("gender")}>
                    <option value="">— Select —</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
                <div>
                  <label className="label font-bold">Date of Birth</label>
                  <input type="date" className="input text-xs" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
                </div>
                <div>
                  <label className="label font-bold">Birth Place</label>
                  <input className="input text-xs" value={form.birthPlace} onChange={set("birthPlace")} placeholder="e.g. Addis Ababa" />
                </div>
                <div>
                  <label className="label font-bold">Nationality</label>
                  <input className="input text-xs" value={form.nationality} onChange={set("nationality")} placeholder="Ethiopian" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LookupSelect
                  type="RELIGION"
                  label="Religion"
                  value={form.religionId}
                  onChange={(id) => setForm((f) => ({ ...f, religionId: id }))}
                />
                {form.role === "TEACHER" && (
                  <LookupSelect
                    type="HOUSE"
                    label="School House"
                    value={form.houseId}
                    onChange={(id) => setForm((f) => ({ ...f, houseId: id }))}
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACADEMIC & ROLE SPECIFICS */}
          {activeTab === "academic" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold">Employee / Staff ID</label>
                  <input className="input text-xs font-mono" value={form.employeeId} onChange={set("employeeId")} placeholder="Auto-generated if empty" />
                </div>
                <div>
                  <label className="label font-bold">Job Designation / Title</label>
                  <input className="input text-xs" value={form.designation} onChange={set("designation")} placeholder="e.g. Senior Math Teacher, Registrar" />
                </div>
              </div>

              {form.role === "TEACHER" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label font-bold">Subject Specialization</label>
                      <input className="input text-xs" value={form.specialization} onChange={set("specialization")} placeholder="e.g. Mathematics" />
                    </div>
                    <div>
                      <label className="label font-bold">Qualification</label>
                      <input className="input text-xs" value={form.qualification} onChange={set("qualification")} placeholder="e.g. B.Ed, M.Sc" />
                    </div>
                  </div>

                  <div>
                    <label className="label font-bold">Years of Experience</label>
                    <input type="number" min="0" max="60" className="input text-xs" value={form.experienceYears} onChange={set("experienceYears")} placeholder="e.g. 5" />
                  </div>

                  <div>
                    <label className="label font-bold">Assign Classes (Optional)</label>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50 text-xs">
                      {classes.map((k) => (
                        <label key={k.id} className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer">
                          <input type="checkbox" checked={(form.classIds || []).includes(k.id)} onChange={() => toggleClass(k.id)} />
                          <span className="font-semibold text-gray-800">{k.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(form.role === "ADMIN" || form.role === "FINANCE" || form.role === "SUPER_ADMIN") && (
                <div>
                  <label className="label font-bold">Department</label>
                  <input className="input text-xs" value={form.department} onChange={set("department")} placeholder="e.g. Academic Affairs, Finance, Operations" />
                </div>
              )}

              {form.role === "PARENT" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label font-bold">Occupation</label>
                    <input className="input text-xs" value={form.occupation} onChange={set("occupation")} placeholder="e.g. Engineer, Doctor" />
                  </div>
                  <div>
                    <label className="label font-bold">Relation to Student</label>
                    <select className="input text-xs" value={form.relation} onChange={set("relation")}>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CONTACT & ADDRESS */}
          {activeTab === "contact" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold">Primary Phone Number</label>
                  <input className="input text-xs" value={form.phone} onChange={set("phone")} placeholder="+251 9..." />
                </div>
                <div>
                  <label className="label font-bold">City</label>
                  <input className="input text-xs" value={form.city} onChange={set("city")} placeholder="Addis Ababa" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold">State / Region</label>
                  <input className="input text-xs" value={form.state} onChange={set("state")} placeholder="e.g. Sheger" />
                </div>
                <div>
                  <label className="label font-bold">Pincode</label>
                  <input className="input text-xs" value={form.pincode} onChange={set("pincode")} placeholder="1000" />
                </div>
              </div>

              <div>
                <label className="label font-bold">Residential Address</label>
                <input className="input text-xs" value={form.address} onChange={set("address")} placeholder="Subcity, Woreda, House No…" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="label font-bold text-red-700">Emergency Contact Person</label>
                  <input className="input text-xs" value={form.emergencyContact} onChange={set("emergencyContact")} placeholder="Name of emergency contact" />
                </div>
                <div>
                  <label className="label font-bold text-red-700">Emergency Contact Phone</label>
                  <input className="input text-xs" value={form.emergencyPhone} onChange={set("emergencyPhone")} placeholder="+251 9..." />
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── EDIT STAFF MODAL ──────────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Staff Profile — ${editingStaff?.firstName} ${editingStaff?.lastName}`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-gray-400">* Required fields</span>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary text-xs inline-flex items-center gap-1.5"
                onClick={() => updateMutation.mutate({ id: editingStaff.id, data: editForm })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex border-b border-gray-200 gap-1 pb-1">
            {[
              { id: "personal", label: "1. Personal", icon: User },
              { id: "academic", label: "2. Role & Academic", icon: Briefcase },
              { id: "contact", label: "3. Contact & Address", icon: MapPin },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors",
                    activeTab === tab.id
                      ? "bg-primary-50 text-primary-700 border border-primary-200"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* EDIT TAB 1: PERSONAL */}
          {activeTab === "personal" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label font-bold">First Name *</label>
                  <input className="input text-xs" value={editForm.firstName} onChange={setEdit("firstName")} required />
                </div>
                <div>
                  <label className="label font-bold">Middle Name</label>
                  <input className="input text-xs" value={editForm.middleName} onChange={setEdit("middleName")} />
                </div>
                <div>
                  <label className="label font-bold">Last Name *</label>
                  <input className="input text-xs" value={editForm.lastName} onChange={setEdit("lastName")} required />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label font-bold">Gender</label>
                  <select className="input text-xs" value={editForm.gender} onChange={setEdit("gender")}>
                    <option value="">— Select —</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
                <div>
                  <label className="label font-bold">Date of Birth</label>
                  <input type="date" className="input text-xs" value={editForm.dateOfBirth} onChange={setEdit("dateOfBirth")} />
                </div>
                <div>
                  <label className="label font-bold">Birth Place</label>
                  <input className="input text-xs" value={editForm.birthPlace} onChange={setEdit("birthPlace")} />
                </div>
                <div>
                  <label className="label font-bold">Nationality</label>
                  <input className="input text-xs" value={editForm.nationality} onChange={setEdit("nationality")} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LookupSelect
                  type="RELIGION"
                  label="Religion"
                  value={editForm.religionId}
                  onChange={(id) => setEditForm((f) => ({ ...f, religionId: id }))}
                />
                {editingStaff?.role === "TEACHER" && (
                  <LookupSelect
                    type="HOUSE"
                    label="School House"
                    value={editForm.houseId}
                    onChange={(id) => setEditForm((f) => ({ ...f, houseId: id }))}
                  />
                )}
              </div>
            </div>
          )}

          {/* EDIT TAB 2: ACADEMIC */}
          {activeTab === "academic" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold">Employee ID</label>
                  <input className="input text-xs font-mono" value={editForm.employeeId} onChange={setEdit("employeeId")} />
                </div>
                <div>
                  <label className="label font-bold">Designation / Title</label>
                  <input className="input text-xs" value={editForm.designation} onChange={setEdit("designation")} />
                </div>
              </div>

              {editingStaff?.role === "TEACHER" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label font-bold">Specialization</label>
                      <input className="input text-xs" value={editForm.specialization} onChange={setEdit("specialization")} />
                    </div>
                    <div>
                      <label className="label font-bold">Qualification</label>
                      <input className="input text-xs" value={editForm.qualification} onChange={setEdit("qualification")} />
                    </div>
                  </div>
                  <div>
                    <label className="label font-bold">Experience (Years)</label>
                    <input type="number" className="input text-xs" value={editForm.experienceYears} onChange={setEdit("experienceYears")} />
                  </div>
                </>
              )}

              {(editingStaff?.role === "ADMIN" || editingStaff?.role === "FINANCE") && (
                <div>
                  <label className="label font-bold">Department</label>
                  <input className="input text-xs" value={editForm.department} onChange={setEdit("department")} />
                </div>
              )}
            </div>
          )}

          {/* EDIT TAB 3: CONTACT */}
          {activeTab === "contact" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold">Phone Number</label>
                  <input className="input text-xs" value={editForm.phone} onChange={setEdit("phone")} />
                </div>
                <div>
                  <label className="label font-bold">City</label>
                  <input className="input text-xs" value={editForm.city} onChange={setEdit("city")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label font-bold">State</label>
                  <input className="input text-xs" value={editForm.state} onChange={setEdit("state")} />
                </div>
                <div>
                  <label className="label font-bold">Pincode</label>
                  <input className="input text-xs" value={editForm.pincode} onChange={setEdit("pincode")} />
                </div>
              </div>

              <div>
                <label className="label font-bold">Address</label>
                <input className="input text-xs" value={editForm.address} onChange={setEdit("address")} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="label font-bold text-red-700">Emergency Contact Name</label>
                  <input className="input text-xs" value={editForm.emergencyContact} onChange={setEdit("emergencyContact")} />
                </div>
                <div>
                  <label className="label font-bold text-red-700">Emergency Contact Phone</label>
                  <input className="input text-xs" value={editForm.emergencyPhone} onChange={setEdit("emergencyPhone")} />
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
