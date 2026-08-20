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
  MapPin,
  Heart,
  Users,
  Building,
  FileText,
  Shield,
  Bus,
} from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function StudentDetailPage() {
  const { id } = useParams();
  const [previewCardOpen, setPreviewCardOpen] = useState(false);
  const [cardSide, setCardSide] = useState('front'); // 'front' | 'back'
  const [cardLayout, setCardLayout] = useState('HORIZONTAL'); // 'HORIZONTAL' | 'VERTICAL'
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

  if (isLoading) return <PageLoader />;
  if (!user) return <div className="text-center text-gray-400 py-16">Student not found</div>;

  const sp = user.studentProfile || {};
  const currentYear = new Date().getFullYear();
  const academicSession = `${currentYear} - ${currentYear + 1}`;
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
  const houseColor = sp.house?.colorHex || '#4F46E5';

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
      <div className="card p-6 flex flex-col sm:flex-row gap-6 items-start bg-white border border-gray-200 shadow-xs relative overflow-hidden">
        {sp.house && (
          <div
            className="absolute top-0 left-0 right-0 h-2"
            style={{ backgroundColor: houseColor }}
          />
        )}

        <Avatar name={fullName} src={user.avatar} size="xl" className="shadow-xs" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              {fullName}
            </h1>
            {sp.status === 'ARCHIVE' ? (
              <Badge variant="purple">Archived Student</Badge>
            ) : sp.status === 'INACTIVE' || !user.isActive ? (
              <Badge variant="red">Inactive</Badge>
            ) : (
              <Badge variant="green">Active Enrolled</Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-gray-600 font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
              Adm: {sp.admissionNumber || '—'}
            </span>
            {sp.rollNumber && (
              <span className="text-gray-600 font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                Roll: {sp.rollNumber}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
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
            {user.address && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {[user.address, user.city, user.state].filter(Boolean).join(', ')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3.5">
            {sp.class && <Badge variant="blue">Class: {sp.class.name}</Badge>}
            {sp.class?.gradeLevel ? (
              <Badge variant="purple">{sp.class.gradeLevel.name}</Badge>
            ) : sp.gradeLevel ? (
              <Badge variant="purple">{sp.gradeLevel.name}</Badge>
            ) : null}
            {sp.house && (
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-2xs inline-flex items-center gap-1"
                style={{ backgroundColor: houseColor }}
              >
                🏠 House: {sp.house.value}
              </span>
            )}
            {sp.usesTransport && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 shadow-2xs inline-flex items-center gap-1">
                <Bus className="w-3 h-3" /> Transport: {sp.busRoute?.name || 'Bus Rider'}
              </span>
            )}
            {(sp.class?.programType || sp.programType) && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 shadow-2xs inline-flex items-center gap-1">
                ⏱ Session: {sp.programTypeLabel || sp.class?.programTypeLabel || sp.class?.programType || sp.programType}
              </span>
            )}
            {sp.category && <Badge variant="gray">Category: {sp.category.value}</Badge>}
            {sp.feeCategory && <Badge variant="gray">Fee: {sp.feeCategory.value}</Badge>}
            {sp.curriculum && <Badge variant="blue">Curriculum: {sp.curriculum.value}</Badge>}
            {sp.bloodGroup && <Badge variant="red">Blood: {sp.bloodGroup}</Badge>}
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

      {/* ── Information Cards Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal & Medical Info */}
        <div className="card bg-white border border-gray-200 p-5 space-y-3">
          <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
            <Heart className="w-4 h-4 text-red-500" /> Personal & Medical Details
          </h3>
          <div className="grid grid-cols-2 gap-y-2.5 text-xs">
            <div>
              <span className="text-gray-400 block text-[11px]">Full Name</span>
              <span className="font-bold text-gray-800">{fullName}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Gender</span>
              <span className="font-bold text-gray-800">{user.gender || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Date of Birth</span>
              <span className="font-bold text-gray-800">
                {user.dateOfBirth ? format(new Date(user.dateOfBirth), 'dd MMM yyyy') : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Birth Place</span>
              <span className="font-bold text-gray-800">{sp.birthPlace || user.birthPlace || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Nationality</span>
              <span className="font-bold text-gray-800">{sp.nationality || user.nationality || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Blood Group</span>
              <span className="font-bold text-gray-800">{sp.bloodGroup || '—'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-400 block text-[11px]">Residential Address</span>
              <span className="font-medium text-gray-800">
                {[user.address, user.city, user.state, user.pincode].filter(Boolean).join(', ') || '—'}
              </span>
            </div>
            {sp.medicalNotes && (
              <div className="col-span-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-800 text-[11px]">
                <strong>Medical Notes:</strong> {sp.medicalNotes}
              </div>
            )}
          </div>
        </div>

        {/* Classification & Admissions */}
        <div className="card bg-white border border-gray-200 p-5 space-y-3">
          <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
            <Building className="w-4 h-4 text-primary-600" /> Classification & Admissions
          </h3>
          <div className="grid grid-cols-2 gap-y-2.5 text-xs">
            <div>
              <span className="text-gray-400 block text-[11px]">Religion</span>
              <span className="font-bold text-gray-800">{sp.religion?.value || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Category</span>
              <span className="font-bold text-gray-800">{sp.category?.value || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Fee Category</span>
              <span className="font-bold text-gray-800">{sp.feeCategory?.value || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">House</span>
              <span className="font-bold text-gray-800">{sp.house?.value || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Curriculum</span>
              <span className="font-bold text-gray-800">{sp.curriculum?.value || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Admissions Source</span>
              <span className="font-bold text-gray-800">{sp.source?.value || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Previous School</span>
              <span className="font-bold text-gray-800">{sp.previousSchool?.value || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Previous Class / Year</span>
              <span className="font-bold text-gray-800">{sp.previousClassYear || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Program / Session</span>
              <span className="font-bold text-gray-800">
                {sp.programTypeLabel || sp.class?.programTypeLabel || sp.class?.programType || sp.programType || 'Regular Day'}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Transportation</span>
              <span className="font-bold text-gray-800">
                {sp.usesTransport ? `🚌 ${sp.busRoute?.name || 'Bus Rider'}` : '🚶 No Transport'}
              </span>
            </div>
            {sp.reference && (
              <div className="col-span-2">
                <span className="text-gray-400 block text-[11px]">Reference / Referred By</span>
                <span className="font-medium text-gray-800">{sp.reference}</span>
              </div>
            )}
          </div>
        </div>

        {/* Parents / Guardians Info */}
        <div className="card bg-white border border-gray-200 p-5 space-y-3 col-span-1 md:col-span-2">
          <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
            <Users className="w-4 h-4 text-emerald-600" /> Parent / Guardian Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
              <h4 className="font-bold text-gray-900 text-xs">Father's Information</h4>
              <p className="text-gray-700">
                <strong className="text-gray-900">Name:</strong>{' '}
                {[sp.fatherFirstName, sp.fatherMiddleName, sp.fatherLastName].filter(Boolean).join(' ') || '—'}
              </p>
              <p className="text-gray-700">
                <strong className="text-gray-900">Mobile:</strong> {sp.fatherMobile || '—'}
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
              <h4 className="font-bold text-gray-900 text-xs">Mother's Information</h4>
              <p className="text-gray-700">
                <strong className="text-gray-900">Name:</strong>{' '}
                {[sp.motherFirstName, sp.motherMiddleName, sp.motherLastName].filter(Boolean).join(' ') || '—'}
              </p>
              <p className="text-gray-700">
                <strong className="text-gray-900">Mobile:</strong> {sp.motherMobile || '—'}
              </p>
            </div>
          </div>

          {sp.landline && (
            <p className="text-xs text-gray-600 pt-1">
              <strong>Home Landline:</strong> {sp.landline}
            </p>
          )}

          {sp.parentLinks?.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <h4 className="font-bold text-xs text-gray-900 mb-2">Linked System Accounts</h4>
              <div className="divide-y divide-gray-100">
                {sp.parentLinks.map((link) => (
                  <div key={link.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={`${link.parentProfile.user.firstName} ${link.parentProfile.user.lastName}`}
                        size="sm"
                      />
                      <div>
                        <p className="font-bold text-xs text-gray-900">
                          {link.parentProfile.user.firstName} {link.parentProfile.user.lastName}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {link.relation || 'Guardian'} · {link.parentProfile.user.email} · {link.parentProfile.user.phone || ''}
                        </p>
                      </div>
                    </div>
                    {link.isPrimary && <Badge variant="primary">Primary Contact</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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

      {/* ── Interactive ID Card Preview Modal ──────────────────────────────── */}
      <Modal
        open={previewCardOpen}
        onClose={() => setPreviewCardOpen(false)}
        title="Student Identity Card"
        size="md"
        footer={
          <>
            <button className="btn-secondary text-xs" onClick={() => setPreviewCardOpen(false)}>
              Close
            </button>
            <button
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
              onClick={() => setCardSide((s) => (s === 'front' ? 'back' : 'front'))}
            >
              <RotateCw className="w-3.5 h-3.5" /> Flip Card ({cardSide === 'front' ? 'View Back' : 'View Front'})
            </button>
            <button
              className="btn-primary text-xs inline-flex items-center gap-1.5"
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
          <div className="relative w-full max-w-[360px] aspect-[1.586] rounded-2xl shadow-xl border border-gray-200 overflow-hidden bg-white text-gray-900 transition-all duration-300">
            {cardSide === 'front' ? (
              /* ════════════ FRONT SIDE ════════════ */
              <div className="w-full h-full flex flex-col justify-between p-3.5 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white relative">
                {sp.house && (
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: houseColor }}
                  />
                )}

                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-primary-400" />
                    <div>
                      <h4 className="font-black text-xs tracking-tight text-white leading-tight">
                        {user.school?.name || 'TIMHIRTHUB ACADEMY'}
                      </h4>
                      <p className="text-[9px] uppercase tracking-widest text-primary-300 font-bold">
                        Student Identity Card
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 items-center my-auto">
                  <div className="w-16 h-18 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center p-1 relative overflow-hidden shadow-inner">
                    {user.avatar ? (
                      <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary-600/30 text-primary-200 font-black text-base rounded-lg">
                        {user.firstName[0]}
                        {user.lastName[0]}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-0.5">
                    <h2 className="font-black text-sm text-white leading-tight">{fullName}</h2>
                    <p className="font-mono text-[10px] text-amber-400 font-bold tracking-wide">
                      ID: {sp.admissionNumber || 'STU-0000'}
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-300 pt-0.5">
                      <div>
                        <span className="text-slate-400">Class:</span>{' '}
                        <strong className="text-white">{sp.class?.name || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Roll:</span>{' '}
                        <strong className="text-white">{sp.rollNumber || '—'}</strong>
                      </div>
                      {sp.bloodGroup && (
                        <div>
                          <span className="text-slate-400">Blood:</span>{' '}
                          <strong className="text-red-400">{sp.bloodGroup}</strong>
                        </div>
                      )}
                      {sp.house && (
                        <div>
                          <span className="text-slate-400">House:</span>{' '}
                          <strong style={{ color: houseColor }}>{sp.house.value}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[9px] text-slate-400">
                  <span className="font-mono text-[8px] tracking-wider text-slate-400">||||||||||||||||||||||||||</span>
                  <span className="font-bold text-slate-300">SESSION: {academicSession}</span>
                </div>
              </div>
            ) : (
              /* ════════════ BACK SIDE ════════════ */
              <div className="w-full h-full flex flex-col justify-between p-3.5 bg-slate-50 text-gray-800 text-[10px] relative">
                <div className="border-b border-gray-200 pb-1 flex items-center justify-between">
                  <span className="font-black text-[11px] text-primary-900 uppercase tracking-wider">
                    Terms & Instructions
                  </span>
                  <ShieldCheck className="w-4 h-4 text-primary-600" />
                </div>

                <div className="space-y-1 text-gray-600 text-[9px] my-auto">
                  <p>1. This card is valid only for the academic period shown on front.</p>
                  <p>2. Must be produced on request by authorized campus personnel.</p>
                  <p>3. If lost or found, please return immediately to administration.</p>
                  {sp.fatherMobile && <p className="font-bold text-gray-800">Emergency Tel: {sp.fatherMobile}</p>}
                </div>

                <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-[9px] text-gray-500">
                  <span>Authorized Signature</span>
                  <div className="w-20 border-b border-gray-400 mb-1" />
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
