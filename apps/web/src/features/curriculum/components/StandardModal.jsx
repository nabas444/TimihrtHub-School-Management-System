import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, BookOpen } from "lucide-react";
import api from "../../../lib/api";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";

export default function StandardModal({ open, onClose, standard, defaultSubjectId, defaultGradeLevelId }) {
  const qc = useQueryClient();
  const isEditing = !!standard;

  const [form, setForm] = useState({
    subjectId: defaultSubjectId || "",
    gradeLevelId: defaultGradeLevelId || "",
    curriculumId: "",
    code: "",
    title: "",
    description: "",
    category: "",
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

  useEffect(() => {
    if (standard) {
      setForm({
        subjectId: standard.subjectId || standard.subject?.id || defaultSubjectId || "",
        gradeLevelId: standard.gradeLevelId || defaultGradeLevelId || "",
        curriculumId: standard.curriculumId || "",
        code: standard.code || "",
        title: standard.title || "",
        description: standard.description || "",
        category: standard.category || "",
      });
    } else {
      setForm({
        subjectId: defaultSubjectId || "",
        gradeLevelId: defaultGradeLevelId || "",
        curriculumId: "",
        code: "",
        title: "",
        description: "",
        category: "",
      });
    }
  }, [standard, defaultSubjectId, defaultGradeLevelId, open]);

  const saveMutation = useMutation({
    mutationFn: (data) =>
      isEditing
        ? api.patch(`/curriculum/standards/${standard.id}`, data)
        : api.post("/curriculum/standards", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["curriculum-standards"] });
      toast.success(isEditing ? "Standard updated" : "Standard created");
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save learning standard");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.subjectId || !form.code.trim() || !form.title.trim()) {
      toast.error("Subject, Code, and Title are required");
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Learning Standard / Outcome" : "New Learning Standard / Outcome"}
      size="md"
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
            {saveMutation.isPending ? "Saving…" : isEditing ? "Update Standard" : "Save Standard"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label font-bold">Subject *</label>
            <select
              className="input text-xs"
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              required
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
            <label className="label font-bold">Grade Level (Optional)</label>
            <select
              className="input text-xs"
              value={form.gradeLevelId}
              onChange={(e) => setForm({ ...form, gradeLevelId: e.target.value })}
            >
              <option value="">All / Scoped to Subject</option>
              {gradeLevels.map((gl) => (
                <option key={gl.id} value={gl.id}>
                  {gl.name} (Level {gl.level})
                </option>
              ))}
            </select>
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
              <option value="">Default / School-Wide</option>
              {curriculums.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.value}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label font-bold">Standard Code *</label>
            <input
              className="input text-xs font-mono"
              placeholder="e.g. SC8.1, MATH.G9.01"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label font-bold">Category / Strand</label>
            <input
              className="input text-xs"
              placeholder="e.g. Earth & Space Sciences, Algebra"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label font-bold">Standard Title / Outcome Statement *</label>
          <input
            className="input text-xs"
            placeholder="e.g. Explain the water cycle and precipitation patterns"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label font-bold">Detailed Description / Criteria</label>
          <textarea
            className="input text-xs h-20"
            placeholder="Detailed benchmark performance indicators, competencies, and expectations..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
