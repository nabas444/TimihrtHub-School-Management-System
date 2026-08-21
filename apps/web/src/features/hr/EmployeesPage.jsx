import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  Filter,
  Briefcase,
  Building,
  Shield,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Award,
  BookOpen,
  Calendar,
  DollarSign,
  UserCheck,
  UserX,
  Key,
  Network,
  LogOut,
  ChevronRight,
  Download,
  Trash2,
  Edit2,
  Phone,
  Mail,
  MapPin,
  Eye,
  Check,
  X,
  Link as LinkIcon,
  Unlink,
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
import LookupSelect from "../../components/shared/LookupSelect";
import clsx from "clsx";
import toast from "react-hot-toast";

const initialEmployeeForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "MALE",
  dateOfBirth: "",
  nationalId: "",
  hireDate: new Date().toISOString().slice(0, 10),
  employmentType: "FULL_TIME",
  status: "ACTIVE",
  departmentId: "",
  positionId: "",
  managerId: "",
  salary: "",
  contractStart: "",
  contractEnd: "",
  probationEnd: "",
  address: "",
  city: "Addis Ababa",
  emergencyContact: "",
  emergencyPhone: "",
  bankName: "",
  bankAccountNumber: "",
  notes: "",
  createOnboardingChecklist: true,
};

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'org-chart'
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Modals & Active Employee Drawer
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState("profile");

  // Sub-modals for active employee actions
  const [addDocModalOpen, setAddDocModalOpen] = useState(false);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [linkUserModalOpen, setLinkUserModalOpen] = useState(false);
  const [selectedUserToLink, setSelectedUserToLink] = useState("");
  const [unlinkedSearch, setUnlinkedSearch] = useState("");
  const [addReviewModalOpen, setAddReviewModalOpen] = useState(false);
  const [addTrainingModalOpen, setAddTrainingModalOpen] = useState(false);
  const [addDisciplinaryModalOpen, setAddDisciplinaryModalOpen] = useState(false);
  const [offboardModalOpen, setOffboardModalOpen] = useState(false);

  // Forms
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [docForm, setDocForm] = useState({
    type: "CONTRACT",
    title: "",
    documentNumber: "",
    fileUrl: "",
    expiryDate: "",
    reminderDays: 30,
    notes: "",
  });
  const [userAccForm, setUserAccForm] = useState({
    role: "TEACHER",
    email: "",
    password: "Welcome@123",
    specialization: "",
    qualification: "",
  });
  const [reviewForm, setReviewForm] = useState({
    cycleName: "Annual Review 2026",
    reviewPeriodStart: "2026-01-01",
    reviewPeriodEnd: "2026-12-31",
    overallRating: 5,
    reviewerNotes: "",
    goalsSet: "",
    developmentPlan: "",
  });
  const [trainingForm, setTrainingForm] = useState({
    title: "",
    provider: "",
    category: "Pedagogy & Teaching Methods",
    hoursCompleted: 10,
    completionDate: new Date().toISOString().slice(0, 10),
    certificateUrl: "",
  });
  const [disciplinaryForm, setDisciplinaryForm] = useState({
    type: "WRITTEN_WARNING",
    incidentDate: new Date().toISOString().slice(0, 10),
    title: "",
    description: "",
    actionTaken: "",
  });
  const [offboardForm, setOffboardForm] = useState({
    type: "RESIGNATION",
    lastWorkingDay: new Date().toISOString().slice(0, 10),
    reason: "",
    exitInterviewNotes: "",
    deactivateUserNow: true,
  });

  // ── Queries ────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["employees", page, search, deptFilter, statusFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
        ...(search && { search }),
        ...(deptFilter && { departmentId: deptFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { employmentType: typeFilter }),
      });
      return api.get(`/employees?${params.toString()}`).then((r) => r.data);
    },
  });

  const employees = data?.data || [];
  const meta = data?.meta || { total: 0, totalPages: 1 };

  // Fetch Full Single Employee details when drawer is open
  const { data: employeeDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["employee-detail", selectedEmployeeId],
    queryFn: () =>
      selectedEmployeeId
        ? api.get(`/employees/${selectedEmployeeId}`).then((r) => r.data.data)
        : null,
    enabled: Boolean(selectedEmployeeId),
  });

  // Fetch Org Chart Data
  const { data: orgChartData } = useQuery({
    queryKey: ["employees-org-chart"],
    queryFn: () => api.get("/employees/org-chart").then((r) => r.data.data),
    enabled: viewMode === "org-chart",
  });

  // Fetch Department lookups
  const { data: departments } = useQuery({
    queryKey: ["lookup-departments"],
    queryFn: () => api.get("/lookup-values?type=DEPARTMENT").then((r) => r.data.data || []),
  });

  // Fetch Position lookups
  const { data: positions } = useQuery({
    queryKey: ["lookup-positions"],
    queryFn: () => api.get("/lookup-values?type=POSITION").then((r) => r.data.data || []),
  });

  // Fetch Unlinked Users for linking modal
  const { data: unlinkedUsers, isLoading: isUnlinkedLoading } = useQuery({
    queryKey: ["unlinked-users", unlinkedSearch],
    queryFn: () =>
      api
        .get(
          `/employees/unlinked-users${
            unlinkedSearch ? `?search=${encodeURIComponent(unlinkedSearch)}` : ""
          }`
        )
        .then((r) => r.data.data || []),
    enabled: linkUserModalOpen,
  });

  // ── Mutations ──────────────────────────────────────────────────────
  const createEmployeeMutation = useMutation({
    mutationFn: (newEmp) => api.post("/employees", newEmp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["hr-dashboard"] });
      toast.success("Employee record created");
      setAddModalOpen(false);
      setEmployeeForm(initialEmployeeForm);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create employee");
    },
  });

  const createUserAccMutation = useMutation({
    mutationFn: ({ empId, payload }) => api.post(`/employees/${empId}/create-user-account`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-detail", selectedEmployeeId] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Portal account created and linked");
      setCreateUserModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create user account");
    },
  });

  const linkUserMutation = useMutation({
    mutationFn: ({ empId, userId }) => api.post(`/employees/${empId}/link-user`, { userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-detail", selectedEmployeeId] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["unlinked-users"] });
      toast.success("Existing user account linked to employee successfully");
      setLinkUserModalOpen(false);
      setSelectedUserToLink("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to link user account");
    },
  });

  const unlinkUserMutation = useMutation({
    mutationFn: (empId) => api.post(`/employees/${empId}/unlink-user`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-detail", selectedEmployeeId] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["unlinked-users"] });
      toast.success("User account unlinked from employee");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to unlink user account");
    },
  });

  const addDocMutation = useMutation({
    mutationFn: ({ empId, payload }) => api.post(`/employees/${empId}/documents`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-detail", selectedEmployeeId] });
      toast.success("Document added to vault");
      setAddDocModalOpen(false);
      setDocForm({
        type: "CONTRACT",
        title: "",
        documentNumber: "",
        fileUrl: "",
        expiryDate: "",
        reminderDays: 30,
        notes: "",
      });
    },
  });

  const toggleOnboardingItemMutation = useMutation({
    mutationFn: ({ empId, itemId, status }) =>
      api.patch(`/employees/${empId}/onboarding/items/${itemId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-detail", selectedEmployeeId] });
      toast.success("Checklist task updated");
    },
  });

  const addReviewMutation = useMutation({
    mutationFn: ({ empId, payload }) => api.post(`/employees/${empId}/reviews`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-detail", selectedEmployeeId] });
      toast.success("Performance review logged");
      setAddReviewModalOpen(false);
    },
  });

  const addTrainingMutation = useMutation({
    mutationFn: ({ empId, payload }) => api.post(`/employees/${empId}/trainings`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-detail", selectedEmployeeId] });
      toast.success("Training development record logged");
      setAddTrainingModalOpen(false);
    },
  });

  const addDisciplinaryMutation = useMutation({
    mutationFn: ({ empId, payload }) => api.post(`/employees/${empId}/disciplinary`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-detail", selectedEmployeeId] });
      toast.success("Disciplinary record logged");
      setAddDisciplinaryModalOpen(false);
    },
  });

  const offboardMutation = useMutation({
    mutationFn: ({ empId, payload }) => api.post(`/employees/${empId}/offboard`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-detail", selectedEmployeeId] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Offboarding initiated successfully");
      setOffboardModalOpen(false);
    },
  });

  const openEmployeeDrawer = (id) => {
    setSelectedEmployeeId(id);
    setActiveDrawerTab("profile");
    setDetailModalOpen(true);
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "ACTIVE":
        return "green";
      case "PROBATION":
        return "blue";
      case "ON_LEAVE":
        return "amber";
      case "SUSPENDED":
      case "TERMINATED":
      case "RESIGNED":
        return "red";
      default:
        return "gray";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & NAVIGATION ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-primary-600" />
            Staff & Employee Directory
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Complete HR operational layer for all academic, administrative, and operational school personnel.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
            <button
              onClick={() => setViewMode("table")}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5",
                viewMode === "table"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              List View
            </button>
            <button
              onClick={() => setViewMode("org-chart")}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5",
                viewMode === "org-chart"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              )}
            >
              <Network className="w-3.5 h-3.5" />
              Org Chart
            </button>
          </div>
          <button
            onClick={() => {
              setEmployeeForm(initialEmployeeForm);
              setAddModalOpen(true);
            }}
            className="btn-primary inline-flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* ── SEARCH & FILTERS ────────────────────────────────────────────── */}
      {viewMode === "table" && (
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="w-full md:w-80">
            <SearchInput
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder="Search by name, EMP number, phone, email…"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPage(1);
              }}
              className="input text-xs py-1.5"
            >
              <option value="">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.value}
                </option>
              ))}
            </select>

            {/* Employment Type */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="input text-xs py-1.5"
            >
              <option value="">All Types</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="PROBATION">Probationary</option>
              <option value="TEMPORARY">Temporary</option>
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input text-xs py-1.5"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="RESIGNED">Resigned</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>
      )}

      {/* ── ORG CHART VIEW ──────────────────────────────────────────────── */}
      {viewMode === "org-chart" && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs min-h-[400px]">
          <div className="mb-4">
            <h3 className="font-bold text-gray-900 text-sm">School Organizational Structure</h3>
            <p className="text-xs text-gray-500">
              Visual hierarchy based on reporting manager linkages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgChartData?.map((emp) => {
              const fullName = `${emp.firstName} ${emp.lastName}`;
              return (
                <div
                  key={emp.id}
                  onClick={() => openEmployeeDrawer(emp.id)}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:border-primary-300 hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={emp.user?.avatar}
                      name={fullName}
                      size="md"
                      className="bg-primary-100 text-primary-700 font-bold border border-primary-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{fullName}</p>
                      <p className="text-[11px] text-primary-700 font-semibold truncate">
                        {emp.position?.value || "Staff Member"}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {emp.employeeNumber} • {emp.department?.value || "General"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ──────────────────────────────────────────────────── */}
      {viewMode === "table" && (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          {isLoading ? (
            <PageLoader />
          ) : employees.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-700">No Employees Found</h3>
              <p className="text-xs text-gray-400 mt-1">
                {search ? "No staff matched your filters." : "Get started by adding school employees."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department & Position</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Portal Access</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {employees.map((emp) => {
                    const fullName = `${emp.firstName} ${emp.middleName ? emp.middleName + " " : ""}${emp.lastName}`;
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                        onClick={() => openEmployeeDrawer(emp.id)}
                      >
                        {/* Employee Name & EMP Number */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={emp.user?.avatar}
                              name={fullName}
                              size="md"
                              className="bg-primary-100 text-primary-700 font-bold border border-primary-200"
                            />
                            <div>
                              <p className="font-bold text-gray-900">{fullName}</p>
                              <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5">
                                <span className="bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded font-semibold">
                                  {emp.employeeNumber}
                                </span>
                                {emp.email && <span>{emp.email}</span>}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Department & Position */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className="font-bold text-gray-800 text-[11px] block">
                              {emp.position?.value || "Unassigned Position"}
                            </span>
                            <span
                              className="inline-block text-[10px] px-2 py-0.5 rounded font-medium"
                              style={{
                                backgroundColor: emp.department?.colorHex
                                  ? `${emp.department.colorHex}15`
                                  : "#f3f4f6",
                                color: emp.department?.colorHex || "#4b5563",
                              }}
                            >
                              {emp.department?.value || "General"}
                            </span>
                          </div>
                        </td>

                        {/* Employment Type */}
                        <td className="py-3.5 px-4">
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px] font-medium">
                            {emp.employmentType?.replace("_", " ")}
                          </span>
                        </td>

                        {/* Portal Access Account */}
                        <td className="py-3.5 px-4">
                          {emp.user ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                              <Key className="w-3 h-3 text-emerald-600" />
                              {emp.user.role}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10px] italic">
                              No Login Account
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <Badge variant={getStatusBadgeVariant(emp.status)}>
                            {emp.status}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            className="btn-ghost p-1.5 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEmployeeDrawer(emp.id);
                            }}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
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
      )}

      {/* ── ADD EMPLOYEE MODAL ──────────────────────────────────────────── */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Employee (HR Operating Record)"
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
                onClick={() => createEmployeeMutation.mutate(employeeForm)}
                disabled={
                  createEmployeeMutation.isPending ||
                  !employeeForm.firstName ||
                  !employeeForm.lastName
                }
              >
                {createEmployeeMutation.isPending ? "Creating Record…" : "Create Employee"}
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
                value={employeeForm.firstName}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, firstName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="label font-bold">Middle Name</label>
              <input
                className="input text-xs"
                value={employeeForm.middleName}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, middleName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label font-bold">Last Name *</label>
              <input
                className="input text-xs"
                value={employeeForm.lastName}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, lastName: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Official / Contact Email</label>
              <input
                type="email"
                className="input text-xs"
                value={employeeForm.email}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label font-bold">Phone Number</label>
              <input
                className="input text-xs"
                value={employeeForm.phone}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, phone: e.target.value })
                }
                placeholder="+251 9..."
              />
            </div>
            <div>
              <label className="label font-bold">National ID / Kebele ID</label>
              <input
                className="input text-xs"
                value={employeeForm.nationalId}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, nationalId: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <LookupSelect
              type="DEPARTMENT"
              label="Department"
              value={employeeForm.departmentId}
              onChange={(id) => setEmployeeForm({ ...employeeForm, departmentId: id })}
            />
            <LookupSelect
              type="POSITION"
              label="Position / Job Title"
              value={employeeForm.positionId}
              onChange={(id) => setEmployeeForm({ ...employeeForm, positionId: id })}
            />
            <div>
              <label className="label font-bold">Employment Type</label>
              <select
                className="input text-xs"
                value={employeeForm.employmentType}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, employmentType: e.target.value })
                }
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="PROBATION">Probation</option>
                <option value="TEMPORARY">Temporary</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Hire / Joining Date</label>
              <input
                type="date"
                className="input text-xs"
                value={employeeForm.hireDate}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, hireDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label font-bold">Base Monthly Salary (ETB)</label>
              <input
                type="number"
                className="input text-xs"
                value={employeeForm.salary}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, salary: parseFloat(e.target.value) || 0 })
                }
                placeholder="25000"
              />
            </div>
            <div>
              <label className="label font-bold">Probation End Date</label>
              <input
                type="date"
                className="input text-xs"
                value={employeeForm.probationEnd}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, probationEnd: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="label font-bold">Emergency Contact Person</label>
              <input
                className="input text-xs"
                value={employeeForm.emergencyContact}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, emergencyContact: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label font-bold">Emergency Phone</label>
              <input
                className="input text-xs"
                value={employeeForm.emergencyPhone}
                onChange={(e) =>
                  setEmployeeForm({ ...employeeForm, emergencyPhone: e.target.value })
                }
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={employeeForm.createOnboardingChecklist}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  createOnboardingChecklist: e.target.checked,
                })
              }
              className="rounded text-primary-600"
            />
            <span className="font-semibold text-gray-700">
              Auto-generate 30-day employee onboarding checklist
            </span>
          </label>
        </div>
      </Modal>

      {/* ── EMPLOYEE 360 WORKSPACE DRAWER / MODAL ───────────────────────── */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={
          employeeDetail
            ? `${employeeDetail.firstName} ${employeeDetail.lastName} (${employeeDetail.employeeNumber})`
            : "Employee Details"
        }
        size="xl"
        footer={
          <div className="flex justify-end w-full">
            <button className="btn-secondary text-xs" onClick={() => setDetailModalOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {isDetailLoading || !employeeDetail ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            {/* Top Employee Profile Card */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={employeeDetail.user?.avatar}
                  name={`${employeeDetail.firstName} ${employeeDetail.lastName}`}
                  size="lg"
                  className="bg-primary-100 text-primary-700 font-bold border border-primary-200"
                />
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {employeeDetail.firstName} {employeeDetail.middleName || ""} {employeeDetail.lastName}
                  </h3>
                  <p className="text-xs text-primary-700 font-semibold">
                    {employeeDetail.position?.value || "Unassigned Position"} • {employeeDetail.department?.value || "General"}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Hired: {new Date(employeeDetail.hireDate).toLocaleDateString()} • {employeeDetail.employmentType}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getStatusBadgeVariant(employeeDetail.status)}>
                  {employeeDetail.status}
                </Badge>
                {!employeeDetail.user ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedUserToLink("");
                        setUnlinkedSearch("");
                        setLinkUserModalOpen(true);
                      }}
                      className="btn-secondary text-xs py-1.5 inline-flex items-center gap-1.5 border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 shadow-xs"
                      title="Attach an existing school login user to this employee"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      Link Existing Account
                    </button>
                    <button
                      onClick={() => {
                        setUserAccForm({
                          role: "TEACHER",
                          email: employeeDetail.email || "",
                          password: "Welcome@123",
                          specialization: "",
                          qualification: "",
                        });
                        setCreateUserModalOpen(true);
                      }}
                      className="btn-secondary text-xs py-1.5 inline-flex items-center gap-1.5 border-primary-300 text-primary-700 bg-primary-50 hover:bg-primary-100 shadow-xs"
                      title="Create a new login user account for this employee"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Provision Portal Login
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <Key className="w-3 h-3 text-emerald-600" />
                      Portal Active ({employeeDetail.user.role})
                    </span>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to unlink portal user account (${employeeDetail.user?.email}) from this employee record?`
                          )
                        ) {
                          unlinkUserMutation.mutate(employeeDetail.id);
                        }
                      }}
                      className="btn-ghost p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                      title="Unlink Portal Account"
                      disabled={unlinkUserMutation.isPending}
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      {unlinkUserMutation.isPending ? "Unlinking…" : "Unlink"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 text-xs font-semibold gap-2 overflow-x-auto pb-1">
              {[
                { id: "profile", label: "Profile & Contract", icon: Briefcase },
                { id: "vault", label: `Document Vault (${employeeDetail.documents?.length || 0})`, icon: Shield },
                { id: "onboarding", label: "Onboarding Checklist", icon: CheckCircle2 },
                { id: "performance", label: "Performance & Training", icon: Award },
                { id: "conduct", label: `Conduct (${employeeDetail.disciplinaryRecords?.length || 0})`, icon: AlertTriangle },
                { id: "offboarding", label: "Offboarding", icon: LogOut },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDrawerTab(tab.id)}
                    className={clsx(
                      "px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap",
                      activeDrawerTab === tab.id
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

            {/* TAB CONTENT: PROFILE */}
            {activeDrawerTab === "profile" && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-400 text-[10px] font-bold uppercase">Contact Information</p>
                    <p className="font-semibold text-gray-800 mt-1">{employeeDetail.phone || "No phone"}</p>
                    <p className="text-gray-500 mt-0.5">{employeeDetail.email || "No email"}</p>
                    <p className="text-gray-500 mt-0.5">{employeeDetail.address || "No address"}, {employeeDetail.city || ""}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-400 text-[10px] font-bold uppercase">Compensation & Terms</p>
                    <p className="font-bold text-gray-900 mt-1">
                      {employeeDetail.salary ? `${employeeDetail.salary.toLocaleString()} ETB / mo` : "Unspecified"}
                    </p>
                    <p className="text-gray-500 mt-0.5">Type: {employeeDetail.employmentType}</p>
                    <p className="text-gray-500 mt-0.5">
                      Probation: {employeeDetail.probationEnd ? new Date(employeeDetail.probationEnd).toLocaleDateString() : "None"}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-400 text-[10px] font-bold uppercase">Emergency Contact</p>
                    <p className="font-semibold text-gray-800 mt-1">{employeeDetail.emergencyContact || "Not recorded"}</p>
                    <p className="text-gray-500 mt-0.5">{employeeDetail.emergencyPhone || "—"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: DOCUMENT VAULT */}
            {activeDrawerTab === "vault" && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-800">Employee Documents & Credentials</h4>
                  <button
                    onClick={() => setAddDocModalOpen(true)}
                    className="btn-primary text-xs py-1.5 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Upload Document
                  </button>
                </div>

                {employeeDetail.documents?.length === 0 ? (
                  <p className="text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center border border-dashed border-gray-200">
                    No documents uploaded yet (Teaching licenses, contracts, IDs).
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {employeeDetail.documents?.map((doc) => {
                      const isExpiringSoon =
                        doc.expiryDate &&
                        new Date(doc.expiryDate).getTime() - Date.now() < 60 * 24 * 60 * 60 * 1000;

                      return (
                        <div
                          key={doc.id}
                          className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-primary-600" />
                              <p className="font-bold text-gray-900">{doc.title}</p>
                            </div>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                              {doc.type} • {doc.documentNumber || "No ID"}
                            </p>
                            {doc.expiryDate && (
                              <p
                                className={clsx(
                                  "text-[10px] font-semibold mt-1",
                                  isExpiringSoon ? "text-amber-600 font-bold" : "text-gray-500"
                                )}
                              >
                                Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                                {isExpiringSoon && " (Renew Soon!)"}
                              </p>
                            )}
                          </div>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost p-1.5 text-primary-600 hover:text-primary-800"
                            title="Download/View Document"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: ONBOARDING CHECKLIST */}
            {activeDrawerTab === "onboarding" && (
              <div className="space-y-3 text-xs">
                {employeeDetail.onboardingChecklists?.map((cl) => (
                  <div key={cl.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900">{cl.title}</h4>
                      <Badge variant={cl.status === "COMPLETED" ? "green" : "blue"}>
                        {cl.status}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {cl.items?.map((item) => {
                        const isDone = item.status === "COMPLETED";
                        return (
                          <div
                            key={item.id}
                            className={clsx(
                              "p-2.5 rounded-xl border flex items-center justify-between transition-colors",
                              isDone ? "bg-emerald-50/40 border-emerald-200" : "bg-gray-50 border-gray-200"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() =>
                                  toggleOnboardingItemMutation.mutate({
                                    empId: employeeDetail.id,
                                    itemId: item.id,
                                    status: isDone ? "PENDING" : "COMPLETED",
                                  })
                                }
                                className="rounded text-emerald-600"
                              />
                              <div>
                                <p className={clsx("font-bold", isDone ? "line-through text-gray-500" : "text-gray-900")}>
                                  {item.title}
                                </p>
                                <p className="text-[10px] text-gray-400">{item.category}</p>
                              </div>
                            </div>
                            {isDone && (
                              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Done
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: PERFORMANCE & DEVELOPMENT */}
            {activeDrawerTab === "performance" && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-800">Performance Appraisals</h4>
                  <button
                    onClick={() => setAddReviewModalOpen(true)}
                    className="btn-primary text-xs py-1.5 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log Appraisal
                  </button>
                </div>

                {employeeDetail.performanceReviews?.map((rev) => (
                  <div key={rev.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-gray-900">{rev.cycleName}</p>
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                        Score: {rev.overallRating} / 5
                      </span>
                    </div>
                    <p className="text-gray-600">{rev.reviewerNotes}</p>
                    {rev.developmentPlan && (
                      <p className="text-[11px] text-primary-700 font-semibold">
                        Dev Plan: {rev.developmentPlan}
                      </p>
                    )}
                  </div>
                ))}

                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <h4 className="font-bold text-gray-800">Professional Development & Trainings</h4>
                  <button
                    onClick={() => setAddTrainingModalOpen(true)}
                    className="btn-secondary text-xs py-1.5 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log Training
                  </button>
                </div>

                {employeeDetail.trainingRecords?.map((tr) => (
                  <div key={tr.id} className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-blue-900">{tr.title}</p>
                      <p className="text-[10px] text-blue-700 font-medium">
                        {tr.category} • {tr.hoursCompleted} hours • Completed: {new Date(tr.completionDate).toLocaleDateString()}
                      </p>
                    </div>
                    {tr.certificateUrl && (
                      <a href={tr.certificateUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5 text-blue-600">
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: CONDUCT */}
            {activeDrawerTab === "conduct" && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-800">Staff Conduct & Disciplinary Log</h4>
                  <button
                    onClick={() => setAddDisciplinaryModalOpen(true)}
                    className="btn-secondary text-xs py-1.5 text-red-600 border-red-200 hover:bg-red-50 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log Incident / Warning
                  </button>
                </div>

                {employeeDetail.disciplinaryRecords?.map((rec) => (
                  <div key={rec.id} className="p-3 bg-red-50/40 border border-red-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-red-900">{rec.title}</p>
                      <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px]">
                        {rec.type}
                      </span>
                    </div>
                    <p className="text-gray-700">{rec.description}</p>
                    {rec.actionTaken && (
                      <p className="text-[10px] text-gray-500 font-semibold">Action: {rec.actionTaken}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: OFFBOARDING */}
            {activeDrawerTab === "offboarding" && (
              <div className="space-y-3 text-xs">
                {employeeDetail.status === "RESIGNED" || employeeDetail.status === "TERMINATED" ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-amber-900 text-sm">Offboarding in Progress / Finalized</h4>
                      <Badge variant="amber">{employeeDetail.status}</Badge>
                    </div>
                    {employeeDetail.offboardingRecords?.map((off) => (
                      <div key={off.id} className="space-y-2">
                        <p className="text-gray-700">Last Working Day: {new Date(off.lastWorkingDay).toLocaleDateString()}</p>
                        <div className="space-y-1.5">
                          {off.checklistItems?.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-amber-200">
                              <CheckCircle2 className={clsx("w-4 h-4", item.isCompleted ? "text-emerald-600" : "text-gray-300")} />
                              <span className="font-medium text-gray-800">{item.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                    <h4 className="font-bold text-gray-900">Initiate Staff Offboarding</h4>
                    <p className="text-gray-500">
                      Standard offboarding executes clearance workflows for asset handover, final finance settlement, and revokes system user credentials.
                    </p>
                    <button
                      onClick={() => setOffboardModalOpen(true)}
                      className="btn-secondary text-xs text-red-600 border-red-300 hover:bg-red-50 inline-flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Initiate Exit Clearance
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── CREATE USER ACCOUNT MODAL ───────────────────────────────────── */}
      <Modal
        open={createUserModalOpen}
        onClose={() => setCreateUserModalOpen(false)}
        title="Provision Portal Login Account"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setCreateUserModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() =>
                createUserAccMutation.mutate({
                  empId: selectedEmployeeId,
                  payload: userAccForm,
                })
              }
              disabled={createUserAccMutation.isPending || !userAccForm.email}
            >
              {createUserAccMutation.isPending ? "Creating Account…" : "Create & Link Account"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Portal Role</label>
            <select
              className="input text-xs font-bold"
              value={userAccForm.role}
              onChange={(e) => setUserAccForm({ ...userAccForm, role: e.target.value })}
            >
              <option value="TEACHER">Teacher / Faculty</option>
              <option value="ADMIN">School Administrator</option>
              <option value="FINANCE">Finance Officer</option>
            </select>
          </div>
          <div>
            <label className="label font-bold">Login Email</label>
            <input
              type="email"
              className="input text-xs"
              value={userAccForm.email}
              onChange={(e) => setUserAccForm({ ...userAccForm, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label font-bold">Password</label>
            <input
              className="input text-xs font-mono"
              value={userAccForm.password}
              onChange={(e) => setUserAccForm({ ...userAccForm, password: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* ── LINK EXISTING USER ACCOUNT MODAL ────────────────────────────── */}
      <Modal
        open={linkUserModalOpen}
        onClose={() => setLinkUserModalOpen(false)}
        title={
          employeeDetail
            ? `Link Existing Account — ${employeeDetail.firstName} ${employeeDetail.lastName}`
            : "Link Existing User Account"
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setLinkUserModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs inline-flex items-center gap-1.5"
              onClick={() =>
                linkUserMutation.mutate({
                  empId: employeeDetail?.id,
                  userId: selectedUserToLink,
                })
              }
              disabled={linkUserMutation.isPending || !selectedUserToLink}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {linkUserMutation.isPending ? "Linking Account…" : "Link Account to Employee"}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-gray-600">
            Select an existing login user account in your school (e.g. created prior to the HR module) to attach to this employee record.
          </p>

          <SearchInput
            value={unlinkedSearch}
            onChange={setUnlinkedSearch}
            placeholder="Filter unlinked users by name or email…"
          />

          {isUnlinkedLoading ? (
            <PageLoader />
          ) : unlinkedUsers?.length === 0 ? (
            <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="font-bold text-gray-700">No Unlinked Users Available</p>
              <p className="text-gray-400 text-[11px] mt-0.5">
                All existing staff user accounts are already linked to employee records, or none matched your filter.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {unlinkedUsers?.map((u) => {
                const uName = `${u.firstName} ${u.middleName ? u.middleName + " " : ""}${u.lastName}`;
                const isSelected = selectedUserToLink === u.id;

                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserToLink(u.id)}
                    className={clsx(
                      "p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all",
                      isSelected
                        ? "bg-purple-50/80 border-purple-400 ring-1 ring-purple-400 shadow-xs"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={u.avatar}
                        name={uName}
                        size="sm"
                        className="bg-purple-100 text-purple-700 font-bold border border-purple-200"
                      />
                      <div>
                        <p className="font-bold text-gray-900">{uName}</p>
                        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400" /> {u.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">
                        {u.role}
                      </span>
                      <div
                        className={clsx(
                          "w-4 h-4 rounded-full border flex items-center justify-center",
                          isSelected
                            ? "border-purple-600 bg-purple-600 text-white"
                            : "border-gray-300 bg-white"
                        )}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* ── UPLOAD DOCUMENT MODAL ───────────────────────────────────────── */}
      <Modal
        open={addDocModalOpen}
        onClose={() => setAddDocModalOpen(false)}
        title="Upload Document to Vault"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setAddDocModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() =>
                addDocMutation.mutate({
                  empId: selectedEmployeeId,
                  payload: docForm,
                })
              }
              disabled={addDocMutation.isPending || !docForm.title || !docForm.fileUrl}
            >
              {addDocMutation.isPending ? "Saving…" : "Save Document"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Document Category</label>
              <select
                className="input text-xs"
                value={docForm.type}
                onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}
              >
                <option value="NATIONAL_ID">National ID / Kebele Card</option>
                <option value="PASSPORT">Passport</option>
                <option value="DEGREE_CERTIFICATE">University Degree</option>
                <option value="TEACHING_LICENSE">Teaching License</option>
                <option value="CONTRACT">Employment Contract</option>
                <option value="POLICE_CLEARANCE">Police Background Check</option>
                <option value="MEDICAL_CERTIFICATE">Medical Fitness Certificate</option>
                <option value="OTHER">Other Official Document</option>
              </select>
            </div>
            <div>
              <label className="label font-bold">Document Title *</label>
              <input
                className="input text-xs"
                value={docForm.title}
                onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                placeholder="e.g. MOE Teaching License 2026"
                required
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">File URL / Storage Link *</label>
            <input
              className="input text-xs"
              value={docForm.fileUrl}
              onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })}
              placeholder="https://storage.timhirthub.com/docs/file.pdf"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Document Number (Optional)</label>
              <input
                className="input text-xs"
                value={docForm.documentNumber}
                onChange={(e) => setDocForm({ ...docForm, documentNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-bold">Expiry Date (For Renewal Alerts)</label>
              <input
                type="date"
                className="input text-xs"
                value={docForm.expiryDate}
                onChange={(e) => setDocForm({ ...docForm, expiryDate: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── LOG APPRAISAL MODAL ─────────────────────────────────────────── */}
      <Modal
        open={addReviewModalOpen}
        onClose={() => setAddReviewModalOpen(false)}
        title="Log Performance Review / Appraisal"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setAddReviewModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() =>
                addReviewMutation.mutate({
                  empId: selectedEmployeeId,
                  payload: reviewForm,
                })
              }
              disabled={addReviewMutation.isPending || !reviewForm.cycleName}
            >
              {addReviewMutation.isPending ? "Saving…" : "Save Appraisal"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Review Cycle Title</label>
            <input
              className="input text-xs"
              value={reviewForm.cycleName}
              onChange={(e) => setReviewForm({ ...reviewForm, cycleName: e.target.value })}
            />
          </div>
          <div>
            <label className="label font-bold">Overall Rating (1 - 5)</label>
            <input
              type="number"
              min="1"
              max="5"
              step="0.1"
              className="input text-xs font-bold"
              value={reviewForm.overallRating}
              onChange={(e) =>
                setReviewForm({ ...reviewForm, overallRating: parseFloat(e.target.value) || 5 })
              }
            />
          </div>
          <div>
            <label className="label font-bold">Reviewer Evaluation & Feedback</label>
            <textarea
              rows={3}
              className="input text-xs"
              value={reviewForm.reviewerNotes}
              onChange={(e) => setReviewForm({ ...reviewForm, reviewerNotes: e.target.value })}
            />
          </div>
          <div>
            <label className="label font-bold">Goals & Development Plan</label>
            <input
              className="input text-xs"
              value={reviewForm.developmentPlan}
              onChange={(e) => setReviewForm({ ...reviewForm, developmentPlan: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* ── LOG TRAINING MODAL ─────────────────────────────────────────── */}
      <Modal
        open={addTrainingModalOpen}
        onClose={() => setAddTrainingModalOpen(false)}
        title="Log Professional Development Training"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setAddTrainingModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() =>
                addTrainingMutation.mutate({
                  empId: selectedEmployeeId,
                  payload: trainingForm,
                })
              }
              disabled={addTrainingMutation.isPending || !trainingForm.title}
            >
              {addTrainingMutation.isPending ? "Saving…" : "Save Record"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Training Program / Course Title</label>
            <input
              className="input text-xs"
              value={trainingForm.title}
              onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
              placeholder="e.g. Modern Continuous Assessment Methodologies"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Category</label>
              <input
                className="input text-xs"
                value={trainingForm.category}
                onChange={(e) => setTrainingForm({ ...trainingForm, category: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-bold">Hours Completed</label>
              <input
                type="number"
                className="input text-xs"
                value={trainingForm.hoursCompleted}
                onChange={(e) =>
                  setTrainingForm({
                    ...trainingForm,
                    hoursCompleted: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="label font-bold">Certificate URL (Optional)</label>
            <input
              className="input text-xs"
              value={trainingForm.certificateUrl}
              onChange={(e) =>
                setTrainingForm({ ...trainingForm, certificateUrl: e.target.value })
              }
            />
          </div>
        </div>
      </Modal>

      {/* ── LOG DISCIPLINARY MODAL ─────────────────────────────────────── */}
      <Modal
        open={addDisciplinaryModalOpen}
        onClose={() => setAddDisciplinaryModalOpen(false)}
        title="Log Disciplinary / Conduct Record"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setAddDisciplinaryModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs bg-red-600 hover:bg-red-700"
              onClick={() =>
                addDisciplinaryMutation.mutate({
                  empId: selectedEmployeeId,
                  payload: disciplinaryForm,
                })
              }
              disabled={addDisciplinaryMutation.isPending || !disciplinaryForm.title}
            >
              {addDisciplinaryMutation.isPending ? "Logging Record…" : "Log Record"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Disciplinary Action Type</label>
              <select
                className="input text-xs"
                value={disciplinaryForm.type}
                onChange={(e) =>
                  setDisciplinaryForm({ ...disciplinaryForm, type: e.target.value })
                }
              >
                <option value="VERBAL_WARNING">Verbal Warning</option>
                <option value="WRITTEN_WARNING">Written Warning</option>
                <option value="SUSPENSION">Suspension</option>
                <option value="INVESTIGATION">Formal Investigation</option>
                <option value="TERMINATION">Termination</option>
              </select>
            </div>
            <div>
              <label className="label font-bold">Incident Date</label>
              <input
                type="date"
                className="input text-xs"
                value={disciplinaryForm.incidentDate}
                onChange={(e) =>
                  setDisciplinaryForm({ ...disciplinaryForm, incidentDate: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="label font-bold">Title / Summary *</label>
            <input
              className="input text-xs"
              value={disciplinaryForm.title}
              onChange={(e) =>
                setDisciplinaryForm({ ...disciplinaryForm, title: e.target.value })
              }
              placeholder="e.g. Unexcused absence during exam week"
              required
            />
          </div>
          <div>
            <label className="label font-bold">Detailed Incident Description *</label>
            <textarea
              rows={3}
              className="input text-xs"
              value={disciplinaryForm.description}
              onChange={(e) =>
                setDisciplinaryForm({ ...disciplinaryForm, description: e.target.value })
              }
              required
            />
          </div>
          <div>
            <label className="label font-bold">Corrective Action / Resolution</label>
            <input
              className="input text-xs"
              value={disciplinaryForm.actionTaken}
              onChange={(e) =>
                setDisciplinaryForm({ ...disciplinaryForm, actionTaken: e.target.value })
              }
            />
          </div>
        </div>
      </Modal>

      {/* ── OFFBOARD MODAL ─────────────────────────────────────────────── */}
      <Modal
        open={offboardModalOpen}
        onClose={() => setOffboardModalOpen(false)}
        title="Initiate Employee Exit & Clearance"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setOffboardModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs bg-red-600 hover:bg-red-700"
              onClick={() =>
                offboardMutation.mutate({
                  empId: selectedEmployeeId,
                  payload: offboardForm,
                })
              }
              disabled={offboardMutation.isPending}
            >
              {offboardMutation.isPending ? "Processing Exit…" : "Execute Exit Workflow"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Separation Type</label>
              <select
                className="input text-xs"
                value={offboardForm.type}
                onChange={(e) => setOffboardForm({ ...offboardForm, type: e.target.value })}
              >
                <option value="RESIGNATION">Resignation</option>
                <option value="TERMINATION">Termination</option>
                <option value="END_OF_CONTRACT">Contract Expiry</option>
                <option value="RETIREMENT">Retirement</option>
              </select>
            </div>
            <div>
              <label className="label font-bold">Last Working Day *</label>
              <input
                type="date"
                className="input text-xs"
                value={offboardForm.lastWorkingDay}
                onChange={(e) =>
                  setOffboardForm({ ...offboardForm, lastWorkingDay: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div>
            <label className="label font-bold">Reason for Separation</label>
            <input
              className="input text-xs"
              value={offboardForm.reason}
              onChange={(e) => setOffboardForm({ ...offboardForm, reason: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={offboardForm.deactivateUserNow}
              onChange={(e) =>
                setOffboardForm({ ...offboardForm, deactivateUserNow: e.target.checked })
              }
              className="rounded text-red-600"
            />
            <span className="font-semibold text-red-700">
              Immediately deactivate portal account login credentials
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
