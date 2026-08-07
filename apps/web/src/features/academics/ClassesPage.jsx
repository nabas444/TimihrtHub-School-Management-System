import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import toast from 'react-hot-toast';

export default function ClassesPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', gradeLevelId: '', academicYear: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1), capacity: 40, room: '' });

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/academics/classes').then((r) => r.data.data),
  });

  const { data: gradeLevels } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => api.get('/schools/grade-levels').then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/academics/classes', { ...d, capacity: parseInt(d.capacity) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); toast.success('Class created'); setAddOpen(false); },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Classes</h1><p className="page-subtitle">{classes?.length ?? 0} classes</p></div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> Add Class</button>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes?.length === 0 && <EmptyState icon={Users} title="No classes yet" description="Create your first class to get started" />}
          {(classes ?? []).map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <Badge variant="blue">{c.gradeLevel?.name}</Badge>
              </div>
              <h3 className="font-bold text-gray-900 text-lg">{c.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{c.academicYear}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c._count?.students ?? 0}/{c.capacity} students</span>
                {c.room && <span>📍 {c.room}</span>}
              </div>
              {c.classTeacher?.length > 0 && (
                <p className="text-xs text-primary-600 mt-2 font-medium">
                  👩‍🏫 {c.classTeacher[0]?.user?.firstName} {c.classTeacher[0]?.user?.lastName}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Class" size="sm"
        footer={<><button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn-primary" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating…' : 'Create Class'}</button></>}
      >
        <div className="space-y-4">
          <div><label className="label">Class Name *</label><input className="input" value={form.name} onChange={set('name')} placeholder="10A, Form 3 Science…" required /></div>
          <div>
            <label className="label">Grade Level *</label>
            <select className="input" value={form.gradeLevelId} onChange={set('gradeLevelId')} required>
              <option value="">— Select grade —</option>
              {(gradeLevels ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div><label className="label">Academic Year</label><input className="input" value={form.academicYear} onChange={set('academicYear')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Capacity</label><input className="input" type="number" value={form.capacity} onChange={set('capacity')} /></div>
            <div><label className="label">Room</label><input className="input" value={form.room} onChange={set('room')} placeholder="Room 201" /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
