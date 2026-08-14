import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen, Users } from "lucide-react";
import { Trash2 } from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";

export function SubjectsPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    creditHours: 3,
    isCore: true,
  });

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api.get("/academics/subjects").then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post("/academics/subjects", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject created");
      setAddOpen(false);
      setForm({
        name: "",
        code: "",
        description: "",
        creditHours: 3,
        isCore: true,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/academics/subjects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject deleted");
    },
  });

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects?.length ?? 0} subjects</p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" /> Add Subject
        </button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects?.length === 0 && (
            <EmptyState icon={BookOpen} title="No subjects yet" />
          )}
          {(subjects ?? []).map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex gap-1 items-center">
                  {s.isCore && <Badge variant="primary">Core</Badge>}
                  <Badge variant="gray">{s.creditHours} cr</Badge>
                  <button
                    className="btn-ghost p-2 text-red-600"
                    onClick={() => {
                      if (confirm(`Delete subject ${s.name}?`))
                        deleteMutation.mutate(s.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900">{s.name}</h3>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{s.code}</p>
              {s.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                  {s.description}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-3">
                {s.teachings?.length ?? 0} classes teaching this
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Subject"
        size="sm"
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
              {createMutation.isPending ? "Creating…" : "Create"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Subject Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={set("name")}
              required
            />
          </div>
          <div>
            <label className="label">Code *</label>
            <input
              className="input"
              value={form.code}
              onChange={set("code")}
              placeholder="MATH10"
              required
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-16 resize-none"
              value={form.description}
              onChange={set("description")}
            />
          </div>
          <div>
            <label className="label">Credit Hours</label>
            <input
              className="input"
              type="number"
              value={form.creditHours}
              onChange={set("creditHours")}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isCore}
              onChange={set("isCore")}
              className="rounded"
            />
            <span className="text-sm">Core subject</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}

export default SubjectsPage;
