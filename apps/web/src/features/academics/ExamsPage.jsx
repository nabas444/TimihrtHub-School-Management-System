import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, CheckSquare } from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState, Pagination } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ExamsPage() {
  const { isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const canCreate = isAdmin() || isTeacher();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: '', termId: '', title: '', examType: 'MID_TERM', totalMarks: 100, passingMarks: 50, duration: 120, scheduledAt: '', venue: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['exams', page],
    queryFn: () => api.get(`/academics/exams?page=${page}&limit=15`).then((r) => r.data),
    keepPreviousData: true,
  });
  const { data: subjects } = useQuery({ queryKey: ['subjects'], queryFn: () => api.get('/academics/subjects').then((r) => r.data.data) });
  const { data: terms }    = useQuery({ queryKey: ['terms'],    queryFn: () => api.get('/academics/terms').then((r) => r.data.data) });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/academics/exams', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exams'] }); toast.success('Exam created'); setAddOpen(false); },
  });

  const publishMutation = useMutation({
    mutationFn: (id) => api.patch(`/academics/exams/${id}/publish`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exams'] }); toast.success('Exam published & students notified'); },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const exams = data?.data ?? [];
  const meta  = data?.meta ?? {};

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <div><h1 className="page-title">Exams</h1><p className="page-subtitle">{meta.total ?? 0} exams scheduled</p></div>
        {canCreate && <button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Schedule Exam</button>}
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="space-y-3">
          {exams.length === 0 && <EmptyState icon={CheckSquare} title="No exams scheduled" />}
          {exams.map((e) => (
            <div key={e.id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="primary">{e.subject?.name}</Badge>
                  <Badge variant="blue">{e.examType?.replace('_', ' ')}</Badge>
                  {!e.isPublished && <Badge variant="yellow">Draft</Badge>}
                  {e.isPublished && <Badge variant="green">Published</Badge>}
                </div>
                <h3 className="font-semibold text-gray-900">{e.title}</h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(e.scheduledAt), 'dd MMM yyyy, HH:mm')}</span>
                  <span>· {e.duration} mins</span>
                  <span>· {e.totalMarks} marks</span>
                  {e.venue && <span>· {e.venue}</span>}
                  {e.class && <span>· {e.class.name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-sm text-gray-400">
                <span>{e._count?.results ?? 0} results</span>
                {canCreate && !e.isPublished && (
                  <button className="btn-primary btn-sm" onClick={() => publishMutation.mutate(e.id)}>Publish</button>
                )}
              </div>
            </div>
          ))}
          <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Schedule Exam" size="lg"
        footer={<><button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating…' : 'Create Exam'}</button></>}
      >
        <div className="space-y-4">
          <div><label className="label">Title *</label><input className="input" value={form.title} onChange={set('title')} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Subject *</label><select className="input" value={form.subjectId} onChange={set('subjectId')} required><option value="">— Select —</option>{(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="label">Term *</label><select className="input" value={form.termId} onChange={set('termId')} required><option value="">— Select —</option>{(terms ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Exam Type</label><select className="input" value={form.examType} onChange={set('examType')}>{['QUIZ','MID_TERM','FINAL','MOCK'].map((t) => <option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
            <div><label className="label">Scheduled Date *</label><input className="input" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} required /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Total Marks</label><input className="input" type="number" value={form.totalMarks} onChange={set('totalMarks')} /></div>
            <div><label className="label">Passing Marks</label><input className="input" type="number" value={form.passingMarks} onChange={set('passingMarks')} /></div>
            <div><label className="label">Duration (mins)</label><input className="input" type="number" value={form.duration} onChange={set('duration')} /></div>
          </div>
          <div><label className="label">Venue</label><input className="input" value={form.venue} onChange={set('venue')} placeholder="Room 101 / Hall A" /></div>
        </div>
      </Modal>
    </div>
  );
}
