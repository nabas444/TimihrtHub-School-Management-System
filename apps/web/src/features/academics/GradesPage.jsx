import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { downloadFile } from '../../lib/downloadFile';
import GradesBarChart from '../../components/charts/GradesBarChart';
import { Badge, EmptyState } from '../../components/ui/index';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import { BookOpen, TrendingUp, Award, Download } from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const GRADE_COLOR = { 'A+': 'green', A: 'green', B: 'blue', C: 'yellow', D: 'yellow', F: 'red' };

export default function GradesPage() {
  const { isStudent, isAdmin, isTeacher, isParent, user } = useAuthStore();
  const [termId, setTermId] = useState('');

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => api.get('/academics/terms').then((r) => r.data.data),
  });

  const currentTerm = terms?.find((t) => t.isCurrent);

  const { data: results, isLoading } = useQuery({
    queryKey: ['my-results', termId || currentTerm?.id],
    queryFn: () => api.get(`/academics/results${termId ? `?termId=${termId}` : ''}`).then((r) => r.data.data),
    enabled: isStudent(),
  });

  // Compute stats
  const examResults = results?.examResults ?? [];
  const submissions = results?.submissionResults ?? [];

  const pct = (m, t) => t ? Math.round((m / t) * 100) : 0;

  const avgExam = examResults.length
    ? Math.round(examResults.reduce((s, r) => s + pct(r.marksObtained, r.exam.totalMarks), 0) / examResults.length)
    : null;

  const passed = examResults.filter((r) => pct(r.marksObtained, r.exam.totalMarks) >= 50).length;

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Grades & Results</h1>
          <p className="page-subtitle">Your academic performance</p>
        </div>
        <select className="input w-44" value={termId} onChange={(e) => setTermId(e.target.value)}>
          <option value="">Current Term</option>
          {(terms ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} {t.academicYear}</option>)}
        </select>
        {isStudent() && (
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => {
              const effectiveTermId = termId || currentTerm?.id;
              if (!effectiveTermId) { toast.error('No term selected'); return; }
              downloadFile(`/academics/reports/pdf?termId=${effectiveTermId}`, 'report-card.pdf')
                .catch(() => toast.error('Report card not available yet — it may not have been generated for this term'));
            }}
          >
            <Download size={16} /> Download Report Card
          </button>
        )}
      </div>

      {isLoading ? <PageLoader /> : (
        <>
          {/* Summary stats */}
          {examResults.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={BookOpen}    label="Exams Taken"  value={examResults.length}         color="blue" />
              <StatCard icon={TrendingUp}  label="Average Score" value={`${avgExam ?? 0}%`}         color={avgExam >= 70 ? 'green' : avgExam >= 50 ? 'amber' : 'red'} />
              <StatCard icon={Award}       label="Passed"        value={passed}                     color="green" />
              <StatCard icon={BookOpen}    label="Assignments"   value={submissions.length}         color="purple" />
            </div>
          )}

          {/* Chart */}
          {examResults.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="font-semibold">Score Overview</h3></div>
              <div className="card-body">
                <GradesBarChart results={examResults.map((r) => ({ exam: r.exam, marksObtained: r.marksObtained }))} />
              </div>
            </div>
          )}

          {/* Exam results table */}
          <div className="card">
            <div className="card-header"><h3 className="font-semibold">Exam Results</h3></div>
            {examResults.length === 0
              ? <EmptyState icon={BookOpen} title="No exam results yet" description="Results will appear here after exams are graded" />
              : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead><tr><th>Subject</th><th>Exam</th><th>Date</th><th>Score</th><th>Grade</th><th>Status</th></tr></thead>
                    <tbody>
                      {examResults.map((r) => {
                        const score = pct(r.marksObtained, r.exam.totalMarks);
                        return (
                          <tr key={r.id}>
                            <td className="font-medium">{r.exam.subject?.name}</td>
                            <td className="text-gray-600">{r.exam.title}</td>
                            <td className="text-gray-500 text-sm">{format(new Date(r.exam.scheduledAt), 'dd MMM yyyy')}</td>
                            <td className="font-mono font-semibold">{r.marksObtained}/{r.exam.totalMarks} <span className="text-gray-400 font-normal">({score}%)</span></td>
                            <td><Badge variant={GRADE_COLOR[r.grade] ?? 'gray'}>{r.grade ?? '—'}</Badge></td>
                            <td><Badge variant={score >= 50 ? 'green' : 'red'}>{score >= 50 ? 'Pass' : 'Fail'}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>

          {/* Assignment grades */}
          {submissions.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="font-semibold">Assignment Grades</h3></div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Subject</th><th>Assignment</th><th>Score</th><th>Feedback</th></tr></thead>
                  <tbody>
                    {submissions.map((s) => {
                      const score = s.marksObtained != null ? pct(s.marksObtained, s.assignment.totalMarks) : null;
                      return (
                        <tr key={s.id}>
                          <td className="font-medium">{s.assignment.subject?.name}</td>
                          <td className="text-gray-600">{s.assignment.title}</td>
                          <td className="font-mono font-semibold">
                            {score !== null ? `${s.marksObtained}/${s.assignment.totalMarks} (${score}%)` : '—'}
                          </td>
                          <td className="text-sm text-gray-500 max-w-xs truncate">{s.feedback ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
