import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Eye,
  GraduationCap,
  Mail,
  Phone,
  Building2,
  Trash2,
  Save,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  User,
  Users,
  Home,
  MessageSquare,
  FileCheck,
} from "lucide-react";
import api from "../../lib/api";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

const STATUS_CONFIG = {
  ALL: { label: "All Applicants", color: "bg-slate-100 text-slate-700 border-slate-200" },
  SUBMITTED: { label: "Submitted", color: "bg-blue-50 text-blue-700 border-blue-200" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-amber-50 text-amber-700 border-amber-200" },
  INTERVIEW_SCHEDULED: { label: "Interview Scheduled", color: "bg-purple-50 text-purple-700 border-purple-200" },
  ACCEPTED: { label: "Accepted", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ENROLLED: { label: "Enrolled", color: "bg-teal-50 text-teal-700 border-teal-200" },
  REJECTED: { label: "Rejected", color: "bg-rose-50 text-rose-700 border-rose-200" },
  WITHDRAWN: { label: "Withdrawn", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function AdmissionsPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");

  // Reject modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Converted result modal state
  const [convertedStudent, setConvertedStudent] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Fetch applicants
  const { data, isLoading } = useQuery({
    queryKey: ["admissions", { status: activeTab, search: searchTerm, page }],
    queryFn: async () => {
      const params = {
        page,
        limit: 25,
        ...(activeTab !== "ALL" && { status: activeTab }),
        ...(searchTerm.trim() && { search: searchTerm.trim() }),
      };
      const res = await api.get("/admissions", { params });
      return res.data?.data;
    },
  });

  const applicants = data?.applicants || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };

  // Status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }) => {
      const res = await api.patch(`/admissions/${id}/status`, { status, rejectionReason });
      return res.data?.data;
    },
    onSuccess: (updated) => {
      toast.success("Application status updated");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      if (selectedApplicant?.id === updated.id) {
        setSelectedApplicant(updated);
      }
      setIsRejectModalOpen(false);
      setRejectionReason("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update status");
    },
  });

  // Notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }) => {
      const res = await api.patch(`/admissions/${id}/notes`, { notes });
      return res.data?.data;
    },
    onSuccess: (updated) => {
      toast.success("Internal notes saved");
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      if (selectedApplicant?.id === updated.id) {
        setSelectedApplicant(updated);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save notes");
    },
  });

  // Convert to student mutation
  const convertMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/admissions/${id}/convert`);
      return res.data?.data;
    },
    onSuccess: (data) => {
      toast.success("Student account created successfully!");
      setConvertedStudent(data);
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
      if (selectedApplicant?.id === data.applicant?.id) {
        setSelectedApplicant(data.applicant);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to convert applicant");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/admissions/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Application deleted");
      setSelectedApplicant(null);
      queryClient.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete application");
    },
  });

  const handleOpenDetail = (applicant) => {
    setSelectedApplicant(applicant);
    setNotesDraft(applicant.notes || "");
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <UserPlus className="w-7 h-7 text-indigo-600" />
            Admissions & Student Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review prospective student applications, manage admissions stages, and onboard enrolled students.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by student name, guardian email..."
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 md:w-80 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Pipeline Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Applications Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">Loading applicant pipeline...</p>
          </div>
        ) : applicants.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Applications Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === "ALL"
                ? "No prospective student applications have been received yet."
                : `No applications currently in the "${STATUS_CONFIG[activeTab]?.label}" stage.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Student Applicant</th>
                  <th className="px-6 py-3.5">Grade Level</th>
                  <th className="px-6 py-3.5">Guardian Contact</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Submitted</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applicants.map((app) => {
                  const statusInfo = STATUS_CONFIG[app.status] || STATUS_CONFIG.SUBMITTED;
                  return (
                    <tr
                      key={app.id}
                      onClick={() => handleOpenDetail(app)}
                      className="hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">
                          {app.firstName} {app.middleName ? `${app.middleName} ` : ""}{app.lastName}
                        </div>
                        {app.previousSchool && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            Prev: {app.previousSchool}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                          {app.gradeLevelAppliedFor || "Not Specified"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-slate-900 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {app.guardianEmail}
                        </div>
                        {(app.guardianPhone || app.fatherMobile || app.motherMobile) && (
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {app.guardianPhone || app.fatherMobile || app.motherMobile}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(app);
                          }}
                          className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-600 hover:text-indigo-600 transition"
                          title="View Application Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {meta.totalPages > 1 && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {meta.page} of {meta.totalPages} ({meta.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Applicant Detail Modal */}
      {selectedApplicant && (
        <Modal
          open={!!selectedApplicant}
          onClose={() => setSelectedApplicant(null)}
          title={`Application: ${selectedApplicant.firstName} ${selectedApplicant.lastName}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Header / Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    STATUS_CONFIG[selectedApplicant.status]?.color || STATUS_CONFIG.SUBMITTED.color
                  }`}
                >
                  {STATUS_CONFIG[selectedApplicant.status]?.label || selectedApplicant.status}
                </span>
                <span className="text-xs text-slate-400">
                  Applied {new Date(selectedApplicant.submittedAt).toLocaleDateString()}
                </span>
              </div>

              {/* Status Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedApplicant.status === "SUBMITTED" && (
                  <button
                    type="button"
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: selectedApplicant.id,
                        status: "UNDER_REVIEW",
                      })
                    }
                    disabled={updateStatusMutation.isPending}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition"
                  >
                    Move to Under Review
                  </button>
                )}

                {(selectedApplicant.status === "SUBMITTED" || selectedApplicant.status === "UNDER_REVIEW") && (
                  <button
                    type="button"
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: selectedApplicant.id,
                        status: "INTERVIEW_SCHEDULED",
                      })
                    }
                    disabled={updateStatusMutation.isPending}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition"
                  >
                    Schedule Interview
                  </button>
                )}

                {selectedApplicant.status !== "ACCEPTED" &&
                  selectedApplicant.status !== "ENROLLED" &&
                  selectedApplicant.status !== "REJECTED" && (
                    <button
                      type="button"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: selectedApplicant.id,
                          status: "ACCEPTED",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                    </button>
                  )}

                {selectedApplicant.status !== "REJECTED" &&
                  selectedApplicant.status !== "ENROLLED" && (
                    <button
                      type="button"
                      onClick={() => setIsRejectModalOpen(true)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition"
                    >
                      Reject
                    </button>
                  )}

                {/* Convert to Student Button (when ACCEPTED) */}
                {selectedApplicant.status === "ACCEPTED" && !selectedApplicant.convertedUserId && (
                  <button
                    type="button"
                    onClick={() => convertMutation.mutate(selectedApplicant.id)}
                    disabled={convertMutation.isPending}
                    className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 animate-pulse"
                  >
                    {convertMutation.isPending ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <GraduationCap className="w-4 h-4" />
                    )}
                    Convert to Student Account
                  </button>
                )}
              </div>
            </div>

            {/* Rejection notice if present */}
            {selectedApplicant.status === "REJECTED" && selectedApplicant.rejectionReason && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                <strong>Rejection Reason:</strong> {selectedApplicant.rejectionReason}
              </div>
            )}

            {/* Enrolled Badge if already converted */}
            {selectedApplicant.convertedUserId && (
              <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <strong>Enrolled Student Account Active</strong>
                </span>
                <span className="text-[11px] text-teal-600">
                  Converted on {new Date(selectedApplicant.convertedAt).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Student & Guardian Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Student Details */}
              <div className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" /> Student Profile
                </h4>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <p><span className="text-slate-400">Full Name:</span> <strong>{selectedApplicant.firstName} {selectedApplicant.middleName || ""} {selectedApplicant.lastName}</strong></p>
                  <p><span className="text-slate-400">Grade Applied For:</span> <strong>{selectedApplicant.gradeLevelAppliedFor || "N/A"}</strong></p>
                  <p><span className="text-slate-400">Gender:</span> {selectedApplicant.gender || "Not specified"}</p>
                  <p><span className="text-slate-400">Date of Birth:</span> {selectedApplicant.dateOfBirth ? new Date(selectedApplicant.dateOfBirth).toLocaleDateString() : "Not specified"}</p>
                  <p><span className="text-slate-400">Previous School:</span> {selectedApplicant.previousSchool || "None"}</p>
                  <p><span className="text-slate-400">Nationality:</span> {selectedApplicant.nationality || "Not specified"}</p>
                </div>
              </div>

              {/* Guardian & Family Details */}
              <div className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" /> Guardian & Family
                </h4>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <p><span className="text-slate-400">Guardian Email:</span> <strong>{selectedApplicant.guardianEmail}</strong></p>
                  <p><span className="text-slate-400">Primary Phone:</span> {selectedApplicant.guardianPhone || "N/A"}</p>
                  {selectedApplicant.fatherFirstName && (
                    <p><span className="text-slate-400">Father:</span> {selectedApplicant.fatherFirstName} {selectedApplicant.fatherLastName || ""} {selectedApplicant.fatherMobile ? `(${selectedApplicant.fatherMobile})` : ""}</p>
                  )}
                  {selectedApplicant.motherFirstName && (
                    <p><span className="text-slate-400">Mother:</span> {selectedApplicant.motherFirstName} {selectedApplicant.motherLastName || ""} {selectedApplicant.motherMobile ? `(${selectedApplicant.motherMobile})` : ""}</p>
                  )}
                  <p><span className="text-slate-400">Address:</span> {selectedApplicant.address ? `${selectedApplicant.address}, ${selectedApplicant.city || ""}` : "Not specified"}</p>
                </div>
              </div>
            </div>

            {/* Internal Admin Notes */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Internal Administrative Notes (Private)
              </label>
              <textarea
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Add evaluation comments, interview scores, document verification status..."
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    updateNotesMutation.mutate({
                      id: selectedApplicant.id,
                      notes: notesDraft,
                    })
                  }
                  disabled={updateNotesMutation.isPending}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" /> Save Notes
                </button>
              </div>
            </div>

            {/* Delete button (only when REJECTED or WITHDRAWN) */}
            {(selectedApplicant.status === "REJECTED" || selectedApplicant.status === "WITHDRAWN") && (
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[11px] text-slate-400">This rejected/withdrawn record can be permanently purged.</p>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this applicant record?")) {
                      deleteMutation.mutate(selectedApplicant.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Application
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Rejection Reason Modal */}
      {isRejectModalOpen && (
        <Modal
          open={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          title="Reject Admission Application"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Please specify the internal reason for rejecting this application. (Note: No automatic email will be sent to the applicant).
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Class capacity reached for Grade 10, entrance exam criteria not met..."
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!rejectionReason.trim()) {
                    toast.error("Please enter a rejection reason");
                    return;
                  }
                  updateStatusMutation.mutate({
                    id: selectedApplicant.id,
                    status: "REJECTED",
                    rejectionReason,
                  });
                }}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Converted Student Credentials Modal */}
      {convertedStudent && (
        <Modal
          open={!!convertedStudent}
          onClose={() => setConvertedStudent(null)}
          title="🎉 Student Account Successfully Provisioned!"
          size="md"
        >
          <div className="space-y-5">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Account Ready for Student Login</p>
                <p className="mt-0.5">
                  The student profile and portal login credentials have been created. An acceptance welcome email has also been sent to the guardian.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500">Student Name</span>
                <span className="font-bold text-slate-900">
                  {convertedStudent.studentUser?.firstName} {convertedStudent.studentUser?.lastName}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500">Admission Number</span>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  {convertedStudent.admissionNumber}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500">Portal Login Email</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">{convertedStudent.studentEmail}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(convertedStudent.studentEmail, "email")}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    {copiedField === "email" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Temporary Password</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    {convertedStudent.tempPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(convertedStudent.tempPassword, "password")}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    {copiedField === "password" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setConvertedStudent(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
