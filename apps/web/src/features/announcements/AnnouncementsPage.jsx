import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pin, Trash2, Megaphone } from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState, Pagination } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const TARGET_BADGE = { ALL: 'blue', STUDENTS: 'green', TEACHERS: 'purple', PARENTS: 'amber', CLASS: 'primary' };

export default function AnnouncementsPage() {
  const { isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const canPost = isAdmin() || isTeacher();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', target: 'ALL', isPinned: false });

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', page],
    queryFn: () => api.get(`/announcements?page=${page}&limit=10`).then((r) => r.data),
    keepPreviousData: true,
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/announcements', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Announcement posted'); setAddOpen(false); setForm({ title: '', content: '', target: 'ALL', isPinned: false }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/announcements/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Deleted'); },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const announcements = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="page-header">
        <div><h1 className="page-title">Announcements</h1><p className="page-subtitle">School-wide notices and updates</p></div>
        {canPost && <button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Post Announcement</button>}
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="space-y-4">
          {announcements.length === 0 && <EmptyState icon={Megaphone} title="No announcements" description="Nothing posted yet" />}
          {announcements.map((a) => (
            <div key={a.id} className={clsx('card p-5', a.isPinned && 'border-l-4 border-l-amber-400')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {a.isPinned && <span className="flex items-center gap-1 text-amber-600 text-xs font-medium"><Pin className="w-3 h-3" /> Pinned</span>}
                    <Badge variant={TARGET_BADGE[a.target] ?? 'gray'}>{a.target}</Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-base mb-1">{a.title}</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.content}</p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                    <span>By {a.author?.firstName} {a.author?.lastName}</span>
                    <span>·</span>
                    <span>{format(new Date(a.publishedAt), 'dd MMM yyyy, HH:mm')}</span>
                    {a.expiresAt && <><span>·</span><span>Expires {format(new Date(a.expiresAt), 'dd MMM')}</span></>}
                  </div>
                </div>
                {canPost && (
                  <button onClick={() => deleteMutation.mutate(a.id)} className="btn-ghost btn-icon text-gray-400 hover:text-red-500 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Announcement"
        footer={<>
          <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Posting…' : 'Post Announcement'}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div><label className="label">Title *</label><input className="input" value={form.title} onChange={set('title')} required /></div>
          <div><label className="label">Message *</label><textarea className="input min-h-28 resize-none" value={form.content} onChange={set('content')} required /></div>
          <div>
            <label className="label">Audience</label>
            <select className="input" value={form.target} onChange={set('target')}>
              {['ALL', 'STUDENTS', 'TEACHERS', 'PARENTS'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))} className="rounded" />
            <span className="text-sm">Pin this announcement</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
