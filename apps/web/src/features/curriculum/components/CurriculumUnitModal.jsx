import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Check,
  BookOpen,
  Paperclip,
  Upload,
  Calendar,
  Layers,
  Sparkles,
  Link2,
} from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import StandardModal from "./StandardModal";
import toast from "react-hot-toast";

export default function CurriculumUnitModal({ open, onClose, unit, defaultSubjectId, defaultGradeLevelId, defaultAcademicYear }) {
  const qc = useQueryClient();
  const isEditing = !!unit;
  const fileInputRef = useRef(null);

  const [standardModalOpen, setStandardModalOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [form, setForm] = useState({
    subjectId: defaultSubjectId || "",
    gradeLevelId: defaultGradeLevelId || "",
    curriculumId: "",
    academicYear: defaultAcademicYear || "2024/2025",
    unitNumber: 1,
    title: "",
    description: "",
    durationWeeks: 3,
    startDate: "",
    endDate: "",
    learningObjectives: [""],
    assessmentMethod: "",
    keyResources: [],
    standardIds: [],
    changeSummary: "",
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-list"],
    queryFn: () => api.get("/academics/subjects").then((r) => r.data.data || []),
    enabled: open,
  });

  const { data: gradeLevels = [] } = useQuery({
    queryKey: ["grade-levels-list"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data || []),
    enabled: open,
  });

  const { data: curriculums = [] } = useQuery({
    queryKey: ["lookup-curriculums"],
    queryFn: () => api.get("/lookup-values?type=CURRICULUM").then((r) => r.data.data || []),
    enabled: open,
  });

  const { data: availableStandards = [] } = useQuery({
    queryKey: ["curriculum-standards", form.subjectId, form.gradeLevelId, form.curriculumId],
    queryFn: () => {
      let url = "/curriculum/standards?";
      if (form.subjectId) url += `subjectId=${form.subjectId}&`;
      if (form.gradeLevelId) url += `gradeLevelId=${form.gradeLevelId}&`;
      if (form.curriculumId) url += `curriculumId=${form.curriculumId}&`;
      return api.get(url).then((r) => r.data.data || []);
    },
    enabled: open && !!form.subjectId,
  });

  useEffect(() => {
    if (unit) {
      setForm({
        subjectId: unit.subjectId || unit.subject?.id || defaultSubjectId || "",
        gradeLevelId: unit.gradeLevelId || unit.gradeLevel?.id || defaultGradeLevelId || "",
        curriculumId: unit.curriculumId || unit.curriculum?.id || "",
        academicYear: unit.academicYear || defaultAcademicYear || "2024/2025",
        unitNumber: unit.unitNumber || 1,
        title: unit.title || "",
        description: unit.description || "",
        durationWeeks: unit.durationWeeks || 3,
        startDate: unit.startDate ? new Date(unit.startDate).toISOString().slice(0, 10) : "",
        endDate: unit.endDate ? new Date(unit.endDate).toISOString().slice(0, 10) : "",
        learningObjectives:
          Array.isArray(unit.learningObjectives) && unit.learningObjectives.length > 0
            ? unit.learningObjectives
            : [""],
        assessmentMethod: unit.assessmentMethod || "",
        keyResources: Array.isArray(unit.keyResources) ? unit.keyResources : [],
        standardIds: Array.isArray(unit.standards) ? unit.standards.map((s) => s.id) : [],
        changeSummary: "",
      });
    } else {
      setForm({
        subjectId: defaultSubjectId || (subjects[0]?.id || ""),
        gradeLevelId: defaultGradeLevelId || (gradeLevels[0]?.id || ""),
        curriculumId: "",
        academicYear: defaultAcademicYear || "2024/2025",
        unitNumber: 1,
        title: "",
        description: "",
        durationWeeks: 3,
        startDate: "",
        endDate: "",
        learningObjectives: [""],
        assessmentMethod: "",
        keyResources: [],
        standardIds: [],
        changeSummary: "",
      });
    }
  }, [unit, defaultSubjectId, defaultGradeLevelId, defaultAcademicYear, open, subjects, gradeLevels]);

  const saveMutation = useMutation({
    mutationFn: (data) =>
      isEditing
        ? api.patch(`/curriculum/units/${unit.id}`, data)
        : api.post("/curriculum/units", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curriculum-units"] });
      toast.success(isEditing ? "Curriculum unit updated" : "Curriculum unit created");
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save curriculum unit");
    },
  });

  const handleAddObjective = () => {
    setForm((f) => ({
      ...f,
      learningObjectives: [...f.learningObjectives, ""],
    }));
  };

  const handleRemoveObjective = (index) => {
    setForm((f) => ({
      ...f,
      learningObjectives: f.learningObjectives.filter((_, idx) => idx !== index),
    }));
  };

  const handleObjectiveChange = (index, value) => {
    setForm((f) => {
      const updated = [...f.learningObjectives];
      updated[index] = value;
      return { ...f, learningObjectives: updated };
    });
  };

  const handleToggleStandard = (standardId) => {
    setForm((f) => {
      const exists = f.standardIds.includes(standardId);
      return {
        ...f,
        standardIds: exists
          ? f.standardIds.filter((id) => id !== standardId)
          : [...f.standardIds, standardId],
      };
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "RESOURCE");
      const res = await api.post("/files/upload", fd);
      const uploaded = res.data.data;

      setForm((f) => ({
        ...f,
        keyResources: [
          ...f.keyResources,
          {
            name: uploaded.name,
            url: uploaded.url,
            fileId: uploaded.id,
            type: "FILE",
          },
        ],
      }));
      toast.success(`Attached resource: ${uploaded.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload resource file");
    } finally {
      setUploadingFile(false);
      if (e.target) e.target.value = "";
    }
  };

  const [resourceLinkName, setResourceLinkName] = useState("");
  const [resourceLinkUrl, setResourceLinkUrl] = useState("");
  const [showAddLink, setShowAddLink] = useState(false);

  const handleAddWebLink = () => {
    if (!resourceLinkUrl.trim()) return;
    setForm((f) => ({
      ...f,
      keyResources: [
        ...f.keyResources,
        {
          name: resourceLinkName.trim() || resourceLinkUrl.trim(),
          url: resourceLinkUrl.trim(),
          type: "LINK",
        },
      ],
    }));
    setResourceLinkName("");
    setResourceLinkUrl("");
    setShowAddLink(false);
  };

  const handleRemoveResource = (index) => {
    setForm((f) => ({
      ...f,
      keyResources: f.keyResources.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.subjectId || !form.gradeLevelId || !form.title.trim()) {
      toast.error("Subject, Grade Level, and Title are required");
      return;
    }

    const payload = {
      ...form,
      unitNumber: Number(form.unitNumber) || 1,
      durationWeeks: form.durationWeeks ? Number(form.durationWeeks) : null,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      learningObjectives: form.learningObjectives.filter((o) => o.trim().length > 0),
    };

    saveMutation.mutate(payload);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEditing ? `Edit Unit ${form.unitNumber}: ${form.title}` : "New Curriculum Unit"}
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
            >
              <Check className="w-4 h-4" />
              {saveMutation.isPending ? "Saving…" : isEditing ? "Update Unit" : "Save Unit Draft"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Header context row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <div>
              <label className="label font-bold">Subject *</label>
              <select
                className="input text-xs"
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                required
                disabled={isEditing}
              >
                <option value="">Select Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label font-bold">Grade Level *</label>
              <select
                className="input text-xs"
                value={form.gradeLevelId}
                onChange={(e) => setForm({ ...form, gradeLevelId: e.target.value })}
                required
                disabled={isEditing}
              >
                <option value="">Select Grade</option>
                {gradeLevels.map((gl) => (
                  <option key={gl.id} value={gl.id}>
                    {gl.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label font-bold">Academic Year *</label>
              <input
                className="input text-xs"
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                required
                placeholder="2024/2025"
              />
            </div>

            <div>
              <label className="label font-bold">Unit Sequence # *</label>
              <input
                type="number"
                min="1"
                className="input text-xs"
                value={form.unitNumber}
                onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
                required
              />
            </div>
          </div>

          {curriculums.length > 0 && (
            <div>
              <label className="label font-bold">Curriculum Framework (Optional)</label>
              <select
                className="input text-xs"
                value={form.curriculumId}
                onChange={(e) => setForm({ ...form, curriculumId: e.target.value })}
              >
                <option value="">Default National / School Curriculum</option>
                {curriculums.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Unit Title & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="label font-bold">Unit Title *</label>
              <input
                className="input text-xs"
                placeholder="e.g. Unit 2: Cellular Energetics and Photosynthesis"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label font-bold">Duration (Weeks)</label>
              <input
                type="number"
                min="1"
                className="input text-xs"
                placeholder="e.g. 3"
                value={form.durationWeeks}
                onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Unit Overview & Big Ideas</label>
            <textarea
              className="input text-xs h-16"
              placeholder="Summary of core concepts, essential questions, and thematic focus..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Standards / Learning Outcomes multi-select with inline add */}
          <div className="space-y-2 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary-600" />
                Targeted Learning Outcomes / Standards ({form.standardIds.length} selected)
              </span>
              <button
                type="button"
                className="btn-ghost btn-sm text-xs text-primary-700 bg-white border border-primary-200 hover:bg-primary-50 rounded-lg inline-flex items-center gap-1 py-1"
                onClick={() => setStandardModalOpen(true)}
              >
                <Plus className="w-3 h-3" /> New Standard
              </button>
            </div>

            {availableStandards.length === 0 ? (
              <p className="text-gray-400 italic text-[11px]">
                No standards found for this subject. Click "+ New Standard" above to create one.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {availableStandards.map((st) => {
                  const isSelected = form.standardIds.includes(st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => handleToggleStandard(st.id)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2 ${
                        isSelected
                          ? "bg-primary-50 border-primary-400 text-primary-900 font-semibold"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                      />
                      <div className="leading-tight">
                        <span className="font-mono text-[10px] bg-gray-100 px-1 py-0.2 rounded mr-1">
                          {st.code}
                        </span>
                        <span>{st.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Learning Objectives List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="label font-bold mb-0">Specific Learning Objectives</label>
              <button
                type="button"
                className="btn-ghost btn-sm text-xs text-primary-600 hover:bg-primary-50 py-0.5 px-2 inline-flex items-center gap-1"
                onClick={handleAddObjective}
              >
                <Plus className="w-3 h-3" /> Add Objective
              </button>
            </div>

            <div className="space-y-2">
              {form.learningObjectives.map((obj, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="font-bold text-gray-400 w-4 text-right">{idx + 1}.</span>
                  <input
                    className="input text-xs flex-1"
                    placeholder={`e.g. Students will be able to differentiate light-dependent vs Calvin cycle reactions.`}
                    value={obj}
                    onChange={(e) => handleObjectiveChange(idx, e.target.value)}
                  />
                  {form.learningObjectives.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost text-gray-400 hover:text-red-500 p-1"
                      onClick={() => handleRemoveObjective(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Assessment Method & Assessment Strategy */}
          <div>
            <label className="label font-bold">Assessment Strategy & Evidence of Mastery</label>
            <textarea
              className="input text-xs h-16"
              placeholder="e.g. Formative quizzes, lab notebook evaluation, end-of-unit performance rubric..."
              value={form.assessmentMethod}
              onChange={(e) => setForm({ ...form, assessmentMethod: e.target.value })}
            />
          </div>

          {/* Key Resources (File attachments & URL links) */}
          <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-gray-600" />
                Key Resources & Materials ({form.keyResources.length})
              </span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  className="btn-ghost btn-sm text-xs bg-white border border-gray-200 hover:bg-gray-50 rounded-lg inline-flex items-center gap-1 py-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                >
                  <Upload className="w-3 h-3" /> {uploadingFile ? "Uploading…" : "Attach File"}
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm text-xs bg-white border border-gray-200 hover:bg-gray-50 rounded-lg inline-flex items-center gap-1 py-1"
                  onClick={() => setShowAddLink(!showAddLink)}
                >
                  <Link2 className="w-3 h-3" /> Add Link
                </button>
              </div>
            </div>

            {showAddLink && (
              <div className="p-2.5 bg-white border border-primary-200 rounded-lg space-y-2">
                <input
                  className="input text-xs"
                  placeholder="Link Title (e.g. PhET Interactive Simulation)"
                  value={resourceLinkName}
                  onChange={(e) => setResourceLinkName(e.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    className="input text-xs flex-1"
                    placeholder="https://..."
                    value={resourceLinkUrl}
                    onChange={(e) => setResourceLinkUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary btn-sm text-xs"
                    onClick={handleAddWebLink}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {form.keyResources.length > 0 && (
              <div className="space-y-1.5">
                {form.keyResources.map((res, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 text-xs"
                  >
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline truncate max-w-sm font-semibold"
                    >
                      {res.name}
                    </a>
                    <button
                      type="button"
                      className="btn-ghost text-gray-400 hover:text-red-500 p-1"
                      onClick={() => handleRemoveResource(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Change Summary when editing approved unit */}
          {isEditing && unit.status === "APPROVED" && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
              <label className="label font-bold text-amber-900">
                Revision Change Summary * (Snapshotting previous approved version)
              </label>
              <p className="text-[11px] text-amber-800">
                This unit was previously approved. Editing will preserve the previous version in history and create a new revision.
              </p>
              <input
                className="input text-xs bg-white"
                placeholder="e.g. Updated learning objectives and added lab simulation link"
                value={form.changeSummary}
                onChange={(e) => setForm({ ...form, changeSummary: e.target.value })}
                required
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Inline Standard Creation Dialog */}
      <StandardModal
        open={standardModalOpen}
        onClose={() => setStandardModalOpen(false)}
        defaultSubjectId={form.subjectId}
        defaultGradeLevelId={form.gradeLevelId}
      />
    </>
  );
}
