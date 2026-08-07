import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { downloadFile } from '../../lib/downloadFile';
import { Avatar, Badge } from '../../components/ui/index';
import PageLoader from '../../components/ui/PageLoader';
import GradesBarChart from '../../components/charts/GradesBarChart';
import { ArrowLeft, Mail, Phone, Calendar, BookOpen, CalendarCheck, AlertTriangle, CreditCard } from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function StudentDetailPage() {
  const { id } = useParams();

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

  if (isLoading) return <PageLoader />;
  if (!user) return <div className="text-center text-gray-400 py-16">Student not found</div>;

  const sp = user.studentProfile;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Students
      </Link>

      <div className="flex justify-end">
        <button
          className="btn-secondary inline-flex items-center gap-2"
          onClick={() => downloadFile(`/users/${id}/id-card`, `id-card-${sp?.admissionNumber ?? id}.pdf`).catch(() => toast.error('Could not generate ID card'))}
        >
          <CreditCard size={16} /> Download ID Card
        </button>
      </div>

      {/* Profile header */}
      <div className="card p-6 flex flex-col sm:flex-row gap-6 items-start">
        <Avatar name={`${user.firstName} ${user.lastName}`} src={user.avatar} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
            <Badge variant={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
          </div>
          <p className="text-gray-500 font-mono text-sm">{sp?.admissionNumber}</p>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{user.email}</span>
            {user.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{user.phone}</span>}
            {user.dateOfBirth && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{format(new Date(user.dateOfBirth), 'dd MMM yyyy')}</span>}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {sp?.class && <Badge variant="blue">Class: {sp.class.name}</Badge>}
            {sp?.gradeLevel && <Badge variant="purple">{sp.gradeLevel.name}</Badge>}
            {sp?.rollNumber && <Badge variant="gray">Roll: {sp.rollNumber}</Badge>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarCheck} label="Attendance Rate"  value={`${attendance?.percentage ?? 0}%`}  color={attendance?.percentage >= 75 ? 'green' : 'red'} />
        <StatCard icon={BookOpen}      label="Exams Taken"      value={results?.examResults?.length ?? 0}   color="blue" />
        <StatCard icon={AlertTriangle} label="Behaviour Points" value={behaviour?.totalPoints ?? 0}         color={behaviour?.totalPoints >= 0 ? 'green' : 'red'} />
        <StatCard icon={BookOpen}      label="Assignments Done" value={results?.submissionResults?.filter(s => s.status === 'GRADED').length ?? 0} color="purple" />
      </div>

      {/* Grades chart */}
      {results?.examResults?.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Exam Performance</h3></div>
          <div className="card-body">
            <GradesBarChart results={results.examResults.map((r) => ({ exam: r.exam, marksObtained: r.marksObtained }))} />
          </div>
        </div>
      )}

      {/* Parents */}
      {sp?.parentLinks?.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Parent/Guardian</h3></div>
          <div className="divide-y divide-gray-50">
            {sp.parentLinks.map((link) => (
              <div key={link.id} className="px-6 py-4 flex items-center gap-3">
                <Avatar name={`${link.parentProfile.user.firstName} ${link.parentProfile.user.lastName}`} size="md" />
                <div>
                  <p className="font-medium text-gray-900">{link.parentProfile.user.firstName} {link.parentProfile.user.lastName}</p>
                  <p className="text-xs text-gray-500">{link.relation} · {link.parentProfile.user.email}</p>
                </div>
                {link.isPrimary && <Badge variant="primary">Primary</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent behaviour */}
      {behaviour?.recent?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Recent Behaviour</h3>
            <div className="flex gap-2">
              <Badge variant="green">{behaviour.merits} merits</Badge>
              <Badge variant="red">{behaviour.demerits} demerits</Badge>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {behaviour.recent.slice(0, 5).map((r) => (
              <div key={r.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.title}</p>
                  <p className="text-xs text-gray-400">{r.reportedBy?.firstName} {r.reportedBy?.lastName} · {format(new Date(r.date), 'dd MMM yyyy')}</p>
                </div>
                <Badge variant={['MERIT','COMMENDATION'].includes(r.type) ? 'green' : 'red'}>{r.type}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
