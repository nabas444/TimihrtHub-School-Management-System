import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Pencil, Trash2, X } from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";

export default function ClassesPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [form, setForm] = useState({
    name: "",
    gradeLevelId: "",
    academicYear:
      new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
    capacity: 40,
    room: "",
  });

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
  });

  const { data: gradeLevels } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d) =>
      api.post("/academics/classes", { ...d, capacity: parseInt(d.capacity) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class created");
      setAddOpen(false);
      setForm({
        name: "",
        gradeLevelId: "",
        academicYear:
          new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
        capacity: 40,
        room: "",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d) =>
      api.patch(`/academics/classes/${selectedClass.id}`, {
        ...d,
        capacity: parseInt(d.capacity),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class updated");
      setEditOpen(false);
      setSelectedClass(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/academics/classes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class deleted");
      setSelectedClass(null);
      setDetailOpen(false);
    },
  });

  const openEdit = (klass) => {
    setSelectedClass(klass);
    setForm({
      name: klass.name,
      gradeLevelId: klass.gradeLevelId || klass.gradeLevel?.id || "",
      academicYear: klass.academicYear,
      capacity: klass.capacity,
      room: klass.room || "",
    });
    setEditOpen(true);
  };

  const openDetail = async (klass) => {
    const res = await api.get(`/academics/classes/${klass.id}`);
    setSelectedClass(res.data.data);
    setDetailOpen(true);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Classes</h1>
          <p className="page-subtitle">{classes?.length ?? 0} classes</p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes?.length === 0 && (
            <EmptyState
              icon={Users}
              title="No classes yet"
              description="Create your first class to get started"
            />
          )}
          {(classes ?? []).map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <button
                  className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-200"
                  onClick={() => openDetail(c)}
                >
                  <Users className="w-5 h-5 text-indigo-600" />
                </button>
                <div className="flex gap-2">
                  <button className="btn-ghost p-2" onClick={() => openEdit(c)}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    className="btn-ghost p-2 text-red-600"
                    onClick={() => {
                      if (confirm(`Delete class ${c.name}?`))
                        deleteMutation.mutate(c.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button onClick={() => openDetail(c)} className="text-left w-full">
                <h3 className="font-bold text-gray-900 text-lg">{c.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{c.academicYear}</p>
              </button>

              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {c._count?.students ?? 0}/{c.capacity} students
                </span>
                {c.room && <span>📍 {c.room}</span>}
              </div>
              {c.classTeacher?.length > 0 && (
                <p className="text-xs text-primary-600 mt-2 font-medium">
                  👩‍🏫 {c.classTeacher[0]?.user?.firstName}{" "}
                  {c.classTeacher[0]?.user?.lastName}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Class"
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
              {createMutation.isPending ? "Creating…" : "Create Class"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Class Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={set("name")}
              placeholder="10A, Form 3 Science…"
              required
            />
          </div>
          <div>
            <label className="label">Grade Level *</label>
            <select
              className="input"
              value={form.gradeLevelId}
              onChange={set("gradeLevelId")}
              required
            >
              <option value="">— Select grade —</option>
              {(gradeLevels ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Academic Year</label>
            <input
              className="input"
              value={form.academicYear}
              onChange={set("academicYear")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Capacity</label>
              <input
                className="input"
                type="number"
                value={form.capacity}
                onChange={set("capacity")}
              />
            </div>
            <div>
              <label className="label">Room</label>
              <input
                className="input"
                value={form.room}
                onChange={set("room")}
                placeholder="Room 201"
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Class"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => updateMutation.mutate(form)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Updating…" : "Update Class"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Class Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={set("name")}
            />
          </div>
          <div>
            <label className="label">Grade Level *</label>
            <select
              className="input"
              value={form.gradeLevelId}
              onChange={set("gradeLevelId")}
            >
              <option value="">— Select grade —</option>
              {(gradeLevels ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Academic Year</label>
            <input
              className="input"
              value={form.academicYear}
              onChange={set("academicYear")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Capacity</label>
              <input
                className="input"
                type="number"
                value={form.capacity}
                onChange={set("capacity")}
              />
            </div>
            <div>
              <label className="label">Room</label>
              <input
                className="input"
                value={form.room}
                onChange={set("room")}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selectedClass?.name ?? "Class Details"}
        size="lg"
      >
        {selectedClass && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">{selectedClass.name}</h3>
                <p className="text-sm text-gray-500">
                  {selectedClass.academicYear}
                </p>
              </div>
              <button
                className="btn-secondary"
                onClick={() => setDetailOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="bg-gray-50 rounded p-3">
                <span className="font-medium text-gray-700">Grade:</span>{" "}
                {selectedClass.gradeLevel?.name}
              </div>
              <div className="bg-gray-50 rounded p-3">
                <span className="font-medium text-gray-700">Room:</span>{" "}
                {selectedClass.room || "—"}
              </div>
              <div className="bg-gray-50 rounded p-3">
                <span className="font-medium text-gray-700">Capacity:</span>{" "}
                {selectedClass.capacity}
              </div>
              <div className="bg-gray-50 rounded p-3">
                <span className="font-medium text-gray-700">Students:</span>{" "}
                {selectedClass.students?.length ?? 0}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">
                Students in this class
              </h4>
              {selectedClass.students?.length ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedClass.students.map((student) => (
                    <div
                      key={student.user.id}
                      className="flex items-center justify-between border rounded p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {student.user.firstName} {student.user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {student.user.email}
                        </p>
                      </div>
                      <Badge variant="blue">
                        {student.user.id.slice(0, 8)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No students assigned"
                  description="This class doesn’t have any student records yet"
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
