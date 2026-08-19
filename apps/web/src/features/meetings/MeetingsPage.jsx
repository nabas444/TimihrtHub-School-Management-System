import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, CheckCircle, X, Users, Video, MapPin, Calendar, Filter } from 'lucide-react';
import api from '../../lib/api';
import { Badge, EmptyState, Pagination, Avatar } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  PENDING: 'yellow',
  CONFIRMED: 'green',
  CANCELLED: 'red',
  COMPLETED: 'blue',
};

export default function MeetingsPage() {
  const { isParent, isTeacher, isAdmin, user } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const [form, setForm] = useState({
    teacherId: '',
    parentId: '',
    studentId: '',
    title: '',
    agenda: '',
    scheduledAt: '',
    duration: 30,
    location: '',
    meetingLink: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', page, statusFilter],
    queryFn: () =>
      api
        .get(`/meetings?page=${page}&limit=10${statusFilter ? `&status=${statusFilter}` : ''}`)
        .then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['meeting-contacts'],
    queryFn: () => api.get('/meetings/contacts').then((r) => r.data.data),
    enabled: addOpen,
  });

  const teachers = contactsData?.teachers ?? [];
  const parents = contactsData?.parents ?? [];

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/meetings', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting request sent successfully');
      setAddOpen(false);
      setForm({
        teacherId: '',
        parentId: '',
        studentId: '',
        title: '',
        agenda: '',
        scheduledAt: '',
        duration: 30,
        location: '',
        meetingLink: '',
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to send meeting request');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }) => api.patch(`/meetings/${id}/status`, { status, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting status updated');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update meeting status');
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const meetings = data?.data ?? [];
  const meta = data?.meta ?? {};

  const handleParentSelectChange = (e) => {
    const parentId = e.target.value;
    const selectedContact = parents.find((p) => p.parentId === parentId);
    setForm((f) => ({
      ...f,
      parentId,
      studentId: selectedContact?.studentId || '',
    }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-600" />
            Parent-Teacher Meetings
          </h1>
          <p className="page-subtitle">Schedule, manage, and attend parent-teacher conferences and academic consultations.</p>
        </div>
        <button className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" />
          {isTeacher() ? 'Schedule Meeting with Parent' : isParent() ? 'Request Meeting with Teacher' : 'Schedule Meeting'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: '', label: 'All Meetings' },
          { key: 'PENDING', label: 'Pending Requests' },
          { key: 'CONFIRMED', label: 'Confirmed' },
          { key: 'COMPLETED', label: 'Completed' },
          { key: 'CANCELLED', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          {meetings.length === 0 && (
            <EmptyState
              icon={Clock}
              title="No meetings found"
              description={
                isTeacher()
                  ? 'You have no scheduled meetings with parents. Click the button above to request one.'
                  : isParent()
                  ? 'You have no scheduled meetings. Request an appointment with your child’s teachers.'
                  : 'No meetings scheduled in the school.'
              }
            />
          )}

          {meetings.map((m) => {
            const isUserTeacher = user?.id === m.teacher?.id;
            const isUserParent = user?.id === m.parent?.id;
            const canRespond = (isTeacher() && isUserTeacher) || (isParent() && isUserParent) || isAdmin();

            return (
              <div key={m.id} className="card p-5 hover:border-gray-300 transition-all">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={STATUS_BADGE[m.status] ?? 'gray'}>{m.status}</Badge>
                      <span className="text-xs text-gray-400 font-mono">
                        ID: {m.id.substring(0, 8)}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-gray-900 leading-snug">{m.title}</h3>
                    {m.agenda && <p className="text-sm text-gray-600">{m.agenda}</p>}

                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-1">
                      <span className="flex items-center gap-1 font-mono font-medium text-gray-800">
                        <Clock className="w-3.5 h-3.5 text-primary-600" />
                        {format(new Date(m.scheduledAt), 'EEEE, dd MMM yyyy · HH:mm')}
                      </span>
                      <span>⏱️ {m.duration} mins</span>
                      {m.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" /> {m.location}
                        </span>
                      )}
                      {m.meetingLink && (
                        <a
                          href={m.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-primary-600 hover:underline font-semibold"
                        >
                          <Video className="w-3.5 h-3.5" /> Join Video Call
                        </a>
                      )}
                    </div>

                    {/* Participants Bar */}
                    <div className="flex items-center gap-6 pt-3 mt-2 border-t border-gray-100 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <Avatar name={`${m.teacher?.firstName} ${m.teacher?.lastName}`} size="sm" />
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase">Teacher</span>
                          <span className="font-semibold text-gray-900">
                            {m.teacher?.firstName} {m.teacher?.lastName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Avatar name={`${m.parent?.firstName} ${m.parent?.lastName}`} size="sm" />
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase">Parent / Guardian</span>
                          <span className="font-semibold text-gray-900">
                            {m.parent?.firstName} {m.parent?.lastName}
                          </span>
                          {m.parent?.phone && (
                            <span className="text-gray-400 text-[11px] ml-1 font-mono">
                              ({m.parent.phone})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
                    {canRespond && m.status === 'PENDING' && (
                      <>
                        <button
                          className="btn-primary btn-sm inline-flex items-center gap-1"
                          onClick={() => statusMutation.mutate({ id: m.id, status: 'CONFIRMED' })}
                          disabled={statusMutation.isPending}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Confirm
                        </button>
                        <button
                          className="btn-secondary btn-sm text-red-600 inline-flex items-center gap-1"
                          onClick={() => statusMutation.mutate({ id: m.id, status: 'CANCELLED' })}
                          disabled={statusMutation.isPending}
                        >
                          <X className="w-3.5 h-3.5" /> Decline
                        </button>
                      </>
                    )}

                    {canRespond && m.status === 'CONFIRMED' && (
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => statusMutation.mutate({ id: m.id, status: 'COMPLETED' })}
                        disabled={statusMutation.isPending}
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
        </div>
      )}

      {/* ── Request Meeting Modal ── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={
          isTeacher()
            ? 'Schedule Meeting with a Parent'
            : isParent()
            ? 'Request Meeting with a Teacher'
            : 'Schedule Academic Meeting'
        }
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  scheduledAt: new Date(form.scheduledAt).toISOString(),
                  duration: parseInt(form.duration),
                })
              }
              disabled={
                createMutation.isPending ||
                !form.title ||
                !form.scheduledAt ||
                (isParent() && !form.teacherId) ||
                (isTeacher() && !form.parentId)
              }
            >
              {createMutation.isPending ? 'Sending…' : 'Send Request'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* If Parent: Select Teacher */}
          {isParent() && (
            <div>
              <label className="label">Select Teacher *</label>
              <select className="input" value={form.teacherId} onChange={set('teacherId')} required>
                <option value="">— Select Teacher —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.roleDescription ? `(${t.roleDescription})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* If Teacher: Select Parent & Student */}
          {isTeacher() && (
            <div>
              <label className="label">Select Parent / Student *</label>
              <select
                className="input"
                value={form.parentId}
                onChange={handleParentSelectChange}
                required
              >
                <option value="">— Select Parent & Student —</option>
                {parents.map((p, idx) => (
                  <option key={`${p.parentId}-${p.studentId || idx}`} value={p.parentId}>
                    {p.parentName} {p.studentName ? `(Parent of ${p.studentName} — ${p.className})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* If Admin: Select both Teacher and Parent */}
          {isAdmin() && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Teacher *</label>
                <select className="input" value={form.teacherId} onChange={set('teacherId')} required>
                  <option value="">— Select Teacher —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Parent *</label>
                <select
                  className="input"
                  value={form.parentId}
                  onChange={handleParentSelectChange}
                  required
                >
                  <option value="">— Select Parent —</option>
                  {parents.map((p, idx) => (
                    <option key={`${p.parentId}-${idx}`} value={p.parentId}>
                      {p.parentName} {p.studentName ? `(${p.studentName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="label">Meeting Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Academic Progress Review, Term 1 Performance Discussion"
              required
            />
          </div>

          <div>
            <label className="label">Agenda / Topics to Discuss</label>
            <textarea
              className="input min-h-20 resize-none text-xs"
              value={form.agenda}
              onChange={set('agenda')}
              placeholder="Provide a brief summary of points to address during the consultation…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Meeting Date & Time *</label>
              <input
                className="input"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={set('scheduledAt')}
                required
              />
            </div>
            <div>
              <label className="label">Duration (minutes)</label>
              <select className="input" value={form.duration} onChange={set('duration')}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes (1 hour)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Location / Room (Optional)</label>
              <input
                className="input"
                value={form.location}
                onChange={set('location')}
                placeholder="e.g. Staff Room 2, Office 101, Online"
              />
            </div>
            <div>
              <label className="label">Virtual Meeting Link (Optional)</label>
              <input
                className="input font-mono text-xs"
                value={form.meetingLink}
                onChange={set('meetingLink')}
                placeholder="https://meet.google.com/xyz or Zoom"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

