import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  GraduationCap,
  Briefcase,
  MapPin,
  Edit2,
  Trash2,
  Power,
  Link as LinkIcon,
  Unlink,
  CheckCircle2,
  UserCheck,
  Star,
  DollarSign,
  BookOpen,
} from "lucide-react";
import api from "../../lib/api";
import {
  Avatar,
  Badge,
  SearchInput,
  Pagination,
  PageLoader,
  Modal,
} from "../../components/ui/index";
import clsx from "clsx";
import toast from "react-hot-toast";

const initialParentForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  password: "Welcome@123",
  phone: "",
  gender: "MALE",
  address: "",
  city: "Addis Ababa",
  occupation: "",
  relation: "Father",
  annualIncome: "",
  education: "",
  linkedStudentIds: [],
};

export default function ParentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);

  const [form, setForm] = useState(initialParentForm);
  const [editForm, setEditForm] = useState({});
  const [selectedStudentToLink, setSelectedStudentToLink] = useState("");
  const [isPrimaryLink, setIsPrimaryLink] = useState(true);
  const [studentRelation, setStudentRelation] = useState("Guardian");

  // Fetch Parents
  const { data, isLoading } = useQuery({
    queryKey: ["parents", page, search],
    queryFn: () =>
      api
        .get(`/parents?page=${page}&limit=15${search ? `&search=${encodeURIComponent(search)}` : ""}`)
        .then((r) => r.data),
  });

  const parents = data?.data || [];
  const meta = data?.meta || { total: 0, totalPages: 1 };

  // Fetch Students for linking
  const { data: studentsData } = useQuery({
    queryKey: ["all-students-lookup"],
    queryFn: () => api.get("/academics/students?page=1&limit=300").then((r) => r.data?.data || []),
    staleTime: 1000 * 60 * 5,
  });
  const allStudents = studentsData || [];

  // Create Parent Mutation
  const createMutation = useMutation({
    mutationFn: (newParent) => api.post("/parents", newParent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parents"] });
      toast.success("Parent account created successfully");
      setAddModalOpen(false);
      setForm(initialParentForm);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create parent account");
    },
  });

  // Update Parent Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updateData }) => api.patch(`/parents/${id}`, updateData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parents"] });
      toast.success("Parent profile updated");
      setEditModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update parent");
    },
  });

  // Link Student Mutation
  const linkMutation = useMutation({
    mutationFn: ({ parentUserId, studentProfileId, isPrimary, relation }) =>
      api.post(`/parents/${parentUserId}/link-student`, { studentProfileId, isPrimary, relation }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parents"] });
      toast.success("Student linked successfully");
      setSelectedStudentToLink("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to link student");
    },
  });

  // Unlink Student Mutation
  const unlinkMutation = useMutation({
    mutationFn: ({ parentUserId, linkId }) =>
      api.delete(`/parents/${parentUserId}/unlink-student/${linkId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parents"] });
      toast.success("Student unlinked from parent");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to unlink student");
    },
  });

  // Toggle Active Status
  const toggleStatusMutation = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/toggle-status`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parents"] });
      toast.success("Parent status updated");
    },
  });

  const handleOpenEdit = (p) => {
    setSelectedParent(p);
    setEditForm({
      firstName: p.firstName || "",
      middleName: p.middleName || "",
      lastName: p.lastName || "",
      phone: p.phone || "",
      gender: p.gender || "MALE",
      address: p.address || "",
      city: p.city || "",
      occupation: p.parentProfile?.occupation || "",
      relation: p.parentProfile?.relation || "Parent",
      annualIncome: p.parentProfile?.annualIncome || "",
      education: p.parentProfile?.education || "",
    });
    setEditModalOpen(true);
  };

  const handleOpenLinks = (p) => {
    setSelectedParent(p);
    setStudentRelation(p.parentProfile?.relation || "Guardian");
    setLinkModalOpen(true);
  };

  const toggleFormStudent = (studentId) => {
    setForm((prev) => {
      const exists = prev.linkedStudentIds.includes(studentId);
      return {
        ...prev,
        linkedStudentIds: exists
          ? prev.linkedStudentIds.filter((id) => id !== studentId)
          : [...prev.linkedStudentIds, studentId],
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-primary-600" />
            Parents & Guardians Directory
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage parent portal accounts, guardian contacts, and student-parent family relationships.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(initialParentForm);
            setAddModalOpen(true);
          }}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Parent Account
        </button>
      </div>

      {/* ── SEARCH & STATS ──────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="w-full md:w-96">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by parent name, email, phone, occupation…"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="font-semibold text-gray-800">{meta.total || 0}</span> Parents Registered
        </div>
      </div>

      {/* ── PARENTS TABLE ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <PageLoader />
        ) : parents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-gray-700">No Parent Records Found</h3>
            <p className="text-xs text-gray-400 mt-1">
              {search ? "No parents matched your search criteria." : "Get started by adding a parent or guardian."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Parent / Guardian</th>
                  <th className="py-3 px-4">Relationship & Info</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Linked Children (Students)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {parents.map((p) => {
                  const links = p.parentProfile?.studentLinks || [];
                  const fullName = `${p.firstName} ${p.middleName ? p.middleName + " " : ""}${p.lastName}`;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={p.avatar}
                            name={fullName}
                            size="md"
                            className="bg-purple-100 text-purple-700 font-bold border border-purple-200"
                          />
                          <div>
                            <p className="font-bold text-gray-900">{fullName}</p>
                            <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-gray-400" />
                              {p.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Relation & Occupation */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                            {p.parentProfile?.relation || "Parent"}
                          </span>
                          {p.parentProfile?.occupation && (
                            <p className="text-[11px] text-gray-500 flex items-center gap-1">
                              <Briefcase className="w-3 h-3 text-gray-400" />
                              {p.parentProfile.occupation}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Contact & City */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {p.phone ? (
                            <p className="font-semibold text-gray-800 flex items-center gap-1 text-[11px]">
                              <Phone className="w-3 h-3 text-gray-400" />
                              {p.phone}
                            </p>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                          {p.city && (
                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" />
                              {p.city}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Linked Children */}
                      <td className="py-3.5 px-4">
                        {links.length === 0 ? (
                          <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-medium">
                            No students linked
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {links.map((link) => {
                              const s = link.studentProfile;
                              const studentName = s?.user
                                ? `${s.user.firstName} ${s.user.lastName}`
                                : "Student";
                              const className = s?.class?.name || s?.class?.gradeLevel?.name || "Class";

                              return (
                                <div
                                  key={link.id}
                                  className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-[11px]"
                                  title={`Admission: ${s?.admissionNumber || "N/A"}`}
                                >
                                  <GraduationCap className="w-3 h-3 text-blue-600" />
                                  <span className="font-semibold">{studentName}</span>
                                  <span className="text-[10px] text-blue-500 font-mono">({className})</span>
                                  {link.isPrimary && (
                                    <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-400 ml-0.5" title="Primary Guardian" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge variant={p.isActive ? "green" : "red"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn-ghost p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded"
                            onClick={() => handleOpenLinks(p)}
                            title="Manage Linked Children"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <button
                            className="btn-ghost p-1.5 text-gray-500 hover:text-primary-600 rounded"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Parent Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className={clsx(
                              "btn-ghost p-1.5 rounded",
                              p.isActive ? "text-amber-500 hover:text-amber-700" : "text-emerald-500 hover:text-emerald-700"
                            )}
                            onClick={() => toggleStatusMutation.mutate(p.id)}
                            title={p.isActive ? "Deactivate Account" : "Activate Account"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex justify-end">
            <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── ADD PARENT MODAL ────────────────────────────────────────────── */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Parent / Guardian Account"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-gray-400">* Required fields</span>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={() => setAddModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary text-xs"
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.firstName || !form.lastName || !form.email}
              >
                {createMutation.isPending ? "Creating Account…" : "Create Parent"}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">First Name *</label>
              <input
                className="input text-xs"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label font-bold">Middle Name</label>
              <input
                className="input text-xs"
                value={form.middleName}
                onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label font-bold">Last Name *</label>
              <input
                className="input text-xs"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Email Address (Login Username) *</label>
              <input
                type="email"
                className="input text-xs"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label font-bold">Initial Password</label>
              <input
                className="input text-xs font-mono"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Primary Phone Number</label>
              <input
                className="input text-xs"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+251 9..."
              />
            </div>
            <div>
              <label className="label font-bold">Relationship to Student</label>
              <select
                className="input text-xs"
                value={form.relation}
                onChange={(e) => setForm({ ...form, relation: e.target.value })}
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
                <option value="Uncle">Uncle</option>
                <option value="Aunt">Aunt</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Sponsor">Sponsor</option>
              </select>
            </div>
            <div>
              <label className="label font-bold">Occupation</label>
              <input
                className="input text-xs"
                value={form.occupation}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                placeholder="e.g. Civil Engineer, Trader"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">City / Location</label>
              <input
                className="input text-xs"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-bold">Residential Address</label>
              <input
                className="input text-xs"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Woreda, Subcity, House No"
              />
            </div>
          </div>

          {/* Student Selector */}
          <div className="pt-2 border-t border-gray-100">
            <label className="label font-bold flex items-center justify-between">
              <span>Link Student(s) to this Parent Account</span>
              <span className="text-[10px] text-gray-400 font-normal">
                {form.linkedStudentIds.length} selected
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50 text-xs">
              {allStudents.map((s) => {
                const sName = s.user ? `${s.user.firstName} ${s.user.lastName}` : "Student";
                const isSelected = form.linkedStudentIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={clsx(
                      "flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-colors",
                      isSelected
                        ? "bg-purple-50 border-purple-300 text-purple-900 font-semibold"
                        : "bg-white border-gray-100 hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFormStudent(s.id)}
                      className="rounded text-purple-600"
                    />
                    <div className="truncate">
                      <p className="truncate">{sName}</p>
                      <p className="text-[10px] text-gray-400 font-mono">
                        {s.admissionNumber || s.class?.name || "No ID"}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── EDIT PARENT MODAL ────────────────────────────────────────────── */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Parent Profile — ${selectedParent?.firstName} ${selectedParent?.lastName}`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setEditModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() =>
                updateMutation.mutate({
                  id: selectedParent.id,
                  updateData: editForm,
                })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving Changes…" : "Save Changes"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">First Name</label>
              <input
                className="input text-xs"
                value={editForm.firstName || ""}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-bold">Last Name</label>
              <input
                className="input text-xs"
                value={editForm.lastName || ""}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Phone Number</label>
              <input
                className="input text-xs"
                value={editForm.phone || ""}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-bold">Relationship</label>
              <select
                className="input text-xs"
                value={editForm.relation || "Father"}
                onChange={(e) => setEditForm({ ...editForm, relation: e.target.value })}
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
                <option value="Uncle">Uncle</option>
                <option value="Aunt">Aunt</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Sponsor">Sponsor</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Occupation</label>
              <input
                className="input text-xs"
                value={editForm.occupation || ""}
                onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-bold">City</label>
              <input
                className="input text-xs"
                value={editForm.city || ""}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Address</label>
            <input
              className="input text-xs"
              value={editForm.address || ""}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* ── MANAGE LINKED CHILDREN MODAL ──────────────────────────────────── */}
      <Modal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title={`Family Links — ${selectedParent?.firstName} ${selectedParent?.lastName}`}
        size="md"
        footer={
          <div className="flex justify-end w-full">
            <button className="btn-secondary text-xs" onClick={() => setLinkModalOpen(false)}>
              Done
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Currently Linked */}
          <div>
            <h4 className="font-bold text-gray-800 text-xs mb-2">Currently Linked Children</h4>
            {selectedParent?.parentProfile?.studentLinks?.length === 0 ? (
              <p className="text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200">
                No students currently linked to this parent.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedParent?.parentProfile?.studentLinks?.map((link) => {
                  const s = link.studentProfile;
                  const sName = s?.user ? `${s.user.firstName} ${s.user.lastName}` : "Student";

                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                    >
                      <div className="flex items-center gap-2.5">
                        <GraduationCap className="w-5 h-5 text-primary-600" />
                        <div>
                          <p className="font-bold text-gray-900 flex items-center gap-1.5">
                            {sName}
                            {link.isPrimary && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-500" /> Primary
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Adm: {s?.admissionNumber || "—"} • Class: {s?.class?.name || "Unassigned"}
                          </p>
                        </div>
                      </div>
                      <button
                        className="btn-ghost p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        onClick={() =>
                          unlinkMutation.mutate({
                            parentUserId: selectedParent.id,
                            linkId: link.id,
                          })
                        }
                        disabled={unlinkMutation.isPending}
                        title="Unlink Student"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Link */}
          <div className="pt-3 border-t border-gray-200">
            <h4 className="font-bold text-gray-800 text-xs mb-2">Link Another Student</h4>
            <div className="space-y-2.5">
              <select
                className="input text-xs font-medium"
                value={selectedStudentToLink}
                onChange={(e) => setSelectedStudentToLink(e.target.value)}
              >
                <option value="">— Select a student to link —</option>
                {allStudents
                  .filter(
                    (s) =>
                      !selectedParent?.parentProfile?.studentLinks?.some(
                        (l) => l.studentProfile?.id === s.id
                      )
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user?.firstName} {s.user?.lastName} (Adm: {s.admissionNumber || "N/A"} -{" "}
                      {s.class?.name || "Class"})
                    </option>
                  ))}
              </select>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrimaryLink}
                    onChange={(e) => setIsPrimaryLink(e.target.checked)}
                    className="rounded text-primary-600"
                  />
                  <span className="font-semibold text-gray-700">Set as Primary Guardian</span>
                </label>

                <button
                  className="btn-primary text-xs inline-flex items-center gap-1.5"
                  onClick={() =>
                    linkMutation.mutate({
                      parentUserId: selectedParent.id,
                      studentProfileId: selectedStudentToLink,
                      isPrimary: isPrimaryLink,
                      relation: studentRelation,
                    })
                  }
                  disabled={!selectedStudentToLink || linkMutation.isPending}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {linkMutation.isPending ? "Linking…" : "Link Student"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
