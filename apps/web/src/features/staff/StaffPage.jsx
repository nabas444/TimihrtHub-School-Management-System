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
    role: "TEACHER",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["staff", page, search],
    queryFn: () =>
      api
        .get(`/staff/teachers?page=${page}&limit=15&search=${search}`)
        .then((r) => r.data),
    keepPreviousData: true,
  });

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
                  {t.role === "TEACHER" && t.teacherProfile?.specialization && (
                    <p className="text-xs text-primary-600">
                      {t.teacherProfile.specialization}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-400">
                <p>📧 {t.email}</p>
                {t.phone && <p>📞 {t.phone}</p>}
                {t.teacherProfile?.classTeacherOf && (
                  <p className="text-primary-600 font-medium">
                    Class Teacher: {t.teacherProfile.classTeacherOf.name}
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
