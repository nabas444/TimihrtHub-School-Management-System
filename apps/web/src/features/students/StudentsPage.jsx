import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Download, MoreVertical, Power, Trash2 } from "lucide-react";
import api from "../../lib/api";
import {
  Avatar,
  Badge,
  EmptyState,
  SearchInput,
  Pagination,
} from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import { useAuthStore } from "../../store/authStore";
import toast from "react-hot-toast";
import { GraduationCap } from "lucide-react";

export default function StudentsPage() {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
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

  // Fetch current user's full profile (used to determine teacher's assigned classes)
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/users/me").then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["users", "STUDENT", page, search, meData?.id],
    queryFn: () => {
      // build URL and include classIds if current user is a teacher
      const me = meData;
      let url = `/users?role=STUDENT&page=${page}&limit=20&search=${encodeURIComponent(search)}`;
      if (me?.role === "TEACHER") {
        const classIds =
          me?.teacherProfile?.assignedClasses?.map((c) => c.id) || [];
        if (classIds.length > 0) url += `&classIds=${classIds.join(",")}`;
      }
      return api.get(url).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post("/users", { ...d, role: "STUDENT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "STUDENT"] });
      toast.success("Student created");
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
  });

  const updateMutation = useMutation({
    mutationFn: (d) => api.patch(`/users/${selectedStudent.id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "STUDENT"] });
      toast.success("Student updated");
      setEditOpen(false);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/toggle-status`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "STUDENT"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success("Status updated");
      setMenuOpen(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "STUDENT"] });
      toast.success("Student deleted");
      setMenuOpen(null);
    },
  });

  const students = data?.data ?? [];
  const meta = data?.meta ?? {};
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
        ? String(
            new Date().getFullYear() -
              new Date(student.dateOfBirth).getFullYear(),
          )
        : "",
      rollNumber: student.studentProfile?.rollNumber ?? "",
    });
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{meta.total ?? 0} enrolled students</p>
        </div>
        {isAdmin() && (
          <div className="flex gap-2">
            <button className="btn-secondary">
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setSelectedStudent(null);
                setAddOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Add Student
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="w-full max-w-sm">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search students…"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Admission No.</th>
                <th>Class</th>
                <th>Email</th>
                <th>Status</th>
                {isAdmin() && <th className="text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={isAdmin() ? 6 : 5}>
                    <EmptyState
                      icon={GraduationCap}
                      title="No students found"
                      description="Add your first student to get started"
                    />
                  </td>
                </tr>
              )}
              {students.map((s) => (
                <tr key={s.id}>
                  <td
                    className="cursor-pointer"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${s.firstName} ${s.lastName}`}
                        src={s.avatar}
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {s.firstName} {s.lastName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {s.gender ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td
                    className="font-mono text-sm cursor-pointer"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    {s.studentProfile?.admissionNumber ?? "—"}
                  </td>
                  <td
                    className="cursor-pointer"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    {s.studentProfile?.class ? (
                      <Badge variant="blue">
                        {s.studentProfile.class.name}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className="text-gray-500 text-sm cursor-pointer"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    {s.email}
                  </td>
                  <td>
                    <Badge variant={s.isActive ? "green" : "red"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {isAdmin() && (
                    <td className="text-center">
                      <div className="relative">
                        <button
                          className="btn-ghost p-2"
                          onClick={() =>
                            setMenuOpen(menuOpen === s.id ? null : s.id)
                          }
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuOpen === s.id && (
                          <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex items-center gap-2 p-1 whitespace-nowrap">
                            <button
                              className="btn-ghost p-2 text-sm flex items-center gap-2"
                              onClick={() => {
                                handleEditOpen(s);
                                setMenuOpen(null);
                              }}
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              className="btn-ghost p-2 text-sm flex items-center gap-2"
                              onClick={() => {
                                toggleStatusMutation.mutate(s.id);
                              }}
                              title={s.isActive ? "Deactivate" : "Activate"}
                            >
                              <Power className="w-4 h-4" />
                              <span className="sr-only">
                                {s.isActive ? "Deactivate" : "Activate"}
                              </span>
                            </button>
                            <button
                              className="btn-ghost p-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              onClick={() => {
                                if (confirm("Delete this student?"))
                                  deleteMutation.mutate(s.id);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="sr-only">Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 pb-4">
            <Pagination
              page={page}
              totalPages={meta.totalPages ?? 1}
              onChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={addOpen || editOpen}
        onClose={() => {
          setEditOpen(false);
          setAddOpen(false);
        }}
        title={selectedStudent ? "Edit Student" : "Add New Student"}
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
              className="btn-primary"
              onClick={() =>
                selectedStudent
                  ? updateMutation.mutate(buildStudentUpdatePayload())
                  : createMutation.mutate(buildStudentCreatePayload())
              }
              disabled={
                selectedStudent
                  ? updateMutation.isPending
                  : createMutation.isPending
              }
            >
              {selectedStudent
                ? updateMutation.isPending
                  ? "Updating…"
                  : "Update Student"
                : createMutation.isPending
                  ? "Creating…"
                  : "Create Student"}
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Sex</label>
              <select
                className="input"
                value={form.gender}
                onChange={set("gender")}
              >
                <option value="">— Select sex —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="label">Age</label>
              <input
                className="input"
                type="number"
                min="1"
                value={form.age}
                onChange={set("age")}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Roll number</label>
              <input
                className="input"
                value={form.rollNumber}
                onChange={set("rollNumber")}
                placeholder="Optional"
              />
            </div>
          </div>
          {!selectedStudent && (
            <>
              <div>
                <label className="label">Admission Number</label>
                <input
                  className="input"
                  value={form.admissionNumber}
                  onChange={set("admissionNumber")}
                  placeholder="Auto-generated if blank"
                />
              </div>
              <div>
                <label className="label">Assign to Class</label>
                <select
                  className="input"
                  value={form.classId}
                  onChange={set("classId")}
                >
                  <option value="">— Select class —</option>
                  {(classesData ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Temporary Password</label>
                <input
                  className="input"
                  value={form.password}
                  onChange={set("password")}
                />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
