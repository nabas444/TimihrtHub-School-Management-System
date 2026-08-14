import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Power, Trash2, Plus } from "lucide-react";
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
import toast from "react-hot-toast";
import { Users } from "lucide-react";

export default function StaffPage() {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
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
  const [activeRole, setActiveRole] = useState("ALL");

  const roleTabs = [
    { label: "All", value: "ALL" },
    { label: "Teachers", value: "TEACHER" },
    { label: "Parents", value: "PARENT" },
    { label: "Finance", value: "FINANCE" },
    { label: "Admins", value: "ADMIN" },
    { label: "Super Admins", value: "SUPER_ADMIN" },
  ];

  const { data: studentOptionsData } = useQuery({
    queryKey: ["student-options"],
    queryFn: () =>
      api.get("/users?role=STUDENT&page=1&limit=200").then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

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

  const createMutation = useMutation({
    mutationFn: (d) => api.post("/users", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member created");
      setAddOpen(false);
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

  const staff = data?.data ?? [];
  const meta = data?.meta ?? {};
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Staff</h1>
          <p className="page-subtitle">{meta.total ?? 0} staff members</p>
        </div>
        {isAdmin() && (
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        )}
      </div>

      <div className="w-full max-w-sm">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search staff…"
        />
      </div>

      {/* Role tabs */}
      <div className="flex gap-2">
        {roleTabs.map((tab) => (
          <button
            key={tab.value}
            className={`btn ${
              activeRole === tab.value ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => {
              setActiveRole(tab.value);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((t) => (
            <div key={t.id} className="card p-5 relative">
              {isAdmin() && (
                <div className="absolute top-4 right-4">
                  <div className="relative">
                    <button
                      className="btn-ghost p-2"
                      onClick={() =>
                        setMenuOpen(menuOpen === t.id ? null : t.id)
                      }
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen === t.id && (
                      <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-max">
                        <button
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => {
                            toggleStatusMutation.mutate(t.id);
                          }}
                        >
                          <Power className="w-4 h-4" />{" "}
                          {t.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          onClick={() => {
                            if (confirm("Delete this staff member?"))
                              deleteMutation.mutate(t.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  name={`${t.firstName} ${t.lastName}`}
                  src={t.avatar}
                  size="lg"
                />
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {t.firstName} {t.lastName}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {t.role === "TEACHER"
                      ? (t.teacherProfile?.qualification ?? "Teacher")
                      : (t.adminProfile?.department ?? t.role)}
                  </p>
                  {t.role === "TEACHER" && (
                    <>
                      {t.teacherProfile?.specialization && (
                        <p className="text-xs text-primary-600">
                          {t.teacherProfile.specialization}
                        </p>
                      )}
                      {t.teacherProfile?.gradeLevel?.name && (
                        <p className="text-xs text-primary-600">
                          Teaches {t.teacherProfile.gradeLevel.name}
                        </p>
                      )}
                      {t.teacherProfile?.assignedClasses?.length > 0 && (
                        <p className="text-xs text-primary-600">
                          Assigned to{" "}
                          {t.teacherProfile.assignedClasses
                            .map((c) => c.name)
                            .join(", ")}
                        </p>
                      )}
                    </>
                  )}
                  {t.role === "PARENT" &&
                    t.parentProfile?.studentLinks?.length > 0 && (
                      <p className="text-xs text-primary-600">
                        Child:{" "}
                        {t.parentProfile.studentLinks
                          .map(
                            (link) =>
                              `${link.studentProfile.user.firstName} ${link.studentProfile.user.lastName}`,
                          )
                          .join(", ")}
                      </p>
                    )}
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-400">
                <p>📧 {t.email}</p>
                {t.phone && <p>📞 {t.phone}</p>}
                {t.teacherProfile?.assignedClasses?.length > 0 && (
                  <p className="text-primary-600 font-medium">
                    Class Teacher of:{" "}
                    {t.teacherProfile.assignedClasses
                      .map((c) => c.name)
                      .join(", ")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {t.teacherProfile?.subjectTeachings?.slice(0, 3).map((st) => (
                  <Badge key={st.subjectId} variant="gray">
                    {st.subject?.name}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <Badge variant={t.isActive ? "green" : "red"}>
                  {t.isActive ? "Active" : "Inactive"}
                </Badge>
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

      {/* Add teacher modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Staff"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create Staff"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name *</label>
              <input
                className="input"
                value={form.firstName}
                onChange={set("firstName")}
                required
              />
            </div>
            <div>
              <label className="label">Last name *</label>
              <input
                className="input"
                value={form.lastName}
                onChange={set("lastName")}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={set("email")}
              required
            />
          </div>
          <div>
            <label className="label">Role *</label>
            <select className="input" value={form.role} onChange={set("role")}>
              <option value="TEACHER">Teacher</option>
              <option value="FINANCE">Finance</option>
              <option value="PARENT">Parent</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Employee ID</label>
            <input
              className="input"
              value={form.employeeId}
              onChange={set("employeeId")}
              placeholder="Auto-generated if blank"
            />
          </div>
          <div>
            <label className="label">Qualification</label>
            <input
              className="input"
              value={form.qualification}
              onChange={set("qualification")}
              placeholder="e.g., B.Ed, M.Sc"
            />
          </div>
          <div>
            <label className="label">Specialization</label>
            <input
              className="input"
              value={form.specialization}
              onChange={set("specialization")}
              placeholder="e.g., Mathematics, Biology"
            />
          </div>
          {form.role === "TEACHER" && (
            <div>
              <label className="label">
                Assign Classes (select one or more)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto border rounded p-2">
                {classes.map((klass) => (
                  <label key={klass.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(form.classIds || []).includes(klass.id)}
                      onChange={() => toggleClass(klass.id)}
                    />
                    <span className="text-sm">{klass.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {form.role === "PARENT" && (
            <div>
              <label className="label">
                Child Students (select one or more)
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-auto border rounded p-2">
                {(studentOptionsData || []).map((student) => (
                  <label key={student.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(form.studentIds || []).includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                    />
                    <span className="text-sm">
                      {student.firstName} {student.lastName}
                      {student.studentProfile?.class?.name
                        ? ` — ${student.studentProfile.class.name}`
                        : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label">Temporary Password</label>
            <input
              className="input"
              value={form.password}
              onChange={set("password")}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
