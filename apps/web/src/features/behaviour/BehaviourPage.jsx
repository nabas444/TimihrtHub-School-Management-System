import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertTriangle, Star, Shield } from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState, Pagination, Avatar } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TYPE_BADGE = { MERIT: 'green', COMMENDATION: 'green', DEMERIT: 'red', WARNING: 'yellow', INCIDENT: 'red', SUSPENSION: 'red' };
const TYPE_ICON  = { MERIT: Star, COMMENDATION: Star, DEMERIT: AlertTriangle, WARNING: AlertTriangle, INCIDENT: Shield, SUSPENSION: Shield };

export default function BehaviourPage() {
  const { user, isAdmin, isTeacher, isStudent, isParent } = useAuthStore();
  const qc = useQueryClient();
  const canReport = isAdmin() || isTeacher();
  const canViewAll = isAdmin() || isTeacher();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ studentId: '', type: 'MERIT', severity: 'LOW', title: '', description: '', points: 0, date: new Date().toISOString().split('T')[0] });

  const { data, isLoading } = useQuery({
    queryKey: ['behaviour', page],
    queryFn: () => api.get(`/behaviour?page=${page}&limit=15`).then((r) => r.data),
    keepPreviousData: true,
    enabled: canViewAll,
  });

  // Students see their own summary — the school-wide list endpoint is staff-only.
  // Parents don't yet have a "which of my children" selector here, so they're
  // pointed at each child's profile page (StudentDetailPage) instead, which
  // already surfaces this same summary endpoint.
  const { data: ownSummary, isLoading: ownSummaryLoading } = useQuery({
    queryKey: ['behaviour-summary', user?.id],
    queryFn: () => api.get(`/behaviour/student/${user.id}/summary`).then((r) => r.data.data),
    enabled: isStudent() && !!user?.id,
  });

  const { data: students } = useQuery({
    queryKey: ['users', 'STUDENT'],
    queryFn: () => api.get('/users?role=STUDENT&limit=200').then((r) => r.data.data),
    enabled: canReport,
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/behaviour', { ...d, date: new Date(d.date).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['behaviour'] }); toast.success('Record added'); setAddOpen(false); },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const records = data?.data ?? [];
  const meta = data?.meta ?? {};

  if (isParent()) {
    return (
      <div className="space-y-6">
        <div className="page-header"><div><h1 className="page-title">Behaviour Records</h1><p className="page-subtitle">Merits, demerits, and incidents</p></div></div>
        <EmptyState icon={Shield} title="View by child" description="Open a child's profile to see their behaviour record." />
      </div>
    );
  }

  if (isStudent()) {
    return (
      <div className="space-y-6">
        <div className="page-header"><div><h1 className="page-title">Behaviour Records</h1><p className="page-subtitle">Your merits, demerits, and incidents</p></div></div>
        {ownSummaryLoading ? <PageLoader /> : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="card card-body text-center"><p className="text-2xl font-bold text-green-600">{ownSummary?.merits ?? 0}</p><p className="text-xs text-gray-500 mt-1">Merits</p></div>
              <div className="card card-body text-center"><p className="text-2xl font-bold text-red-600">{ownSummary?.demerits ?? 0}</p><p className="text-xs text-gray-500 mt-1">Demerits</p></div>
              <div className="card card-body text-center"><p className="text-2xl font-bold text-gray-900">{ownSummary?.totalPoints ?? 0}</p><p className="text-xs text-gray-500 mt-1">Total Points</p></div>
            </div>
            <div className="space-y-3">
              {(ownSummary?.recent ?? []).length === 0 && <EmptyState icon={Shield} title="No behaviour records" description="Records will appear here" />}
              {(ownSummary?.recent ?? []).map((r) => {
                const Icon = TYPE_ICON[r.type] ?? AlertTriangle;
                return (
                  <div key={r.id} className="card p-5 flex gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${r.type === 'MERIT' || r.type === 'COMMENDATION' ? 'bg-green-100' : 'bg-red-100'}`}>
                      <Icon className={`w-5 h-5 ${r.type === 'MERIT' || r.type === 'COMMENDATION' ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={TYPE_BADGE[r.type] ?? 'gray'}>{r.type}</Badge>
                        <Badge variant={r.severity === 'LOW' ? 'gray' : r.severity === 'MEDIUM' ? 'yellow' : 'red'}>{r.severity}</Badge>
                      </div>
                      <h3 className="font-semibold text-gray-900">{r.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>{format(new Date(r.date), 'dd MMM yyyy')}</span>
                        <span>· by {r.reportedBy?.firstName} {r.reportedBy?.lastName}</span>
                        {r.points !== 0 && <span className={r.points > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{r.points > 0 ? `+${r.points}` : r.points} pts</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <div><h1 className="page-title">Behaviour Records</h1><p className="page-subtitle">Merits, demerits, and incidents</p></div>
        {canReport && <button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Add Record</button>}
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="space-y-3">
          {records.length === 0 && <EmptyState icon={Shield} title="No behaviour records" description="Records will appear here" />}
          {records.map((r) => {
            const Icon = TYPE_ICON[r.type] ?? AlertTriangle;
            return (
              <div key={r.id} className="card p-5 flex gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${r.type === 'MERIT' || r.type === 'COMMENDATION' ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Icon className={`w-5 h-5 ${r.type === 'MERIT' || r.type === 'COMMENDATION' ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={TYPE_BADGE[r.type] ?? 'gray'}>{r.type}</Badge>
                    <Badge variant={r.severity === 'LOW' ? 'gray' : r.severity === 'MEDIUM' ? 'yellow' : 'red'}>{r.severity}</Badge>
                    {r.isResolved && <Badge variant="green">Resolved</Badge>}
                  </div>
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Avatar name={`${r.student?.firstName} ${r.student?.lastName}`} size="sm" />
                      {r.student?.firstName} {r.student?.lastName}
                    </span>
                    <span>· {format(new Date(r.date), 'dd MMM yyyy')}</span>
                    <span>· by {r.reportedBy?.firstName} {r.reportedBy?.lastName}</span>
                    {r.points !== 0 && <span className={r.points > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{r.points > 0 ? `+${r.points}` : r.points} pts</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Behaviour Record"
        footer={<>
          <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving…' : 'Save Record'}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Student *</label>
            <select className="input" value={form.studentId} onChange={set('studentId')} required>
              <option value="">— Select student —</option>
              {(students ?? []).map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={set('type')}>
                {['MERIT', 'COMMENDATION', 'DEMERIT', 'WARNING', 'INCIDENT', 'SUSPENSION'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Severity</label>
              <select className="input" value={form.severity} onChange={set('severity')}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Title *</label><input className="input" value={form.title} onChange={set('title')} required /></div>
          <div><label className="label">Description *</label><textarea className="input min-h-20 resize-none" value={form.description} onChange={set('description')} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Points</label><input className="input" type="number" value={form.points} onChange={set('points')} /></div>
            <div><label className="label">Date</label><input className="input" type="date" value={form.date} onChange={set('date')} /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
