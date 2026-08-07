import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, Save } from 'lucide-react';
import api from '../../lib/api';
import { queueWrite } from '../../lib/offlineQueue';
import { Avatar } from '../../components/ui/index';
import PageLoader from '../../components/ui/PageLoader';
import { useTranslation } from '../../lib/i18n/I18nProvider';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const STATUS_KEY = { PRESENT: 'attendance.present', ABSENT: 'attendance.absent', LATE: 'attendance.late', EXCUSED: 'attendance.excused' };
const STATUS_STYLE = {
  PRESENT: 'bg-green-100 text-green-700 border-green-300',
  ABSENT:  'bg-red-100 text-red-700 border-red-300',
  LATE:    'bg-yellow-100 text-yellow-700 border-yellow-300',
  EXCUSED: 'bg-gray-100 text-gray-600 border-gray-300',
};

export default function AttendanceMarkPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [classId, setClassId] = useState('');
  const [termId, setTermId]   = useState('');
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState({});

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/academics/classes').then((r) => r.data.data) });
  const { data: terms }   = useQuery({ queryKey: ['terms'],   queryFn: () => api.get('/academics/terms').then((r)  => r.data.data) });

  const { data: students, isLoading } = useQuery({
    queryKey: ['students-for-class', classId],
    queryFn: () => api.get(`/users?role=STUDENT&limit=200`).then((r) => r.data.data.filter((s) => s.studentProfile?.classId === classId)),
    enabled: !!classId,
  });

  // Init all to PRESENT when students load
  // (Fixed 2026-08-01: this was `useState(() => {...})`, which runs the
  // initializer once and never again — students loading async after mount
  // meant the callback never actually fired. useEffect is what was intended.)
  useEffect(() => {
    if (students) {
      const init = {};
      students.forEach((s) => { init[s.id] = 'PRESENT'; });
      setRecords(init);
    }
  }, [students]);

  const markAll = (status) => {
    const all = {};
    (students ?? []).forEach((s) => { all[s.id] = status; });
    setRecords(all);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        classId, termId,
        date: new Date(date).toISOString(),
        records: Object.entries(records).map(([studentId, status]) => ({ studentId, status })),
      };
      // Offline-first (requirement doc: "teachers can mark attendance ...
      // even without active internet, automatically synchronizing data when
      // connectivity is restored"). Check navigator.onLine first to skip a
      // guaranteed-to-fail network round trip; also fall back to queueing on
      // any network-level failure (no response at all), since a flaky
      // connection can drop offline between the check and the request.
      if (!navigator.onLine) {
        await queueWrite({ url: '/attendance', method: 'post', body: payload, description: `Attendance for ${date}` });
        return { queued: true };
      }
      try {
        return await api.post('/attendance', payload);
      } catch (err) {
        if (!err.response) { // network error, not a server rejection — genuinely offline/unreachable
          await queueWrite({ url: '/attendance', method: 'post', body: payload, description: `Attendance for ${date}` });
          return { queued: true };
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      if (result?.queued) {
        toast.success(t('attendance.saved_offline_toast'));
      } else {
        toast.success(t('attendance.saved_toast'));
      }
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('attendance.page_title')}</h1>
          <p className="page-subtitle">{t('attendance.page_subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">{t('attendance.class_label')}</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">{t('attendance.select_class')}</option>
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('attendance.term_label')}</label>
            <select className="input" value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">{t('attendance.select_term')}</option>
              {(terms ?? []).map((term) => <option key={term.id} value={term.id}>{term.name} {term.isCurrent ? '(Current)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('attendance.date_label')}</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {classId && students?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 mr-1">{t('attendance.mark_all')}</span>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => markAll(s)} className={clsx('btn-sm btn border', STATUS_STYLE[s])}>
              {s === 'PRESENT' && <CheckCircle className="w-3 h-3" />}
              {s === 'ABSENT'  && <XCircle className="w-3 h-3" />}
              {s === 'LATE'    && <Clock className="w-3 h-3" />}
              {t(STATUS_KEY[s])}
            </button>
          ))}
        </div>
      )}

      {/* Student list */}
      {!classId && <div className="card card-body text-center text-gray-400 py-12">{t('attendance.select_class_prompt')}</div>}
      {classId && isLoading && <PageLoader />}
      {classId && !isLoading && students?.length === 0 && <div className="card card-body text-center text-gray-400">{t('attendance.no_students')}</div>}

      {students?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>#</th><th>{t('fees.student_col')}</th>{STATUSES.map((s) => <th key={s} className="text-center">{t(STATUS_KEY[s])}</th>)}</tr></thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-gray-400 text-sm">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={`${s.firstName} ${s.lastName}`} size="sm" />
                        <span className="font-medium text-sm">{s.firstName} {s.lastName}</span>
                      </div>
                    </td>
                    {STATUSES.map((status) => (
                      <td key={status} className="text-center">
                        <input
                          type="radio"
                          name={`status-${s.id}`}
                          checked={records[s.id] === status}
                          onChange={() => setRecords((r) => ({ ...r, [s.id]: status }))}
                          className="accent-primary-600 w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-500">
              {t('attendance.present')}: {Object.values(records).filter((v) => v === 'PRESENT').length} ·
              {t('attendance.absent')}: {Object.values(records).filter((v) => v === 'ABSENT').length} ·
              {t('attendance.late')}: {Object.values(records).filter((v) => v === 'LATE').length}
            </span>
            <button className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !termId}>
              <Save className="w-4 h-4" /> {saveMutation.isPending ? t('attendance.saving') : t('attendance.save_button')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
