import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Badge, EmptyState } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import {
  BookOpen,
  TrendingUp,
  Award,
  Send,
  Users,
  FileSpreadsheet,
  Search,
  Sparkles,
  Building2,
  Calendar,
  CheckCircle,
  Printer,
} from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import { GRADE_COLOR } from './gradesConstants';
import toast from 'react-hot-toast';

export default function MasterRosterPage() {
  const { isAdmin } = useAuthStore();
  const qc = useQueryClient();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);

  // Fetch Terms
  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => api.get('/academics/terms').then((r) => r.data.data),
  });

  const currentTerm = terms?.find((t) => t.isCurrent) || terms?.[0];
  const activeTermId = selectedTermId || currentTerm?.id;

  // Fetch Assigned Classes
  const { data: assignmentsData } = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: () => api.get('/academics/teacher-assignments').then((r) => r.data.data),
  });

  const assignedClasses = assignmentsData?.classes ?? [];

  useMemo(() => {
    if (assignedClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(assignedClasses[0].id);
    }
  }, [assignedClasses, selectedClassId]);

  const activeClassId = selectedClassId || assignedClasses?.[0]?.id;

  // Fetch Master Multi-Subject Cumulative Class Roster
  const {
    data: masterRosterData,
    isLoading: masterRosterLoading,
  } = useQuery({
    queryKey: ['master-roster', activeClassId, activeTermId],
    queryFn: () =>
      api
        .get(`/academics/master-roster?classId=${activeClassId}&termId=${activeTermId}`)
        .then((r) => r.data.data),
    enabled: !!activeClassId && !!activeTermId,
  });

  // Distribute Report Cards Mutation
  const distributeReportsMutation = useMutation({
    mutationFn: () =>
      api.post('/academics/master-roster/distribute', {
        classId: activeClassId,
        termId: activeTermId,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['master-roster'] });
      qc.invalidateQueries({ queryKey: ['student-results'] });
      toast.success(res.data?.message || 'Official report cards generated and distributed successfully!');
      setDistributeModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to distribute report cards');
    },
  });

  // Export Master Cumulative CSV
  const handleExportMasterCSV = () => {
    if (!masterRosterData || !masterRosterData.students?.length) {
      toast.error('No master roster data to export');
      return;
    }

    const subjects = masterRosterData.subjects ?? [];
    const maxMarks = masterRosterData.students[0]?.maxPossibleMarks || subjects.length * 100;
    const headers = [
      'Rank',
      'Roll No',
      'Admission No',
      'Student Name',
      'Gender',
      'Age',
      ...subjects.map((sub) => `"${sub.name} (/100)"`),
      `"Grand Total (/${maxMarks})"`,
      'Average (%)',
      'GPA',
      'Overall Grade',
      'Remarks',
    ];

    const rows = masterRosterData.students.map((s) => {
      const subjectCols = subjects.map((sub) => {
        const item = s.subjectMarks[sub.id];
        if (!item || item.total === null) return '—';
        return `${item.total} (${item.grade})`;
      });

      return [
        s.rank || '—',
        s.rollNumber,
        s.admissionNumber || '',
        `"${s.name}"`,
        s.gender || '—',
        s.age ?? '—',
        ...subjectCols,
        s.totalMarksEarned,
        s.averagePercentage !== null ? `${s.averagePercentage}%` : '—',
        s.gpa !== null ? s.gpa : '—',
        s.overallGrade || '—',
        `"${s.remarks || '—'}"`,
      ].join(',');
    });

    const csvContent =
      `data:text/csv;charset=utf-8,` +
      `"School: ${masterRosterData.school?.name ?? 'TimhirtHub School'}"\n` +
      `"Class: ${masterRosterData.class?.name ?? ''} | Academic Term: ${masterRosterData.term?.name ?? ''} (${masterRosterData.term?.academicYear ?? ''})"\n` +
      `"Class Teacher: ${masterRosterData.class?.classTeacher ?? 'Unassigned'}"\n\n` +
      [headers.join(','), ...rows].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `master-cumulative-roster-${masterRosterData.class?.name}-${masterRosterData.term?.name}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Master class roster exported to CSV');
  };

  // Filter students for Master Roster view
  const filteredMasterStudents = useMemo(() => {
    const raw = masterRosterData?.students ?? [];
    return raw.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.admissionNumber && s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      if (filterMissingOnly && s.missingSubjectsCount === 0) return false;
      return matchesSearch;
    });
  }, [masterRosterData, searchQuery, filterMissingOnly]);

  const masterStats = masterRosterData?.stats;
  const masterSubjects = masterRosterData?.subjects ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-primary-600" />
            Master Cumulative Class Roster
          </h1>
          <p className="page-subtitle">
            Cross-subject academic overview, student rankings, GPAs, and term report card distribution.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="btn-secondary inline-flex items-center gap-1.5"
            onClick={handleExportMasterCSV}
            disabled={!masterRosterData?.students?.length}
            title="Export master cumulative sheet as CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Master CSV
          </button>
          <button
            className="btn-secondary inline-flex items-center gap-1.5"
            onClick={() => window.print()}
            title="Print official master result sheet"
          >
            <Printer className="w-4 h-4 text-gray-600" /> Print Master Sheet
          </button>
          {isAdmin() && (
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => setDistributeModalOpen(true)}
              disabled={!masterRosterData?.students?.length}
            >
              <Send className="w-4 h-4" /> Distribute Report Cards
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-primary-600" /> Class & Section *
            </label>
            <select
              className="input"
              value={activeClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              {assignedClasses.length === 0 && <option value="">No classes found</option>}
              {assignedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Academic Term *
            </label>
            <select
              className="input"
              value={activeTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
            >
              {(terms ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.academicYear})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-gray-500" /> Quick Search
            </label>
            <div className="relative">
              <input
                className="input pl-8 text-xs"
                placeholder="Filter student name or roll #…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 select-none">
            <input
              type="checkbox"
              checked={filterMissingOnly}
              onChange={(e) => setFilterMissingOnly(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span>Show Students with Incomplete / Missing Scores Only</span>
          </label>

          <span className="text-gray-400">
            Showing {filteredMasterStudents.length} students across {masterSubjects.length} subjects
          </span>
        </div>
      </div>

      {/* Master Summary Stat Cards */}
      {masterStats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            icon={Users}
            label="Total Enrolled"
            value={masterStats.totalStudents}
            color="blue"
          />
          <StatCard
            icon={TrendingUp}
            label="Class Average"
            value={`${masterStats.classAverage}%`}
            color={
              masterStats.classAverage >= 70
                ? 'green'
                : masterStats.classAverage >= 50
                ? 'amber'
                : 'red'
            }
          />
          <StatCard
            icon={Award}
            label="Pass Rate"
            value={`${masterStats.passRate}%`}
            color="green"
          />
          <StatCard
            icon={Sparkles}
            label="Rank #1 Top Student"
            value={masterStats.topStudentName}
            color="purple"
          />
          <StatCard
            icon={BookOpen}
            label="Active Subjects"
            value={masterStats.subjectsCount}
            color="indigo"
          />
        </div>
      )}

      {/* Master Table */}
      {masterRosterLoading ? (
        <PageLoader />
      ) : !masterRosterData?.students?.length ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={Users}
            title="No student data available for this class"
            description="Ensure students are enrolled in the selected class."
          />
        </div>
      ) : (
        <div className="card overflow-hidden border border-gray-200 shadow-sm print:shadow-none print:border-none">
          {/* Official Master Result Sheet Header */}
          <div className="bg-gradient-to-r from-gray-900 via-primary-950 to-gray-900 text-white p-6 border-b border-gray-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-md">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-extrabold text-xl leading-tight">
                    {masterRosterData.school?.name || 'TimhirtHub School System'}
                  </h2>
                  <p className="text-xs font-semibold text-primary-300 uppercase tracking-wider mt-0.5">
                    Official Master Cumulative Examination & Assessment Roster
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-xs text-gray-300 bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Class & Section</span>
                  <strong className="text-white text-sm">
                    {masterRosterData.class?.name}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Academic Term</span>
                  <strong className="text-white text-sm">
                    {masterRosterData.term?.name}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Class Teacher</span>
                  <span className="text-white font-medium">
                    {masterRosterData.class?.classTeacher || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Academic Year</span>
                  <span className="text-white font-mono">
                    {masterRosterData.class?.academicYear}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Master Roster Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/90 border-b border-gray-300 text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  <th className="p-3 w-14 text-center sticky left-0 bg-gray-100 z-10">Rank</th>
                  <th className="p-3 w-12 text-center">Roll</th>
                  <th className="p-3 min-w-44 sticky left-14 bg-gray-100 z-10">Student Name</th>
                  <th className="p-3 w-16 text-center">Gender</th>
                  <th className="p-3 w-16 text-center">Age</th>

                  {/* Subject Columns */}
                  {masterSubjects.map((sub) => (
                    <th
                      key={sub.id}
                      className="p-3 min-w-28 text-center border-x border-gray-200 bg-blue-50/40"
                      title={`${sub.name} (Credit: ${sub.creditHours} hrs)`}
                    >
                      <div className="truncate max-w-[120px] mx-auto font-bold">{sub.name}</div>
                      <span className="text-[10px] font-normal text-gray-500 font-mono">
                        /100
                      </span>
                    </th>
                  ))}

                  {/* Cumulative Results */}
                  <th className="p-3 min-w-28 text-center bg-purple-50/70 border-x border-gray-300 font-extrabold text-purple-900">
                    <div>Grand Total</div>
                    <span className="text-[10px] font-normal text-purple-700">
                      (Max {masterRosterData.students[0]?.maxPossibleMarks || masterSubjects.length * 100})
                    </span>
                  </th>
                  <th className="p-3 w-20 text-center bg-emerald-50/70 font-extrabold text-emerald-900">
                    Average %
                  </th>
                  <th className="p-3 w-16 text-center bg-gray-50">GPA</th>
                  <th className="p-3 w-16 text-center bg-gray-50">Grade</th>
                  <th className="p-3 min-w-40">Remarks / Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 text-xs bg-white">
                {filteredMasterStudents.map((student) => {
                  const isRank1 = student.rank === 1;
                  const isRank2 = student.rank === 2;
                  const isRank3 = student.rank === 3;

                  return (
                    <tr
                      key={student.studentId}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isRank1
                          ? 'bg-amber-50/30'
                          : isRank2
                          ? 'bg-slate-50/50'
                          : isRank3
                          ? 'bg-orange-50/20'
                          : ''
                      }`}
                    >
                      <td className="p-3 text-center sticky left-0 bg-white font-bold">
                        {student.rank > 0 ? (
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black shadow-xs ${
                              isRank1
                                ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300'
                                : isRank2
                                ? 'bg-slate-200 text-slate-900'
                                : isRank3
                                ? 'bg-orange-200 text-orange-950'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {student.rank}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-gray-500">
                        {student.rollNumber}
                      </td>

                      <td className="p-3 sticky left-14 bg-white">
                        <div>
                          <span className="font-bold text-gray-900 block leading-tight">
                            {student.name}
                          </span>
                          {student.admissionNumber && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              Adm: {student.admissionNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            student.gender === 'F'
                              ? 'bg-pink-100 text-pink-700'
                              : student.gender === 'M'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {student.gender || '—'}
                        </span>
                      </td>

                      <td className="p-3 text-center text-gray-500 font-mono">
                        {student.age !== null ? `${student.age}` : '—'}
                      </td>

                      {masterSubjects.map((sub) => {
                        const item = student.subjectMarks[sub.id];
                        const isMissing = !item || item.total === null;

                        return (
                          <td
                            key={sub.id}
                            className="p-2.5 text-center border-x border-gray-200"
                          >
                            {isMissing ? (
                              <span className="text-amber-500 font-mono text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-dashed border-amber-300">
                                Missing
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 font-mono">
                                <span className="font-bold text-gray-900">{item.total}</span>
                                <Badge
                                  variant={
                                    GRADE_COLOR[item.grade] || 'gray'
                                  }
                                >
                                  {item.grade}
                                </Badge>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td className="p-3 text-center font-mono font-black text-sm bg-purple-50/50 border-x border-gray-200 text-purple-900">
                        {student.totalMarksEarned > 0 ? student.totalMarksEarned : '0'}
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-sm bg-emerald-50/50 text-emerald-800">
                        {student.averagePercentage !== null
                          ? `${student.averagePercentage}%`
                          : '—'}
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-gray-800 bg-gray-50">
                        {student.averagePercentage !== null ? student.gpa.toFixed(1) : '—'}
                      </td>

                      <td className="p-3 text-center bg-gray-50">
                        <Badge variant={GRADE_COLOR[student.overallGrade] ?? 'gray'}>
                          {student.overallGrade}
                        </Badge>
                      </td>

                      <td className="p-3 font-medium text-xs text-gray-700">
                        {student.remarks}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Master Roster Footer */}
          <div className="p-5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="text-gray-500">
              Showing {filteredMasterStudents.length} of {masterRosterData.students.length} students · {masterSubjects.length} subjects
            </div>

            <div className="flex items-center gap-2">
              {isAdmin() && (
                <button
                  className="btn-primary inline-flex items-center gap-1.5"
                  onClick={() => setDistributeModalOpen(true)}
                >
                  <Send className="w-4 h-4" /> Distribute Term Report Cards
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Distribute Report Cards Modal */}
      <Modal
        open={distributeModalOpen}
        onClose={() => setDistributeModalOpen(false)}
        title="Distribute Official Term Report Cards"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDistributeModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={() => distributeReportsMutation.mutate()}
              disabled={distributeReportsMutation.isPending}
            >
              <Send className="w-4 h-4" />
              {distributeReportsMutation.isPending ? 'Distributing…' : 'Publish & Distribute Report Cards'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            You are about to compute final rankings and generate official printable Report Cards for all students in{' '}
            <strong>Class {masterRosterData?.class?.name}</strong> for{' '}
            <strong>{masterRosterData?.term?.name}</strong>.
          </p>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-blue-600" /> What this action does:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-800 text-[11px]">
              <li>Calculates student averages, GPAs, and class ranking positions.</li>
              <li>Generates official PDF report cards with school branding.</li>
              <li>Makes report cards immediately available on the Student & Parent portals.</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}
