import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, CheckCircle, X } from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState, Pagination, Avatar } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_BADGE = { PENDING: 'yellow', CONFIRMED: 'green', CANCELLED: 'red', COMPLETED: 'blue' };

export default function MeetingsPage() {
  const { isParent, isTeacher, isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ teacherId: '', title: '', agenda: '', scheduledAt: '', duration: 30, location: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', page],
    queryFn: () => api.get(`/meetings?page=${page}&limit=10`).then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.get('/staff/teachers').then((r) => r.data.data),
    enabled: isParent(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/meetings', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meetings'] }); toast.success('Meeting request sent'); setAddOpen(false); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/meetings/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meetings'] }); toast.success('Status updated'); },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const meetings = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="page-header flex-wrap gap-3">
        <div><h1 className="page-title">Meetings</h1><p className="page-subtitle">Parent-teacher appointments</p></div>
        {isParent() && <button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Request Meeting</button>}
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="space-y-4">
          {meetings.length === 0 && <EmptyState icon={Clock} title="No meetings scheduled" description={isParent() ? 'Request a meeting with a teacher' : 'No meetings found'} />}
          {meetings.map((m) => (
            <div key={m.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={STATUS_BADGE[m.status] ?? 'gray'}>{m.status}</Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900">{m.title}</h3>
                  {m.agenda && <p className="text-sm text-gray-500 mt-1">{m.agenda}</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(m.scheduledAt), 'dd MMM yyyy, HH:mm')}</span>
                    <span>· {m.duration} mins</span>
                    {m.location && <span>· 📍 {m.location}</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Avatar name={`${m.teacher?.firstName} ${m.teacher?.lastName}`} size="sm" />
                      <span className="text-gray-600">{m.teacher?.firstName} {m.teacher?.lastName}</span>
                      <Badge variant="purple">Teacher</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Avatar name={`${m.parent?.firstName} ${m.parent?.lastName}`} size="sm" />
                      <span className="text-gray-600">{m.parent?.firstName} {m.parent?.lastName}</span>
                      <Badge variant="blue">Parent</Badge>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                {(isTeacher() || isAdmin()) && m.status === 'PENDING' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button className="btn-primary btn-sm" onClick={() => statusMutation.mutate({ id: m.id, status: 'CONFIRMED' })}>
                      <CheckCircle className="w-3 h-3" /> Confirm
                    </button>
                    <button className="btn-secondary btn-sm text-red-500" onClick={() => statusMutation.mutate({ id: m.id, status: 'CANCELLED' })}>
                      <X className="w-3 h-3" /> Decline
                    </button>
                  </div>
                )}
                {m.status === 'CONFIRMED' && (
                  <button className="btn-secondary btn-sm flex-shrink-0" onClick={() => statusMutation.mutate({ id: m.id, status: 'COMPLETED' })}>
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          ))}
          <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Request a Meeting" size="md"
        footer={<><button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn-primary" onClick={() => createMutation.mutate({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString(), duration: parseInt(form.duration) })} disabled={createMutation.isPending}>{createMutation.isPending ? 'Sending…' : 'Send Request'}</button></>}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Teacher *</label>
            <select className="input" value={form.teacherId} onChange={set('teacherId')} required>
              <option value="">— Select teacher —</option>
              {(teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}{t.teacherProfile?.specialization ? ` — ${t.teacherProfile.specialization}` : ''}</option>)}
            </select>
          </div>
          <div><label className="label">Meeting Title *</label><input className="input" value={form.title} onChange={set('title')} placeholder="Discussion about academic progress" required /></div>
          <div><label className="label">Agenda</label><textarea className="input min-h-16 resize-none" value={form.agenda} onChange={set('agenda')} placeholder="Topics to discuss…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Preferred Date & Time *</label><input className="input" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} required /></div>
            <div><label className="label">Duration (mins)</label><input className="input" type="number" value={form.duration} onChange={set('duration')} /></div>
          </div>
          <div><label className="label">Location</label><input className="input" value={form.location} onChange={set('location')} placeholder="Online / Room 102" /></div>
        </div>
      </Modal>
    </div>
  );
}
