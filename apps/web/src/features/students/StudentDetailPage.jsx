import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { downloadFile } from '../../lib/downloadFile';
import { Avatar, Badge } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import GradesBarChart from '../../components/charts/GradesBarChart';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  CalendarCheck,
  AlertTriangle,
  CreditCard,
  Download,
  Printer,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  RotateCw,
  CheckCircle2,
} from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function StudentDetailPage() {
  const { id } = useParams();
  const [previewCardOpen, setPreviewCardOpen] = useState(false);
  const [cardSide, setCardSide] = useState('front'); // 'front' | 'back'
  const [downloading, setDownloading] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/users/${id}`).then((r) => r.data.data),
  });

  const { data: attendance } = useQuery({
    queryKey: ['attendance', id],
    queryFn: () => api.get(`/attendance/student/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: results } = useQuery({
    queryKey: ['results', id],
    queryFn: () => api.get(`/academics/results/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: behaviour } = useQuery({
    queryKey: ['behaviour-summary', id],
    queryFn: () => api.get(`/behaviour/student/${id}/summary`).then((r) => r.data.data),
    enabled: !!id,
  });

  const handleDownloadIdCard = async () => {
    try {
      setDownloading(true);
      await downloadFile(`/users/${id}/id-card`, `id-card-${sp?.admissionNumber ?? id}.pdf`);
      toast.success('ID card downloaded successfully');
    } catch (err) {
      toast.error('Could not generate ID card');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  if (isLoading) return <PageLoader />;
  if (!user) return <div className="text-center text-gray-400 py-16">Student not found</div>;

  const sp = user.studentProfile;
  const currentYear = new Date().getFullYear();
  const academicSession = `${currentYear} - ${currentYear + 1}`;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Top Navigation & Action Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/students"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Student Directory
        </Link>

        <div className="flex items-center gap-2">
          <button
            className="btn-secondary text-xs inline-flex items-center gap-1.5 shadow-xs"
            onClick={() => setPreviewCardOpen(true)}
          >
            <CreditCard className="w-4 h-4 text-primary-600" /> Preview ID Card
          </button>

          <button
            className="btn-primary text-xs inline-flex items-center gap-1.5 shadow-sm"
            onClick={handleDownloadIdCard}
            disabled={downloading}
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Generating PDF…' : 'Download ID Card'}
          </button>
        </div>
      </div>

      {/* ── Profile Header Card ────────────────────────────────────────────── */}
      <div className="card p-6 flex flex-col sm:flex-row gap-6 items-start bg-white border border-gray-200 shadow-xs">
        <Avatar name={`${user.firstName} ${user.lastName}`} src={user.avatar} size="xl" className="shadow-xs" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              {user.firstName} {user.lastName}
            </h1>
            <Badge variant={user.isActive ? 'green' : 'red'}>
              {user.isActive ? 'Active Account' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-gray-500 font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded border border-gray-200 inline-block">
            {sp?.admissionNumber || 'No Admission Number'}
          </p>

          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              {user.email}
            </span>
            {user.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                {user.phone}
              </span>
            )}
            {user.dateOfBirth && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {format(new Date(user.dateOfBirth), 'dd MMM yyyy')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {sp?.class && <Badge variant="blue">Class: {sp.class.name}</Badge>}
            {sp?.class?.gradeLevel ? (
              <Badge variant="purple">{sp.class.gradeLevel.name}</Badge>
            ) : sp?.gradeLevel ? (
              <Badge variant="purple">{sp.gradeLevel.name}</Badge>
            ) : null}
            {sp?.rollNumber && <Badge variant="gray">Roll: {sp.rollNumber}</Badge>}
            {user.gender && <Badge variant="gray">{user.gender === 'MALE' ? 'Male 👦' : 'Female 👧'}</Badge>}
          </div>
        </div>
      </div>

      {/* ── Key Academic Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CalendarCheck}
          label="Attendance Rate"
          value={`${attendance?.percentage ?? 0}%`}
          color={attendance?.percentage >= 75 ? 'green' : 'red'}
        />
        <StatCard
          icon={BookOpen}
          label="Exams Taken"
          value={results?.examResults?.length ?? 0}
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label="Behaviour Points"
          value={behaviour?.totalPoints ?? 0}
          color={behaviour?.totalPoints >= 0 ? 'green' : 'red'}
        />
        <StatCard
          icon={BookOpen}
          label="Assignments Done"
          value={results?.submissionResults?.filter((s) => s.status === 'GRADED').length ?? 0}
          color="purple"
        />
      </div>

      {/* ── Exam Performance Chart ─────────────────────────────────────────── */}
      {results?.examResults?.length > 0 && (
        <div className="card bg-white border border-gray-200">
          <div className="card-header border-b border-gray-100">
            <h3 className="font-extrabold text-sm text-gray-900">Exam Performance History</h3>
          </div>
          <div className="card-body">
            <GradesBarChart
              results={results.examResults.map((r) => ({
                exam: r.exam,
                marksObtained: r.marksObtained,
              }))}
            />
          </div>
        </div>
      )}

      {/* ── Parents / Guardians List ───────────────────────────────────────── */}
      {sp?.parentLinks?.length > 0 && (
        <div className="card bg-white border border-gray-200">
          <div className="card-header border-b border-gray-100">
            <h3 className="font-extrabold text-sm text-gray-900">Parent / Guardian Contacts</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {sp.parentLinks.map((link) => (
              <div key={link.id} className="px-6 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={`${link.parentProfile.user.firstName} ${link.parentProfile.user.lastName}`}
                    size="md"
                  />
                  <div>
                    <p className="font-bold text-xs text-gray-900">
                      {link.parentProfile.user.firstName} {link.parentProfile.user.lastName}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {link.relation || 'Guardian'} · {link.parentProfile.user.email}
                    </p>
                  </div>
                </div>
                {link.isPrimary && <Badge variant="primary">Primary Contact</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Behaviour Log ───────────────────────────────────────────── */}
      {behaviour?.recent?.length > 0 && (
        <div className="card bg-white border border-gray-200">
          <div className="card-header border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-gray-900">Recent Conduct & Discipline</h3>
            <div className="flex gap-2">
              <Badge variant="green">{behaviour.merits} merits</Badge>
              <Badge variant="red">{behaviour.demerits} demerits</Badge>
            </div>
          </div>
          <div className="divide-y divide-gray-50 text-xs">
            {behaviour.recent.slice(0, 5).map((r) => (
              <div key={r.id} className="px-6 py-3.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{r.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {r.reportedBy?.firstName} {r.reportedBy?.lastName} ·{' '}
                    {format(new Date(r.date), 'dd MMM yyyy')}
                  </p>
                </div>
                <Badge variant={['MERIT', 'COMMENDATION'].includes(r.type) ? 'green' : 'red'}>
                  {r.type}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Interactive ID Card Preview & Print Modal ──────────────────────── */}
      <Modal
        open={previewCardOpen}
        onClose={() => setPreviewCardOpen(false)}
        title="Student Identity Card"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPreviewCardOpen(false)}>
              Close
            </button>
            <button
              className="btn-secondary inline-flex items-center gap-1.5"
              onClick={() => setCardSide((s) => (s === 'front' ? 'back' : 'front'))}
            >
              <RotateCw className="w-3.5 h-3.5" /> Flip Card ({cardSide === 'front' ? 'View Back' : 'View Front'})
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={handleDownloadIdCard}
              disabled={downloading}
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Downloading…' : 'Download PDF Card'}
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center justify-center p-4 space-y-4">
          {/* Card Frame Container */}
          <div className="relative w-full max-w-[360px] aspect-[1.586] rounded-2xl shadow-xl border border-gray-200 overflow-hidden bg-white text-gray-900 transition-all duration-300">
            {cardSide === 'front' ? (
              /* ════════════ FRONT SIDE ════════════ */
              <div className="w-full h-full flex flex-col justify-between p-3.5 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white relative">
                {/* Decorative background watermark */}
                <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-primary-500/10 blur-2xl pointer-events-none" />

                {/* Card Header */}
                <div className="border-b border-slate-700/80 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-black text-xs">
                      🎓
                    </div>
                    <div>
                      <h4 className="font-extrabold text-[12px] text-white tracking-wide uppercase leading-tight">
                        TimhirtHub Academy
                      </h4>
                      <p className="text-[9px] font-bold text-amber-400 tracking-wider uppercase">
                        Student Identity Card
                      </p>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono font-bold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                    {academicSession}
                  </span>
                </div>

                {/* Card Body Profile Area */}
                <div className="flex items-center gap-3.5 my-auto">
                  {/* Photo Frame */}
                  <div className="w-20 h-24 rounded-xl border-2 border-amber-400/50 bg-slate-800/80 flex flex-col items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                    <Avatar
                      name={`${user.firstName} ${user.lastName}`}
                      src={user.avatar}
                      className="w-14 h-14 text-base"
                    />
                    <span className="text-[7px] font-extrabold uppercase text-slate-400 mt-1">Official ID</span>
                  </div>

                  {/* Student Details */}
                  <div className="flex-1 min-w-0 space-y-1 text-left">
                    <h3 className="font-black text-sm text-white truncate leading-tight">
                      {user.firstName} {user.lastName}
                    </h3>
                    <div className="inline-block bg-primary-500/20 text-primary-300 text-[8px] font-extrabold px-1.5 py-0.2 rounded border border-primary-500/30 uppercase tracking-wider">
                      Student
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-slate-300 pt-1">
                      <div>
                        <span className="text-slate-500 block text-[7.5px] font-bold uppercase">Adm No</span>
                        <span className="font-mono font-bold text-amber-300">{sp?.admissionNumber || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[7.5px] font-bold uppercase">Class</span>
                        <span className="font-bold text-white">{sp?.class?.name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[7.5px] font-bold uppercase">Grade</span>
                        <span className="font-bold text-white">{sp?.class?.gradeLevel?.name || sp?.gradeLevel?.name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[7.5px] font-bold uppercase">Gender</span>
                        <span className="font-bold text-white">{user.gender === 'MALE' ? 'Male' : user.gender === 'FEMALE' ? 'Female' : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Barcode Band */}
                <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-0.5 opacity-80">
                    {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 3, 1, 4, 2, 1].map((w, i) => (
                      <div
                        key={i}
                        className="bg-slate-300 h-3 rounded-xs"
                        style={{ width: `${w * 1.5}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-[8px] font-mono font-bold text-slate-400">
                    ID: {sp?.admissionNumber ?? id.slice(0, 8)}
                  </span>
                </div>
              </div>
            ) : (
              /* ════════════ BACK SIDE ════════════ */
              <div className="w-full h-full flex flex-col justify-between p-3.5 bg-slate-900 text-white text-left">
                {/* Back Top Banner */}
                <div className="border-b border-slate-700 pb-1.5 flex items-center justify-between">
                  <span className="text-[9px] font-extrabold text-amber-400 tracking-wider uppercase">
                    Terms & Instructions
                  </span>
                  <span className="text-[8px] text-slate-400">Card Verification</span>
                </div>

                {/* Rules List */}
                <div className="space-y-1 text-[8px] text-slate-300 leading-tight">
                  <p>1. This card is valid only for the designated student and is non-transferable.</p>
                  <p>2. Must be presented upon entry to classrooms, examinations, and campus library.</p>
                  <p>3. If lost or stolen, report immediately to the school registrar.</p>
                </div>

                {/* Contact Box */}
                <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 text-[7.5px] text-slate-300 space-y-0.5">
                  <p className="font-extrabold text-amber-300">If found, please return to:</p>
                  <p>School Administration Office · Addis Ababa, Ethiopia</p>
                  <p>Emergency Contact: {user.phone || '+251 911 000 000'}</p>
                </div>

                {/* Signature Line */}
                <div className="flex items-end justify-between pt-1 border-t border-slate-700 text-[8px]">
                  <div className="text-center">
                    <div className="w-20 border-b border-slate-500 mb-0.5" />
                    <span className="text-slate-400 text-[7px]">Student Signature</span>
                  </div>
                  <div className="text-center">
                    <div className="w-24 border-b border-amber-400/80 mb-0.5" />
                    <span className="text-amber-300 font-bold text-[7px]">Principal / Registrar</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center">
            Click <strong>Flip Card</strong> to view reverse side or <strong>Download PDF Card</strong> for print-ready CR80 file.
          </p>
        </div>
      </Modal>
    </div>
  );
}
