import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState, Pagination } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_BADGE = { PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red', CANCELLED: 'gray' };

export default function LeavePage() {
  const { isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ type: 'SICK', startDate: '', endDate: '', reason: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', page],
    queryFn: () => api.get(`/staff/leave?page=${page}&limit=10`).then((r) => r.data),
    keepPreviousData: true,
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/staff/leave', { ...d, startDate: new Date(d.startDate).toISOString(), endDate: new Date(d.endDate).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Leave request submitted'); setAddOpen(false); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/staff/leave/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Status updated'); },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const leaves = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="page-header flex-wrap gap-3">
        <div><h1 className="page-title">Leave Requests</h1></div>
        {isTeacher() && <button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Request Leave</button>}
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="space-y-3">
          {leaves.length === 0 && <EmptyState title="No leave requests" description="Submit a leave request to get started" />}
          {leaves.map((l) => (
            <div key={l.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={STATUS_BADGE[l.status] ?? 'gray'}>{l.status}</Badge>
                    <Badge variant="blue">{l.type.replace('_', ' ')}</Badge>
                  </div>
                  {l.teacherProfile && (
                    <p className="text-sm font-medium text-gray-900">{l.teacherProfile.user.firstName} {l.teacherProfile.user.lastName}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">{l.reason}</p>
                  <p className="text-xs text-gray-400 mt-2">{format(new Date(l.startDate), 'dd MMM yyyy')} → {format(new Date(l.endDate), 'dd MMM yyyy')}</p>
                </div>
                {isAdmin() && l.status === 'PENDING' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button className="btn-primary btn-sm" onClick={() => statusMutation.mutate({ id: l.id, status: 'APPROVED' })}>Approve</button>
                    <button className="btn-danger btn-sm" onClick={() => statusMutation.mutate({ id: l.id, status: 'REJECTED' })}>Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Request Leave" size="sm"
        footer={<><button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Sending…' : 'Submit Request'}</button></>}
      >
        <div className="space-y-4">
          <div><label className="label">Leave Type</label><select className="input" value={form.type} onChange={set('type')}>{['SICK','ANNUAL','MATERNITY','UNPAID'].map((t) => <option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start Date *</label><input className="input" type="datetime-local" value={form.startDate} onChange={set('startDate')} required /></div>
            <div><label className="label">End Date *</label><input className="input" type="datetime-local" value={form.endDate} onChange={set('endDate')} required /></div>
          </div>
          <div><label className="label">Reason *</label><textarea className="input min-h-24 resize-none" value={form.reason} onChange={set('reason')} required /></div>
        </div>
      </Modal>
    </div>
  );
}
