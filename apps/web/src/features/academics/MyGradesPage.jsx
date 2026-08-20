import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { downloadFile } from '../../lib/downloadFile';
import GradesBarChart from '../../components/charts/GradesBarChart';
import { Badge, EmptyState } from '../../components/ui/index';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import {
  BookOpen,
  TrendingUp,
  Award,
  Download,
  Users,
  GraduationCap,
} from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import { GRADE_COLOR } from './gradesConstants';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function MyGradesPage() {
  const { isParent } = useAuthStore();

  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [activeTab, setActiveTab] = useState('term'); // 'term' | 'annual'

  // Fetch Terms
  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => api.get('/academics/terms').then((r) => r.data.data),
  });

  const currentTerm = terms?.find((t) => t.isCurrent) || terms?.[0];
  const activeTermId = selectedTermId || currentTerm?.id;
  const currentAcademicYear = currentTerm?.academicYear || '2024/2025';

  // Fetch Parent's Linked Children (if parent role)
  const { data: parentChildren } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => api.get('/academics/parent/children').then((r) => r.data.data),
    enabled: isParent(),
  });

  const childrenList = parentChildren ?? [];
  const activeChild = useMemo(() => {
    if (!childrenList.length) return null;
    return (
      childrenList.find(
        (c) => c.userId === selectedChildId || c.studentProfileId === selectedChildId
      ) || childrenList[0]
    );
  }, [childrenList, selectedChildId]);

  const activeStudentQueryId = isParent() ? activeChild?.userId : undefined;
  const activeStudentProfileId = isParent()
    ? activeChild?.studentProfileId || activeChild?.userId
    : undefined;

  // Fetch Student / Child Personal Results
  const { data: studentResults, isLoading: studentResultsLoading } = useQuery({
    queryKey: ['student-results', activeStudentQueryId, activeTermId],
    queryFn: () =>
      api
        .get(
          `/academics/results${
            activeStudentQueryId
              ? `/${activeStudentQueryId}?termId=${activeTermId}`
              : `?termId=${activeTermId}`
          }`
        )
        .then((r) => r.data.data),
    enabled: !!activeTermId,
  });

  // Fetch Annual Report Card Summary
  const { data: annualReportCardData, isLoading: annualReportLoading } = useQuery({
    queryKey: [
      'annual-report-card-mine',
      activeStudentProfileId,
      currentAcademicYear,
    ],
    queryFn: () =>
      api
        .get(
          `/report-cards/mine?academicYear=${encodeURIComponent(
            currentAcademicYear,
          )}${
            activeStudentProfileId ? `&childId=${activeStudentProfileId}` : ''
          }`,
        )
        .then((r) => r.data.data),
  });

  const examResults = studentResults?.examResults ?? [];
  const submissions = studentResults?.submissionResults ?? [];
  const pct = (m, t) => (t ? Math.round((m / t) * 100) : 0);

  const avgExam = examResults.length
    ? Math.round(
        examResults.reduce((s, r) => s + pct(r.marksObtained, r.exam.totalMarks), 0) /
          examResults.length
      )
    : null;

  const passed = examResults.filter(
    (r) => pct(r.marksObtained, r.exam.totalMarks) >= 50
  ).length;

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary-600" />
            {isParent() ? "Children's Academic Performance & Results" : "Grades & Results"}
          </h1>
          <p className="page-subtitle">
            {isParent()
              ? "View your children's grades, exam marks, and download official report cards."
              : "Your academic performance overview and report cards"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="input w-44"
            value={activeTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
          >
            <option value="">Current Term</option>
            {(terms ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.academicYear}
              </option>
            ))}
          </select>

          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => {
              if (!activeTermId) {
                toast.error('No term selected');
                return;
              }
              const targetId = isParent() ? activeChild?.userId : undefined;
              downloadFile(
                `/academics/reports${targetId ? `/${targetId}` : ''}/pdf?termId=${activeTermId}`,
                `report-card-${activeChild?.firstName || 'student'}.pdf`
              ).catch(() =>
                toast.error(
                  'Report card not available yet — it may not have been generated for this term'
                )
              );
            }}
          >
            <Download size={16} /> Download Report Card
          </button>
        </div>
      </div>

      {/* Parent Child Switcher Banner */}
      {isParent() && (
        <>
          {childrenList.length === 0 ? (
            <div className="card p-8 text-center">
              <EmptyState
                icon={Users}
                title="No children linked to your parent account"
                description="Please contact the school administration to link your student profile(s)."
              />
            </div>
          ) : (
            <div className="card p-4 bg-gradient-to-r from-blue-50/70 via-white to-purple-50/70 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-base shadow-xs flex-shrink-0">
                  {activeChild?.firstName?.[0]}
                  {activeChild?.lastName?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base text-gray-900 leading-tight">
                      {activeChild?.fullName}
                    </h3>
                    <Badge variant="blue">Student</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Class: <strong className="text-gray-700">{activeChild?.class?.name}</strong>{' '}
                    {activeChild?.class?.gradeLevel && (
                      <span>({activeChild.class.gradeLevel.name})</span>
                    )}{' '}
                    · Roll #{activeChild?.rollNumber}{' '}
                    {activeChild?.admissionNumber && `· Adm: ${activeChild.admissionNumber}`}
                  </p>
                </div>
              </div>

              {childrenList.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-500">Switch Child:</span>
                  <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-white">
                    {childrenList.map((ch) => (
                      <button
                        key={ch.studentProfileId}
                        onClick={() => setSelectedChildId(ch.userId)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          activeChild?.userId === ch.userId
                            ? 'bg-primary-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {ch.firstName} ({ch.class?.name || 'Class'})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Tab Switcher ── */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('term')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'term'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Term Assessment & Exams
        </button>

        <button
          onClick={() => setActiveTab('annual')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'annual'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Official Annual Report Card
        </button>
      </div>

      {activeTab === 'annual' ? (
        /* ── Annual Report Card View ── */
        annualReportLoading ? (
          <PageLoader />
        ) : !annualReportCardData?.isPublished ? (
          <div className="card p-12 text-center">
            <EmptyState
              icon={GraduationCap}
              title="Annual Report Card Pending Publication"
              description={
                annualReportCardData?.message ||
                "The cumulative annual report card for this academic year has not been published yet by the school administration."
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Highlights Banner */}
            <div className="card p-5 bg-gradient-to-r from-primary-900 via-indigo-900 to-primary-950 text-white rounded-xl shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-primary-200 font-bold">
                    {annualReportCardData.school?.name} — Annual Cumulative Summary
                  </span>
                  <h2 className="text-xl font-extrabold mt-1">
                    {annualReportCardData.student?.name}
                  </h2>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Class: {annualReportCardData.student?.className} · Academic Year: {annualReportCardData.academicYear}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const profileId = annualReportCardData.student?.id;
                      if (!profileId) return;
                      downloadFile(
                        `/report-cards/${profileId}/pdf?academicYear=${encodeURIComponent(
                          annualReportCardData.academicYear,
                        )}&layout=ONE_SIDED`,
                        `report-card-${annualReportCardData.student?.name || 'student'}.pdf`,
                      ).catch(() => toast.error('Failed to download report card'));
                    }}
                    className="btn-primary py-2 px-3 text-xs inline-flex items-center gap-1.5 bg-white text-primary-900 hover:bg-gray-100 shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download One-Sided PDF
                  </button>

                  <button
                    onClick={() => {
                      const profileId = annualReportCardData.student?.id;
                      if (!profileId) return;
                      downloadFile(
                        `/report-cards/${profileId}/pdf?academicYear=${encodeURIComponent(
                          annualReportCardData.academicYear,
                        )}&layout=TWO_SIDED`,
                        `report-card-${annualReportCardData.student?.name || 'student'}-expanded.pdf`,
                      ).catch(() => toast.error('Failed to download report card'));
                    }}
                    className="btn-secondary py-2 px-3 text-xs inline-flex items-center gap-1.5 bg-indigo-800 text-white border-indigo-700 hover:bg-indigo-700"
                  >
                    <Download className="w-4 h-4" /> Download Two-Sided PDF
                  </button>
                </div>
              </div>

              {/* Annual metrics row */}
              <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-indigo-800/80">
                <div className="text-center">
                  <p className="text-xs text-indigo-200">Overall Average</p>
                  <p className="text-2xl font-black text-white mt-0.5">
                    {annualReportCardData.summary?.overallAverage != null
                      ? `${annualReportCardData.summary.overallAverage.toFixed(1)}%`
                      : '—'}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-xs text-indigo-200">Class Rank</p>
                  <p className="text-2xl font-black text-amber-300 mt-0.5">
                    {annualReportCardData.summary?.overallRank != null
                      ? `#${annualReportCardData.summary.overallRank}`
                      : '—'}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-xs text-indigo-200">Academic Standing</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-black mt-1 ${
                      annualReportCardData.summary?.isPassing
                        ? 'bg-emerald-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {annualReportCardData.summary?.isPassing
                      ? 'PASSED / PROMOTED'
                      : 'RETAINED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Term-by-Term Record Table */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Term Breakdown & Performance
                </h3>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Term / Semester</th>
                      <th className="text-center">GPA (4.0)</th>
                      <th className="text-center">Percentage</th>
                      <th className="text-center">Term Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {Array.isArray(annualReportCardData.summary?.termBreakdown) &&
                      annualReportCardData.summary.termBreakdown.map((t, idx) => (
                        <tr key={idx}>
                          <td className="font-semibold">{t.termName}</td>
                          <td className="text-center font-mono">
                            {t.gpa != null ? Number(t.gpa).toFixed(2) : '—'}
                          </td>
                          <td className="text-center font-bold text-gray-900 dark:text-white">
                            {t.percentage != null
                              ? `${Number(t.percentage).toFixed(1)}%`
                              : '—'}
                          </td>
                          <td className="text-center font-medium">
                            {t.rank != null ? `#${t.rank}` : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      ) : studentResultsLoading ? (
        <PageLoader />
      ) : (
        <>
          {/* Summary stats */}
          {examResults.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={BookOpen}
                label="Exams Taken"
                value={examResults.length}
                color="blue"
              />
              <StatCard
                icon={TrendingUp}
                label="Average Score"
                value={`${avgExam ?? 0}%`}
                color={avgExam >= 70 ? 'green' : avgExam >= 50 ? 'amber' : 'red'}
              />
              <StatCard
                icon={Award}
                label="Passed"
                value={passed}
                color="green"
              />
              <StatCard
                icon={BookOpen}
                label="Assignments"
                value={submissions.length}
                color="purple"
              />
            </div>
          )}

          {/* Chart */}
          {examResults.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Score Overview</h3>
              </div>
              <div className="card-body">
                <GradesBarChart
                  results={examResults.map((r) => ({
                    exam: r.exam,
                    marksObtained: r.marksObtained,
                  }))}
                />
              </div>
            </div>
          )}

          {/* Exam results table */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold">Exam & Assessment Results</h3>
            </div>
            {examResults.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No exam results yet"
                description="Results will appear here once exams are graded by your teachers."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Assessment / Exam</th>
                      <th>Date</th>
                      <th>Score</th>
                      <th>Grade</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examResults.map((r) => {
                      const score = pct(r.marksObtained, r.exam.totalMarks);
                      return (
                        <tr key={r.id}>
                          <td className="font-medium">{r.exam.subject?.name}</td>
                          <td className="text-gray-600">{r.exam.title}</td>
                          <td className="text-gray-500 text-sm">
                            {format(new Date(r.exam.scheduledAt), 'dd MMM yyyy')}
                          </td>
                          <td className="font-mono font-semibold">
                            {r.marksObtained}/{r.exam.totalMarks}{' '}
                            <span className="text-gray-400 font-normal">({score}%)</span>
                          </td>
                          <td>
                            <Badge variant={GRADE_COLOR[r.grade] ?? 'gray'}>
                              {r.grade ?? '—'}
                            </Badge>
                          </td>
                          <td>
                            <Badge variant={score >= 50 ? 'green' : 'red'}>
                              {score >= 50 ? 'Pass' : 'Fail'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assignment grades */}
          {submissions.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Assignment Grades</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Assignment</th>
                      <th>Score</th>
                      <th>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s) => {
                      const score =
                        s.marksObtained != null
                          ? pct(s.marksObtained, s.assignment.totalMarks)
                          : null;
                      return (
                        <tr key={s.id}>
                          <td className="font-medium">{s.assignment.subject?.name}</td>
                          <td className="text-gray-600">{s.assignment.title}</td>
                          <td className="font-mono font-semibold">
                            {score !== null
                              ? `${s.marksObtained}/${s.assignment.totalMarks} (${score}%)`
                              : '—'}
                          </td>
                          <td className="text-sm text-gray-500 max-w-xs truncate">
                            {s.feedback ?? '—'}
                          </td>
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
