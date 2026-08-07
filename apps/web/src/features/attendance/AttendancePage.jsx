import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarCheck, TrendingUp, AlertTriangle, Plus, Download } from 'lucide-react';
import api from '../../lib/api';
import { downloadFile } from '../../lib/downloadFile';
import StatCard from '../../components/shared/StatCard';
import AttendanceTrendChart from '../../components/charts/AttendanceTrendChart';
import PageLoader from '../../components/ui/PageLoader';
import { Badge } from '../../components/ui/index';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../lib/i18n/I18nProvider';
import toast from 'react-hot-toast';

// Phase 2 gap closed: the attendance-sheet PDF generator existed since Phase 2
// but had no endpoint or UI calling it. This panel + the new
// /attendance/class/:classId/sheet route close that gap.
function AttendanceSheetDownload() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [classId, setClassId] = useState('');
  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [downloading, setDownloading] = useState(false);

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => api.get('/academics/classes').then((r) => r.data.data) });

  const handleDownload = async () => {
    if (!classId) { toast.error(t('attendance.overview.sheet_select_class_first')); return; }
    setDownloading(true);
    try {
      await downloadFile(
        `/attendance/class/${classId}/sheet?startDate=${startDate}&endDate=${endDate}`,
        `attendance-sheet-${startDate}-to-${endDate}.pdf`,
      );
    } catch {
      toast.error(t('attendance.overview.sheet_download_error'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card card-body flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('attendance.class_label')}</label>
        <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">{t('attendance.overview.sheet_select_class_option')}</option>
          {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('attendance.overview.from_label')}</label>
        <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('attendance.overview.to_label')}</label>
        <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <button className="btn-secondary" onClick={handleDownload} disabled={downloading}>
        <Download className="w-4 h-4" /> {downloading ? t('attendance.overview.preparing') : t('attendance.overview.download_sheet_button')}
      </button>
    </div>
  );
}

export default function AttendancePage() {
  const { t } = useTranslation();
  const { isStudent, isAdmin, isTeacher } = useAuthStore();
  const isStaff = isAdmin() || isTeacher();

  const { data: myData, isLoading } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: () => api.get('/attendance/me').then((r) => r.data.data),
    enabled: isStudent(),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t('attendance.overview.title')}</h1>
          <p className="page-subtitle">{isStudent() ? t('attendance.overview.subtitle_student') : t('attendance.overview.subtitle_staff')}</p>
        </div>
        {isStaff && <Link to="/attendance/mark" className="btn-primary"><Plus className="w-4 h-4" /> {t('attendance.page_title')}</Link>}
      </div>

      {isStudent() && myData && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={CalendarCheck} label={t('attendance.overview.total_days')} value={myData.total}    color="blue" />
            <StatCard icon={TrendingUp}    label={t('attendance.present')}             value={myData.present}  color="green" />
            <StatCard icon={AlertTriangle} label={t('attendance.absent')}              value={myData.absent}   color="red" />
            <StatCard icon={CalendarCheck} label={t('attendance.overview.rate')}       value={`${myData.percentage}%`} color={myData.percentage >= 75 ? 'green' : 'red'} />
          </div>

          {myData.percentage < 75 && (
            <div className="card card-body bg-red-50 border border-red-200">
              <p className="text-red-700 text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {t('attendance.overview.below_threshold_warning')}
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-header"><h3 className="font-semibold">{t('attendance.overview.recent_records')}</h3></div>
            <div className="divide-y divide-gray-50">
              {myData.recentRecords.map((r, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{new Date(r.date).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <div className="flex items-center gap-2">
                    {r.note && <span className="text-xs text-gray-400">{r.note}</span>}
                    <Badge variant={r.status === 'PRESENT' ? 'green' : r.status === 'LATE' ? 'yellow' : r.status === 'EXCUSED' ? 'blue' : 'red'}>
                      {r.status === 'PRESENT' ? t('attendance.present') : r.status === 'LATE' ? t('attendance.late') : r.status === 'EXCUSED' ? t('attendance.excused') : t('attendance.absent')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {isStaff && (
        <>
          <AttendanceTrendChart />
          <AttendanceSheetDownload />
        </>
      )}
    </div>
  );
}
