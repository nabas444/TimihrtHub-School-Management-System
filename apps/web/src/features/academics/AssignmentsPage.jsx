import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState, Pagination } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { format, isPast } from 'date-fns';

const STATUS_BADGE = {
  PENDING:   { v: 'yellow', label: 'Pending' },
  SUBMITTED: { v: 'blue',   label: 'Submitted' },
  LATE:      { v: 'red',    label: 'Late' },
  GRADED:    { v: 'green',  label: 'Graded' },
  RETURNED:  { v: 'purple', label: 'Returned' },
};

export default function AssignmentsPage() {
  const { isStudent, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(null); // assignment obj
  const [form, setForm] = useState({ subjectId: '', termId: '', title: '', description: '', dueDate: '', totalMarks: 100, isPublished: true });
  const [submitForm, setSubmitForm] = useState({ content: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['assignments', page],
    queryFn: () => api.get(`/academics/assignments?page=${page}&limit=15`).then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: subjects } = useQuery({ queryKey: ['subjects'], queryFn: () => api.get('/academics/subjects').then((r) => r.data.data) });
  const { data: terms }    = useQuery({ queryKey: ['terms'],    queryFn: () => api.get('/academics/terms').then((r) => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/academics/assignments', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); toast.success('Assignment created'); setAddOpen(false); },
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, content }) => api.post(`/academics/assignments/${id}/submit`, { content }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments'] }); toast.success('Submitted!'); setSubmitOpen(null); },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const assignments = data?.data ?? [];
  const meta = data?.meta ?? {};
  const canCreate = isAdmin() || isTeacher();

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Assignments</h1>
          <p className="page-subtitle">{meta.total ?? 0} assignments</p>
        </div>
        {canCreate && <button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> New Assignment</button>}
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="space-y-3">
          {assignments.length === 0 && <EmptyState icon={BookOpen} title="No assignments yet" description="Create the first assignment for your class" />}
          {assignments.map((a) => {
            const overdue = isPast(new Date(a.dueDate));
            return (
              <div key={a.id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="badge-primary badge">{a.subject?.name}</span>
                    {overdue && <span className="badge-red badge"><AlertCircle className="w-3 h-3" /> Overdue</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900">{a.title}</h3>
                  {a.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Due {format(new Date(a.dueDate), 'dd MMM yyyy, HH:mm')}</span>
                    <span>· {a.totalMarks} marks</span>
                    <span>· by {a.createdBy?.firstName} {a.createdBy?.lastName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-gray-400">{a._count?.submissions ?? 0} submissions</span>
                  {isStudent() && (
                    <button className="btn-primary btn-sm" onClick={() => setSubmitOpen(a)}>
                      <CheckCircle className="w-4 h-4" /> Submit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
        </div>
      )}

      {/* Create Assignment Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Assignment" size="lg"
        footer={<>
          <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create Assignment'}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div><label className="label">Title *</label><input className="input" value={form.title} onChange={set('title')} required /></div>
          <div><label className="label">Description</label><textarea className="input min-h-20 resize-none" value={form.description} onChange={set('description')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subject *</label>
              <select className="input" value={form.subjectId} onChange={set('subjectId')} required>
                <option value="">— Select subject —</option>
                {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Term *</label>
              <select className="input" value={form.termId} onChange={set('termId')} required>
                <option value="">— Select term —</option>
                {(terms ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Due Date *</label><input className="input" type="datetime-local" value={form.dueDate} onChange={set('dueDate')} required /></div>
            <div><label className="label">Total Marks</label><input className="input" type="number" value={form.totalMarks} onChange={set('totalMarks')} /></div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} className="rounded" />
            <span className="text-sm text-gray-700">Publish immediately (notify students)</span>
          </label>
        </div>
      </Modal>

      {/* Submit Assignment Modal */}
      <Modal open={!!submitOpen} onClose={() => setSubmitOpen(null)} title={`Submit: ${submitOpen?.title}`} size="md"
        footer={<>
          <button className="btn-secondary" onClick={() => setSubmitOpen(null)}>Cancel</button>
          <button className="btn-primary" onClick={() => submitMutation.mutate({ id: submitOpen?.id, content: submitForm.content })} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? 'Submitting…' : 'Submit Assignment'}
          </button>
        </>}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Due: {submitOpen && format(new Date(submitOpen.dueDate), 'dd MMM yyyy, HH:mm')}</p>
          <div>
            <label className="label">Your answer / notes</label>
            <textarea className="input min-h-32 resize-none" value={submitForm.content} onChange={(e) => setSubmitForm({ content: e.target.value })} placeholder="Write your answer here…" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
