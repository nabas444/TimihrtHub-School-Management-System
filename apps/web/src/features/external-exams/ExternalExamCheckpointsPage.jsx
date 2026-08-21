import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Filter,
  Award,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  Calendar,
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  Pencil,
  Trash2,
  Check,
  ChevronRight,
  ArrowLeft,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState, ConfirmDialog, Avatar } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";

const REGISTRATION_STATUS_CONFIG = {
  NOT_REGISTERED: { label: "Not Registered", variant: "gray" },
  REGISTERED: { label: "Registered", variant: "blue" },
  SAT: { label: "Sat for Exam", variant: "purple" },
  ABSENT: { label: "Absent", variant: "red" },
  RESULT_PENDING: { label: "Result Pending", variant: "yellow" },
  RESULT_RECORDED: { label: "Result Recorded", variant: "green" },
};

export default function ExternalExamCheckpointsPage() {
  const qc = useQueryClient();
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterGrade, setFilterGrade] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCheckpoint, setEditingCheckpoint] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [checkpointToDelete, setCheckpointToDelete] = useState(null);

  // Form State for Checkpoint
  const [checkpointForm, setCheckpointForm] = useState({
    name: "",
    gradeLevelId: "",
    academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    administeringBody: "Regional Education Bureau",
    examWindowStart: "",
    examWindowEnd: "",
    passCutoff: 50,
    notes: "",
  });

  // Queries
  const { data: checkpoints, isLoading: loadingCheckpoints } = useQuery({
    queryKey: ["external-exam-checkpoints", filterYear, filterGrade],
    queryFn: () =>
      api
        .get("/external-exams/checkpoints", {
          params: {
            academicYear: filterYear || undefined,
            gradeLevelId: filterGrade || undefined,
          },
        })
        .then((r) => r.data.data),
  });

  const { data: gradeLevels } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data),
  });

  const { data: selectedCheckpoint, isLoading: loadingDetail } = useQuery({
    queryKey: ["external-exam-checkpoint", selectedCheckpointId],
    queryFn: () =>
      api
        .get(`/external-exams/checkpoints/${selectedCheckpointId}`)
        .then((r) => r.data.data),
    enabled: !!selectedCheckpointId,
  });

  const { data: cohortReport } = useQuery({
    queryKey: ["external-exam-cohort-report", selectedCheckpointId],
    queryFn: () =>
      api
        .get(`/external-exams/checkpoints/${selectedCheckpointId}/cohort-report`)
        .then((r) => r.data.data),
    enabled: !!selectedCheckpointId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => api.post("/external-exams/checkpoints", data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["external-exam-checkpoints"] });
      setCreateModalOpen(false);
      toast.success("External exam checkpoint created successfully");
      if (res.data?.data?.id) {
        setSelectedCheckpointId(res.data.data.id);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create checkpoint");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/external-exams/checkpoints/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["external-exam-checkpoints"] });
      qc.invalidateQueries({ queryKey: ["external-exam-checkpoint", selectedCheckpointId] });
      setEditModalOpen(false);
      toast.success("Checkpoint updated successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update checkpoint");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/external-exams/checkpoints/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["external-exam-checkpoints"] });
      if (selectedCheckpointId === checkpointToDelete?.id) {
        setSelectedCheckpointId(null);
      }
      setDeleteConfirmOpen(false);
      setCheckpointToDelete(null);
      toast.success("Checkpoint deleted successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete checkpoint");
    },
  });

  const sortedGradeLevels = useMemo(() => {
    return (gradeLevels ?? []).slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [gradeLevels]);

  const filteredCheckpoints = useMemo(() => {
    if (!checkpoints) return [];
    return checkpoints.filter((cp) => {
      if (
        searchQuery &&
        !cp.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !cp.administeringBody?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [checkpoints, searchQuery]);

  const handleOpenCreate = () => {
    // Default to first grade level with EXTERNAL_EXAM milestone if any
    const milestoneGrade = sortedGradeLevels.find(
      (g) => g.milestoneType === "EXTERNAL_EXAM",
    );
    setCheckpointForm({
      name: milestoneGrade ? `${milestoneGrade.name} Regional Examination` : "Grade 6 Regional Examination",
      gradeLevelId: milestoneGrade ? milestoneGrade.id : sortedGradeLevels[0]?.id || "",
      academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
      administeringBody: "Regional Education Bureau",
      examWindowStart: "",
      examWindowEnd: "",
      passCutoff: 50,
      notes: "",
    });
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (cp, e) => {
    if (e) e.stopPropagation();
    setEditingCheckpoint(cp);
    setCheckpointForm({
      name: cp.name,
      gradeLevelId: cp.gradeLevelId,
      academicYear: cp.academicYear,
      administeringBody: cp.administeringBody || "",
      examWindowStart: cp.examWindowStart ? cp.examWindowStart.split("T")[0] : "",
      examWindowEnd: cp.examWindowEnd ? cp.examWindowEnd.split("T")[0] : "",
      passCutoff: cp.passCutoff ?? 50,
      notes: cp.notes || "",
    });
    setEditModalOpen(true);
  };

  const handleOpenDelete = (cp, e) => {
    if (e) e.stopPropagation();
    setCheckpointToDelete(cp);
    setDeleteConfirmOpen(true);
  };

  if (loadingCheckpoints && !checkpoints) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* If a checkpoint is selected, render its comprehensive detail & roster view */}
      {selectedCheckpointId && selectedCheckpoint ? (
        <CheckpointDetailView
          checkpoint={selectedCheckpoint}
          cohortReport={cohortReport}
          onBack={() => setSelectedCheckpointId(null)}
          onEdit={() => handleOpenEdit(selectedCheckpoint)}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="page-title flex items-center gap-2">
                <Award className="w-7 h-7 text-primary-600" />
                External Exam Checkpoints
              </h1>
              <p className="page-subtitle">
                Manage ministry and national examination registrations, exam centers, results, and cohort analytics.
              </p>
            </div>

            <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Checkpoint
            </button>
          </div>

          {/* Filters Bar */}
          <div className="card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="input pl-9 text-sm"
                placeholder="Search checkpoint or authority..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <select
                className="input text-sm w-full sm:w-auto"
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
              >
                <option value="">All Grade Levels</option>
                {sortedGradeLevels.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.milestoneType === "EXTERNAL_EXAM" ? "★" : ""}
                  </option>
                ))}
              </select>

              <input
                className="input text-sm w-full sm:w-36 font-mono"
                placeholder="Year (e.g. 2025/2026)"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              />

              {(searchQuery || filterGrade || filterYear) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterGrade("");
                    setFilterYear("");
                  }}
                  className="btn-secondary text-xs"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Checkpoint Cards Grid */}
          {filteredCheckpoints.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No External Exam Checkpoints"
              description="No regional or national exam checkpoints have been set up yet. Create a checkpoint to start registering candidates and tracking official results."
              action={
                <button onClick={handleOpenCreate} className="btn-primary btn-sm">
                  <Plus className="w-4 h-4 mr-1" /> Create Checkpoint
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCheckpoints.map((cp) => {
                const count = cp._count?.records ?? 0;
                const isMilestone = cp.gradeLevel?.milestoneType === "EXTERNAL_EXAM";

                return (
                  <div
                    key={cp.id}
                    onClick={() => setSelectedCheckpointId(cp.id)}
                    className="card p-5 hover:shadow-md transition-all cursor-pointer border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="badge-primary font-mono text-xs">
                          {cp.academicYear}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isMilestone && (
                            <span className="badge-purple text-[10px] uppercase font-bold tracking-wider">
                              Milestone
                            </span>
                          )}
                          <span className="badge-blue text-xs font-semibold">
                            {cp.gradeLevel?.name || "Grade"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-primary-600 transition-colors">
                          {cp.name}
                        </h3>
                        {cp.administeringBody && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                            <Building className="w-3.5 h-3.5" />
                            {cp.administeringBody}
                          </p>
                        )}
                      </div>

                      {/* Dates & Pass Cutoff */}
                      <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl">
                        {(cp.examWindowStart || cp.examWindowEnd) ? (
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Calendar className="w-3.5 h-3.5 text-primary-500" />
                            <span>
                              {cp.examWindowStart ? new Date(cp.examWindowStart).toLocaleDateString() : "TBD"}{" "}
                              – {cp.examWindowEnd ? new Date(cp.examWindowEnd).toLocaleDateString() : "TBD"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <Clock className="w-3.5 h-3.5" /> Exam window dates to be announced
                          </div>
                        )}
                        {cp.passCutoff !== null && (
                          <div className="flex items-center gap-1 text-[11px] text-primary-700 dark:text-primary-400 font-semibold">
                            <span>Official Pass Cutoff:</span>
                            <span className="font-bold">{cp.passCutoff}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <Users className="w-4 h-4 text-primary-600" />
                        <span>{count} {count === 1 ? "Candidate" : "Candidates"}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleOpenEdit(cp, e)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700"
                          title="Edit Checkpoint"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenDelete(cp, e)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600"
                          title="Delete Checkpoint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="p-1.5 text-primary-600 group-hover:translate-x-1 transition-transform">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Checkpoint Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create External Exam Checkpoint"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              ...checkpointForm,
              examWindowStart: checkpointForm.examWindowStart
                ? new Date(checkpointForm.examWindowStart).toISOString()
                : undefined,
              examWindowEnd: checkpointForm.examWindowEnd
                ? new Date(checkpointForm.examWindowEnd).toISOString()
                : undefined,
              passCutoff: checkpointForm.passCutoff ? parseFloat(checkpointForm.passCutoff) : null,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Grade Level *</label>
            <select
              className="input"
              value={checkpointForm.gradeLevelId}
              onChange={(e) => {
                const gid = e.target.value;
                const gl = sortedGradeLevels.find((g) => g.id === gid);
                setCheckpointForm((f) => ({
                  ...f,
                  gradeLevelId: gid,
                  name: gl ? `${gl.name} Regional Examination` : f.name,
                }));
              }}
              required
            >
              <option value="">Select Grade Level</option>
              {sortedGradeLevels.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.milestoneType === "EXTERNAL_EXAM" ? "(Milestone: External Exam)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Academic Year *</label>
              <input
                className="input font-mono"
                placeholder="2025/2026"
                value={checkpointForm.academicYear}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, academicYear: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Pass Cutoff Mark (%)</label>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                step="0.5"
                placeholder="50"
                value={checkpointForm.passCutoff ?? ""}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, passCutoff: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Exam Name *</label>
            <input
              className="input"
              placeholder="e.g. Grade 6 Regional Examination"
              value={checkpointForm.name}
              onChange={(e) => setCheckpointForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">Administering Examination Body</label>
            <input
              className="input"
              placeholder="e.g. Regional Education Bureau / EAES"
              value={checkpointForm.administeringBody}
              onChange={(e) => setCheckpointForm((f) => ({ ...f, administeringBody: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Exam Window Start</label>
              <input
                className="input text-xs"
                type="date"
                value={checkpointForm.examWindowStart}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, examWindowStart: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Exam Window End</label>
              <input
                className="input text-xs"
                type="date"
                value={checkpointForm.examWindowEnd}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, examWindowEnd: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Notes / Instructions</label>
            <textarea
              className="input text-xs"
              rows={2}
              placeholder="Optional notes regarding exam center logistics, registration slips, etc."
              value={checkpointForm.notes}
              onChange={(e) => setCheckpointForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Checkpoint"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Checkpoint Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit External Exam Checkpoint"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate({
              id: editingCheckpoint.id,
              data: {
                name: checkpointForm.name,
                administeringBody: checkpointForm.administeringBody,
                examWindowStart: checkpointForm.examWindowStart
                  ? new Date(checkpointForm.examWindowStart).toISOString()
                  : null,
                examWindowEnd: checkpointForm.examWindowEnd
                  ? new Date(checkpointForm.examWindowEnd).toISOString()
                  : null,
                passCutoff: checkpointForm.passCutoff ? parseFloat(checkpointForm.passCutoff) : null,
                notes: checkpointForm.notes,
              },
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Exam Name *</label>
            <input
              className="input"
              value={checkpointForm.name}
              onChange={(e) => setCheckpointForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Administering Body</label>
              <input
                className="input"
                value={checkpointForm.administeringBody}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, administeringBody: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Pass Cutoff Mark (%)</label>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={checkpointForm.passCutoff ?? ""}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, passCutoff: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Exam Window Start</label>
              <input
                className="input text-xs"
                type="date"
                value={checkpointForm.examWindowStart}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, examWindowStart: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Exam Window End</label>
              <input
                className="input text-xs"
                type="date"
                value={checkpointForm.examWindowEnd}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, examWindowEnd: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Notes / Instructions</label>
            <textarea
              className="input text-xs"
              rows={2}
              value={checkpointForm.notes}
              onChange={(e) => setCheckpointForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate(checkpointToDelete.id)}
        title="Delete Checkpoint"
        message={`Are you sure you want to delete "${checkpointToDelete?.name}"? All registered candidate records for this checkpoint will also be deleted.`}
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL & ROSTER MANAGEMENT VIEW FOR A SELECTED CHECKPOINT
// ─────────────────────────────────────────────────────────────────────────────
function CheckpointDetailView({ checkpoint, cohortReport, onBack, onEdit }) {
  const qc = useQueryClient();

  // Filters inside roster
  const [rosterSearch, setRosterSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  // Modals inside detail view
  const [registerBulkOpen, setRegisterBulkOpen] = useState(false);
  const [batchResultsOpen, setBatchResultsOpen] = useState(false);
  const [editRecordOpen, setEditRecordOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);

  // Edit Record Form State
  const [recordForm, setRecordForm] = useState({
    registrationNumber: "",
    examCenter: "",
    status: "REGISTERED",
    score: "",
    grade: "",
    isPassing: true,
    resultDocumentUrl: "",
    notes: "",
  });

  // Batch Results State (Array of rows)
  const [batchRows, setBatchRows] = useState([]);

  // Mutations
  const registerBulkMutation = useMutation({
    mutationFn: (data) =>
      api.post(`/external-exams/checkpoints/${checkpoint.id}/register-bulk`, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["external-exam-checkpoint", checkpoint.id] });
      qc.invalidateQueries({ queryKey: ["external-exam-cohort-report", checkpoint.id] });
      qc.invalidateQueries({ queryKey: ["external-exam-checkpoints"] });
      setRegisterBulkOpen(false);
      toast.success(res.data?.message || "Students registered successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to register students");
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ recordId, data }) =>
      api.patch(`/external-exams/records/${recordId}/result`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["external-exam-checkpoint", checkpoint.id] });
      qc.invalidateQueries({ queryKey: ["external-exam-cohort-report", checkpoint.id] });
      setEditRecordOpen(false);
      toast.success("Candidate result recorded successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to record result");
    },
  });

  const batchResultsMutation = useMutation({
    mutationFn: (data) =>
      api.post(`/external-exams/checkpoints/${checkpoint.id}/results/bulk`, { results: data }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["external-exam-checkpoint", checkpoint.id] });
      qc.invalidateQueries({ queryKey: ["external-exam-cohort-report", checkpoint.id] });
      setBatchResultsOpen(false);
      toast.success(res.data?.message || "Batch results saved successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save batch results");
    },
  });

  const records = checkpoint.records || [];

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const student = r.studentProfile;
      const name = [student?.user?.firstName, student?.user?.middleName, student?.user?.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const adm = (student?.admissionNumber || "").toLowerCase();
      const reg = (r.registrationNumber || "").toLowerCase();
      const center = (r.examCenter || "").toLowerCase();

      if (
        rosterSearch &&
        !name.includes(rosterSearch.toLowerCase()) &&
        !adm.includes(rosterSearch.toLowerCase()) &&
        !reg.includes(rosterSearch.toLowerCase()) &&
        !center.includes(rosterSearch.toLowerCase())
      ) {
        return false;
      }

      if (statusFilter && r.status !== statusFilter) return false;
      if (resultFilter === "PASS" && r.isPassing !== true) return false;
      if (resultFilter === "FAIL" && r.isPassing !== false) return false;
      if (resultFilter === "PENDING" && r.isPassing !== null) return false;

      return true;
    });
  }, [records, rosterSearch, statusFilter, resultFilter]);

  const summary = cohortReport?.summary || {
    totalRegistered: records.length,
    sat: records.filter((r) => r.status === "SAT" || r.status === "RESULT_RECORDED").length,
    absent: records.filter((r) => r.status === "ABSENT").length,
    resultRecorded: records.filter((r) => r.status === "RESULT_RECORDED").length,
    passing: records.filter((r) => r.isPassing === true).length,
    failing: records.filter((r) => r.isPassing === false).length,
    passRate: 0,
    averageScore: null,
  };

  const handleOpenEditRecord = (record) => {
    setActiveRecord(record);
    setRecordForm({
      registrationNumber: record.registrationNumber || "",
      examCenter: record.examCenter || "",
      status: record.status || "REGISTERED",
      score: record.score !== null && record.score !== undefined ? record.score : "",
      grade: record.grade || "",
      isPassing: record.isPassing !== null ? record.isPassing : true,
      resultDocumentUrl: record.resultDocumentUrl || "",
      notes: record.notes || "",
    });
    setEditRecordOpen(true);
  };

  const handleOpenBatchResults = () => {
    setBatchRows(
      records.map((r) => ({
        recordId: r.id,
        studentProfileId: r.studentProfileId,
        studentName: [r.studentProfile?.user?.firstName, r.studentProfile?.user?.lastName]
          .filter(Boolean)
          .join(" "),
        className: r.studentProfile?.class?.name || "—",
        registrationNumber: r.registrationNumber || "",
        examCenter: r.examCenter || "",
        score: r.score !== null && r.score !== undefined ? r.score : "",
        grade: r.grade || "",
        isPassing: r.isPassing !== null && r.isPassing !== undefined ? r.isPassing : true,
        status: r.status || "RESULT_RECORDED",
      })),
    );
    setBatchResultsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="btn-secondary btn-sm flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Checkpoints
        </button>

        <button onClick={onEdit} className="btn-secondary btn-sm flex items-center gap-1 text-xs">
          <Pencil className="w-3.5 h-3.5" /> Edit Checkpoint Details
        </button>
      </div>

      {/* Checkpoint Header Card */}
      <div className="card p-6 bg-gradient-to-r from-primary-900 to-indigo-900 text-white rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs font-mono">
                {checkpoint.academicYear}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
                {checkpoint.gradeLevel?.name}
              </span>
              {checkpoint.gradeLevel?.milestoneType === "EXTERNAL_EXAM" && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-amber-950 uppercase tracking-wide">
                  Milestone Checkpoint
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black">{checkpoint.name}</h2>
            {checkpoint.administeringBody && (
              <p className="text-xs text-primary-200 mt-1 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" /> Administered by {checkpoint.administeringBody}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRegisterBulkOpen(true)}
              className="px-4 py-2 bg-white text-primary-900 font-bold rounded-xl text-xs hover:bg-primary-50 transition shadow-xs flex items-center gap-1.5"
            >
              <Users className="w-4 h-4 text-primary-700" />
              Register Eligible Students
            </button>
            <button
              onClick={handleOpenBatchResults}
              disabled={records.length === 0}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-600 text-white font-bold rounded-xl text-xs transition border border-white/20 shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Record Results (Batch)
            </button>
          </div>
        </div>

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-4 border-t border-white/10 text-center">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5">
            <p className="text-[11px] text-primary-200 uppercase font-semibold">Registered</p>
            <p className="text-xl font-extrabold">{summary.totalRegistered}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5">
            <p className="text-[11px] text-primary-200 uppercase font-semibold">Sat for Exam</p>
            <p className="text-xl font-extrabold">{summary.sat}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5">
            <p className="text-[11px] text-primary-200 uppercase font-semibold">Absent</p>
            <p className="text-xl font-extrabold text-red-300">{summary.absent}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5">
            <p className="text-[11px] text-primary-200 uppercase font-semibold">Passed</p>
            <p className="text-xl font-extrabold text-emerald-300">{summary.passing}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5">
            <p className="text-[11px] text-primary-200 uppercase font-semibold">Pass Rate</p>
            <p className="text-xl font-extrabold text-amber-300">{summary.passRate}%</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5">
            <p className="text-[11px] text-primary-200 uppercase font-semibold">Avg. Score</p>
            <p className="text-xl font-extrabold">
              {summary.averageScore !== null ? `${summary.averageScore}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Roster & Candidate Management Table */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9 text-xs"
              placeholder="Search candidate name, admission #, reg #..."
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <select
              className="input text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {Object.entries(REGISTRATION_STATUS_CONFIG).map(([val, { label }]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            <select
              className="input text-xs"
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
            >
              <option value="">All Results</option>
              <option value="PASS">Passing Only</option>
              <option value="FAIL">Failing Only</option>
              <option value="PENDING">Result Pending</option>
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {records.length === 0 ? (
              <div>
                <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">No candidates registered yet</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  Click "Register Eligible Students" above to automatically pull all students in {checkpoint.gradeLevel?.name}.
                </p>
              </div>
            ) : (
              <p>No candidates match the active filters.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Candidate</th>
                  <th>Admission / Class</th>
                  <th>Registration #</th>
                  <th>Exam Center</th>
                  <th>Status</th>
                  <th>Score / Grade</th>
                  <th>Result</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, index) => {
                  const student = record.studentProfile;
                  const name = [student?.user?.firstName, student?.user?.middleName, student?.user?.lastName]
                    .filter(Boolean)
                    .join(" ");
                  const stConfig =
                    REGISTRATION_STATUS_CONFIG[record.status] ||
                    REGISTRATION_STATUS_CONFIG.NOT_REGISTERED;

                  return (
                    <tr key={record.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                      <td className="text-xs text-gray-400 font-mono">{index + 1}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={student?.user?.avatar}
                            name={name}
                            size="sm"
                          />
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-xs">
                              {name}
                            </p>
                            {student?.user?.gender && (
                              <p className="text-[10px] text-gray-400 capitalize">
                                {student.user.gender.toLowerCase()}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {student?.admissionNumber || "—"}
                        </p>
                        <p className="text-[11px] text-gray-500">{student?.class?.name || "—"}</p>
                      </td>
                      <td>
                        {record.registrationNumber ? (
                          <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                            {record.registrationNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not set</span>
                        )}
                      </td>
                      <td>
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          {record.examCenter || "—"}
                        </span>
                      </td>
                      <td>
                        <Badge variant={stConfig.variant}>{stConfig.label}</Badge>
                      </td>
                      <td>
                        {record.score !== null && record.score !== undefined ? (
                          <span className="font-bold text-xs font-mono">
                            {record.score}
                            {record.grade && (
                              <span className="ml-1 text-[11px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md">
                                {record.grade}
                              </span>
                            )}
                          </span>
                        ) : record.grade ? (
                          <span className="font-bold text-xs">{record.grade}</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td>
                        {record.isPassing === true ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                          </span>
                        ) : record.isPassing === false ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                            <XCircle className="w-3.5 h-3.5" /> Fail
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Pending</span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleOpenEditRecord(record)}
                          className="btn-secondary btn-sm text-xs py-1 px-2.5"
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Record Result
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Register Modal */}
      <Modal
        open={registerBulkOpen}
        onClose={() => setRegisterBulkOpen(false)}
        title="Register Eligible Students"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-primary-50 dark:bg-primary-950/40 rounded-xl border border-primary-100 text-xs text-primary-900 dark:text-primary-300">
            <p className="font-bold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary-600" />
              Automatic Cohort Registration
            </p>
            <p>
              This will automatically enroll every active student in{" "}
              <strong>{checkpoint.gradeLevel?.name}</strong> as a candidate for this external examination.
            </p>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400">
            Existing registered candidates will be preserved safely without duplicates.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRegisterBulkOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={registerBulkMutation.isPending}
              onClick={() => registerBulkMutation.mutate({ excludeStudentProfileIds: [] })}
            >
              {registerBulkMutation.isPending ? "Registering..." : "Confirm & Register All Students"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Single Candidate Record / Result Modal */}
      <Modal
        open={editRecordOpen}
        onClose={() => setEditRecordOpen(false)}
        title={`Candidate Result: ${
          activeRecord
            ? [
                activeRecord.studentProfile?.user?.firstName,
                activeRecord.studentProfile?.user?.lastName,
              ].join(" ")
            : ""
        }`}
        size="md"
      >
        {activeRecord && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateRecordMutation.mutate({
                recordId: activeRecord.id,
                data: {
                  registrationNumber: recordForm.registrationNumber || null,
                  examCenter: recordForm.examCenter || null,
                  score: recordForm.score !== "" ? parseFloat(recordForm.score) : null,
                  grade: recordForm.grade || null,
                  isPassing: recordForm.isPassing,
                  resultDocumentUrl: recordForm.resultDocumentUrl || null,
                  notes: recordForm.notes || null,
                },
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Official Registration #</label>
                <input
                  className="input font-mono text-xs"
                  placeholder="e.g. REG-2026-904"
                  value={recordForm.registrationNumber}
                  onChange={(e) =>
                    setRecordForm((f) => ({ ...f, registrationNumber: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Exam Center</label>
                <input
                  className="input text-xs"
                  placeholder="e.g. Center Hall B"
                  value={recordForm.examCenter}
                  onChange={(e) =>
                    setRecordForm((f) => ({ ...f, examCenter: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Official Score</label>
                <input
                  className="input font-mono"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 85.5"
                  value={recordForm.score}
                  onChange={(e) => {
                    const sc = e.target.value;
                    const numSc = parseFloat(sc);
                    const cutoff = checkpoint.passCutoff ?? 50;
                    setRecordForm((f) => ({
                      ...f,
                      score: sc,
                      isPassing: isNaN(numSc) ? f.isPassing : numSc >= cutoff,
                    }));
                  }}
                />
              </div>
              <div>
                <label className="label">Letter / Band Grade</label>
                <input
                  className="input font-mono uppercase"
                  placeholder="e.g. A, Distinction"
                  value={recordForm.grade}
                  onChange={(e) =>
                    setRecordForm((f) => ({ ...f, grade: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Result Outcome</label>
                <select
                  className="input text-xs font-semibold"
                  value={recordForm.isPassing ? "PASS" : "FAIL"}
                  onChange={(e) =>
                    setRecordForm((f) => ({
                      ...f,
                      isPassing: e.target.value === "PASS",
                    }))
                  }
                >
                  <option value="PASS">Pass (Eligible)</option>
                  <option value="FAIL">Fail (Not Passing)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Official Result Document / Scan URL</label>
              <input
                className="input text-xs"
                placeholder="https://... result slip scan or cloud url"
                value={recordForm.resultDocumentUrl}
                onChange={(e) =>
                  setRecordForm((f) => ({ ...f, resultDocumentUrl: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="label">Notes / Remarks</label>
              <textarea
                className="input text-xs"
                rows={2}
                placeholder="Optional notes regarding remarks or re-check..."
                value={recordForm.notes}
                onChange={(e) =>
                  setRecordForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditRecordOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={updateRecordMutation.isPending}
              >
                {updateRecordMutation.isPending ? "Saving..." : "Save Official Result"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Batch Results Entry Modal */}
      <Modal
        open={batchResultsOpen}
        onClose={() => setBatchResultsOpen(false)}
        title="Batch Entry: Official Exam Results"
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Quickly input scores, grades, and pass/fail statuses for all registered candidates in one table.
          </p>

          <div className="max-h-[60vh] overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl">
            <table className="table text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
                <tr>
                  <th>Student Name</th>
                  <th>Class</th>
                  <th className="w-36">Reg #</th>
                  <th className="w-24">Score</th>
                  <th className="w-20">Grade</th>
                  <th className="w-28">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {batchRows.map((row, idx) => (
                  <tr key={row.recordId}>
                    <td className="font-semibold">{row.studentName}</td>
                    <td className="text-gray-500">{row.className}</td>
                    <td>
                      <input
                        className="input text-xs py-1 px-2 font-mono"
                        placeholder="Reg #"
                        value={row.registrationNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchRows((rows) => {
                            const copy = [...rows];
                            copy[idx] = { ...copy[idx], registrationNumber: val };
                            return copy;
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input text-xs py-1 px-2 font-mono"
                        type="number"
                        step="0.1"
                        placeholder="Score"
                        value={row.score}
                        onChange={(e) => {
                          const sc = e.target.value;
                          const numSc = parseFloat(sc);
                          const cutoff = checkpoint.passCutoff ?? 50;
                          setBatchRows((rows) => {
                            const copy = [...rows];
                            copy[idx] = {
                              ...copy[idx],
                              score: sc,
                              isPassing: isNaN(numSc) ? copy[idx].isPassing : numSc >= cutoff,
                            };
                            return copy;
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input text-xs py-1 px-2 font-mono uppercase"
                        placeholder="A"
                        value={row.grade}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchRows((rows) => {
                            const copy = [...rows];
                            copy[idx] = { ...copy[idx], grade: val };
                            return copy;
                          });
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className="input text-xs py-1 px-2 font-bold"
                        value={row.isPassing ? "PASS" : "FAIL"}
                        onChange={(e) => {
                          const isPass = e.target.value === "PASS";
                          setBatchRows((rows) => {
                            const copy = [...rows];
                            copy[idx] = { ...copy[idx], isPassing: isPass };
                            return copy;
                          });
                        }}
                      >
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setBatchResultsOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={batchResultsMutation.isPending}
              onClick={() => {
                const formatted = batchRows.map((r) => ({
                  recordId: r.recordId,
                  studentProfileId: r.studentProfileId,
                  registrationNumber: r.registrationNumber || null,
                  examCenter: r.examCenter || null,
                  score: r.score !== "" && r.score !== undefined ? parseFloat(r.score) : null,
                  grade: r.grade || null,
                  isPassing: r.isPassing,
                  status: "RESULT_RECORDED",
                }));
                batchResultsMutation.mutate(formatted);
              }}
            >
              {batchResultsMutation.isPending ? "Saving..." : "Save All Results"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
