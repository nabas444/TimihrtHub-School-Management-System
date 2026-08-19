import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { downloadFile } from '../../lib/downloadFile';
import GradesBarChart from '../../components/charts/GradesBarChart';
import { Badge, EmptyState } from '../../components/ui/index';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import { useAuthStore } from '../../store/authStore';
import {
  BookOpen,
  TrendingUp,
  Award,
  Download,
  Printer,
  Send,
  Save,
  CheckCircle,
  AlertTriangle,
  Users,
  GraduationCap,
  FileSpreadsheet,
  Search,
  Sparkles,
  Edit3,
  Building2,
  Calendar,
} from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const GRADE_COLOR = {
  'A+': 'green',
  A: 'green',
  B: 'blue',
  C: 'yellow',
  D: 'yellow',
  F: 'red',
};

export default function GradesPage() {
  const { isStudent, isAdmin, isTeacher, isParent, user } = useAuthStore();
  const qc = useQueryClient();
  const isStaffMember = isTeacher() || isAdmin();

  // Selection states for Teacher/Admin roster view
  const [rosterViewMode, setRosterViewMode] = useState('MASTER'); // 'MASTER' | 'SUBJECT'
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);

  // Edit / Input marks state: Map of studentProfileId -> { continuousAssessment, finalExam, remarks, isAbsent }
  const [editedScores, setEditedScores] = useState({});
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');

  // ── Fetch Terms ──────────────────────────────────────────────
  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => api.get('/academics/terms').then((r) => r.data.data),
  });

  const currentTerm = terms?.find((t) => t.isCurrent) || terms?.[0];
  const activeTermId = selectedTermId || currentTerm?.id;

  // ── Fetch Teacher's Assigned Classes & Subjects ───────────────
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: () => api.get('/academics/teacher-assignments').then((r) => r.data.data),
    enabled: isStaffMember,
  });

  const assignedClasses = assignmentsData?.classes ?? [];
  const assignedSubjects = assignmentsData?.subjects ?? [];

  // Auto-select defaults once loaded
  useMemo(() => {
    if (assignedClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(assignedClasses[0].id);
    }
    if (assignedSubjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(assignedSubjects[0].id);
    }
  }, [assignedClasses, assignedSubjects, selectedClassId, selectedSubjectId]);

  const activeClassId = selectedClassId || assignedClasses?.[0]?.id;
  const activeSubjectId = selectedSubjectId || assignedSubjects?.[0]?.id;

  // ── Fetch Single Subject Roster ───────────────────────────────
  const {
    data: rosterData,
    isLoading: rosterLoading,
    isFetching: rosterFetching,
  } = useQuery({
    queryKey: ['class-roster', activeClassId, activeSubjectId, activeTermId],
    queryFn: () =>
      api
        .get(
          `/academics/roster?classId=${activeClassId}&subjectId=${activeSubjectId}&termId=${activeTermId}`
        )
        .then((r) => r.data.data),
    enabled: isStaffMember && rosterViewMode === 'SUBJECT' && !!activeClassId && !!activeTermId,
  });

  // ── Fetch Master Multi-Subject Cumulative Class Roster ─────────
  const {
    data: masterRosterData,
    isLoading: masterRosterLoading,
    isFetching: masterRosterFetching,
  } = useQuery({
    queryKey: ['master-roster', activeClassId, activeTermId],
    queryFn: () =>
      api
        .get(`/academics/master-roster?classId=${activeClassId}&termId=${activeTermId}`)
        .then((r) => r.data.data),
    enabled: isStaffMember && !!activeClassId && !!activeTermId,
  });

  // ── Fetch Parent's Linked Children (if parent role) ─────────
  const [selectedChildId, setSelectedChildId] = useState('');
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

  // ── Fetch Student / Child Personal Results ───────────────────
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
    enabled: (isStudent() || (isParent() && !!activeStudentQueryId)) && !!activeTermId,
  });

  // ── Save Scores Mutation ──────────────────────────────────────
  const saveRosterMutation = useMutation({
    mutationFn: (recordsToSave) =>
      api.post('/academics/roster', {
        classId: activeClassId,
        subjectId: activeSubjectId,
        termId: activeTermId,
        records: recordsToSave,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-roster'] });
      qc.invalidateQueries({ queryKey: ['master-roster'] });
      toast.success('Student examination & assessment results saved successfully!');
      setEditedScores({});
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save student marks');
    },
  });

  // ── Submit Roster to Administration Mutation ──────────────────
  const submitToAdminMutation = useMutation({
    mutationFn: (notes) =>
      api.post('/academics/roster/submit', {
        classId: activeClassId,
        subjectId: activeSubjectId,
        termId: activeTermId,
        notes,
      }),
    onSuccess: () => {
      toast.success('Class result sheet submitted to School Administration!');
      setSubmitModalOpen(false);
      setSubmissionNotes('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to submit report');
    },
  });

  // ── Distribute Report Cards Mutation ──────────────────────────
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

  // ── Handle Inline Mark Changes ────────────────────────────────
  const handleScoreChange = (studentProfileId, field, value) => {
    setEditedScores((prev) => {
      const current = prev[studentProfileId] || {};
      const numVal =
        value === ''
          ? null
          : Math.max(0, Math.min(field === 'continuousAssessment' ? 60 : 40, Number(value)));
      return {
        ...prev,
        [studentProfileId]: {
          ...current,
          [field]: numVal,
        },
      };
    });
  };

  const handleRemarkChange = (studentProfileId, value) => {
    setEditedScores((prev) => {
      const current = prev[studentProfileId] || {};
      return {
        ...prev,
        [studentProfileId]: {
          ...current,
          remarks: value,
        },
      };
    });
  };

  const handleSaveAll = () => {
    const rawStudents = rosterData?.students ?? [];
    const payload = rawStudents.map((s) => {
      const edited = editedScores[s.studentProfileId] || {};
      return {
        studentProfileId: s.studentProfileId,
        continuousAssessment:
          edited.continuousAssessment !== undefined
            ? edited.continuousAssessment
            : s.continuousAssessment,
        finalExam: edited.finalExam !== undefined ? edited.finalExam : s.finalExam,
        remarks: edited.remarks !== undefined ? edited.remarks : s.remarks,
        isAbsent: edited.isAbsent !== undefined ? edited.isAbsent : s.isAbsent,
      };
    });

    saveRosterMutation.mutate(payload);
  };

  // ── Export Single Subject CSV Roster ──────────────────────────
  const handleExportCSV = () => {
    if (!rosterData || !rosterData.students?.length) {
      toast.error('No roster data to export');
      return;
    }

    const headers = [
      'Roll No',
      'Admission No',
      'Student Name',
      'Age',
      'Gender',
      'Continuous Assessment (60)',
      'Final Exam (40)',
      'Total (100)',
      'Grade',
      'GPA',
      'Remarks',
    ];

    const rows = rosterData.students.map((s) => {
      const edited = editedScores[s.studentProfileId] || {};
      const ca =
        edited.continuousAssessment !== undefined
          ? edited.continuousAssessment
          : s.continuousAssessment;
      const fn = edited.finalExam !== undefined ? edited.finalExam : s.finalExam;
      const total = ca !== null || fn !== null ? (ca ?? 0) + (fn ?? 0) : '—';
      const grade = s.grade || '—';
      const gpa = s.gpa ?? '—';
      const rem = edited.remarks !== undefined ? edited.remarks : s.remarks || '—';

      return [
        s.rollNumber,
        s.admissionNumber || '',
        `"${s.fullName}"`,
        s.age ?? '—',
        s.gender || '—',
        ca !== null ? ca : '—',
        fn !== null ? fn : '—',
        total,
        grade,
        gpa,
        `"${rem}"`,
      ].join(',');
    });

    const csvContent =
      `data:text/csv;charset=utf-8,` +
      `"School: ${rosterData.school?.name ?? 'TimhirtHub School'}"\n` +
      `"Class: ${rosterData.class?.name ?? ''} | Subject: ${rosterData.subject?.name ?? ''} | Term: ${rosterData.term?.name ?? ''}"\n\n` +
      [headers.join(','), ...rows].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `roster-${rosterData.class?.name}-${rosterData.subject?.name}-${rosterData.term?.name}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Roster exported to CSV');
  };

  // ── Export Master Cumulative CSV ──────────────────────────────
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

  // Filter students for Single Subject view
  const filteredStudents = useMemo(() => {
    const raw = rosterData?.students ?? [];
    return raw.filter((s) => {
      const matchesSearch =
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.admissionNumber && s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      const edited = editedScores[s.studentProfileId];
      const caVal =
        edited?.continuousAssessment !== undefined
          ? edited.continuousAssessment
          : s.continuousAssessment;
      const fnVal = edited?.finalExam !== undefined ? edited.finalExam : s.finalExam;
      const isMissing = caVal === null || fnVal === null;

      if (filterMissingOnly && !isMissing) return false;
      return matchesSearch;
    });
  }, [rosterData, searchQuery, filterMissingOnly, editedScores]);

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

  // Overall Statistics for Teacher Single-Subject Roster
  const rosterStats = useMemo(() => {
    const students = rosterData?.students ?? [];
    if (!students.length) return null;

    let totalScoreSum = 0;
    let gradedCount = 0;
    let passCount = 0;
    let missingCount = 0;

    students.forEach((s) => {
      const edited = editedScores[s.studentProfileId];
      const ca =
        edited?.continuousAssessment !== undefined
          ? edited.continuousAssessment
          : s.continuousAssessment;
      const fn = edited?.finalExam !== undefined ? edited.finalExam : s.finalExam;

      if (ca !== null && fn !== null) {
        const total = ca + fn;
        totalScoreSum += total;
        gradedCount++;
        if (total >= 50) passCount++;
      } else {
        missingCount++;
      }
    });

    const classAverage = gradedCount > 0 ? Math.round(totalScoreSum / gradedCount) : 0;
    const passRate = gradedCount > 0 ? Math.round((passCount / gradedCount) * 100) : 0;

    return {
      totalStudents: students.length,
      gradedCount,
      missingCount,
      classAverage,
      passRate,
    };
  }, [rosterData, editedScores]);

  // ════════════════════════════════════════════════════════════════
  // 1. TEACHER & ADMIN RESULT ROSTER VIEW
  // ════════════════════════════════════════════════════════════════
  if (isStaffMember) {
    const masterStats = masterRosterData?.stats;
    const masterSubjects = masterRosterData?.subjects ?? [];

    return (
      <div className="space-y-6">
        {/* ── Page Header ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <Award className="w-7 h-7 text-primary-600" />
              Academic Examination & Result Rosters
            </h1>
            <p className="page-subtitle">
              Cumulative master grade sheets, subject marks entry, automatic rankings, and term report card distribution.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {rosterViewMode === 'MASTER' ? (
              <>
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
              </>
            ) : (
              <>
                <button
                  className="btn-secondary inline-flex items-center gap-1.5"
                  onClick={handleExportCSV}
                  disabled={!rosterData?.students?.length}
                  title="Export subject roster as CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export CSV
                </button>
                <button
                  className="btn-secondary inline-flex items-center gap-1.5"
                  onClick={() => window.print()}
                  title="Print official subject result sheet"
                >
                  <Printer className="w-4 h-4 text-gray-600" /> Print Sheet
                </button>
                {isTeacher() && (
                  <button
                    className="btn-secondary inline-flex items-center gap-1.5"
                    onClick={() => setSubmitModalOpen(true)}
                    disabled={!rosterData?.students?.length}
                  >
                    <Send className="w-4 h-4 text-primary-600" /> Submit to Admin
                  </button>
                )}
                <button
                  className="btn-primary inline-flex items-center gap-1.5"
                  onClick={handleSaveAll}
                  disabled={saveRosterMutation.isPending || Object.keys(editedScores).length === 0}
                >
                  <Save className="w-4 h-4" />
                  {saveRosterMutation.isPending ? 'Saving…' : 'Save Marks'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Mode Switcher Tabs ─────────────────────────────────── */}
        <div className="flex gap-2 p-1.5 bg-gray-100/80 rounded-xl max-w-fit border border-gray-200">
          <button
            onClick={() => setRosterViewMode('MASTER')}
            className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-all ${
              rosterViewMode === 'MASTER'
                ? 'bg-white text-primary-700 shadow-xs scale-102'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Master Cumulative Class Roster (All Subjects & Rank)
          </button>
          <button
            onClick={() => setRosterViewMode('SUBJECT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-all ${
              rosterViewMode === 'SUBJECT'
                ? 'bg-white text-primary-700 shadow-xs scale-102'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Edit3 className="w-4 h-4 text-primary-600" />
            Subject Marks Entry (CA 60 & Final 40)
          </button>
        </div>

        {/* ── Filter Bar ─────────────────────────────────────────── */}
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="label flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-primary-600" /> Class & Section *
              </label>
              <select
                className="input"
                value={activeClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setEditedScores({});
                }}
              >
                {assignedClasses.length === 0 && <option value="">No classes found</option>}
                {assignedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {rosterViewMode === 'SUBJECT' && (
              <div>
                <label className="label flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-purple-600" /> Subject to Grade *
                </label>
                <select
                  className="input"
                  value={activeSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setEditedScores({});
                  }}
                >
                  {assignedSubjects.length === 0 && <option value="">No subjects found</option>}
                  {assignedSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Academic Term *
              </label>
              <select
                className="input"
                value={activeTermId}
                onChange={(e) => {
                  setSelectedTermId(e.target.value);
                  setEditedScores({});
                }}
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
              {rosterViewMode === 'MASTER'
                ? `Showing ${filteredMasterStudents.length} students across ${masterSubjects.length} subjects`
                : `Showing ${filteredStudents.length} students`}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            VIEW 1: MASTER MULTI-SUBJECT CUMULATIVE CLASS ROSTER
        ══════════════════════════════════════════════════════════ */}
        {rosterViewMode === 'MASTER' && (
          <div className="space-y-6">
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
                            {/* Rank Badge */}
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

                            {/* Roll Number */}
                            <td className="p-3 text-center font-mono font-bold text-gray-500">
                              {student.rollNumber}
                            </td>

                            {/* Student Name */}
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

                            {/* Gender */}
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

                            {/* Age */}
                            <td className="p-3 text-center text-gray-500 font-mono">
                              {student.age !== null ? `${student.age}` : '—'}
                            </td>

                            {/* Subject Columns */}
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

                            {/* Grand Total */}
                            <td className="p-3 text-center font-mono font-black text-sm bg-purple-50/50 border-x border-gray-200 text-purple-900">
                              {student.totalMarksEarned > 0 ? student.totalMarksEarned : '0'}
                            </td>

                            {/* Average % */}
                            <td className="p-3 text-center font-mono font-bold text-sm bg-emerald-50/50 text-emerald-800">
                              {student.averagePercentage !== null
                                ? `${student.averagePercentage}%`
                                : '—'}
                            </td>

                            {/* GPA */}
                            <td className="p-3 text-center font-mono font-bold text-gray-800 bg-gray-50">
                              {student.averagePercentage !== null ? student.gpa.toFixed(1) : '—'}
                            </td>

                            {/* Overall Grade */}
                            <td className="p-3 text-center bg-gray-50">
                              <Badge variant={GRADE_COLOR[student.overallGrade] ?? 'gray'}>
                                {student.overallGrade}
                              </Badge>
                            </td>

                            {/* Remarks */}
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
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VIEW 2: SINGLE SUBJECT SCORE ENTRY (CA 60 & FINAL 40)
        ══════════════════════════════════════════════════════════ */}
        {rosterViewMode === 'SUBJECT' && (
          <div className="space-y-6">
            {/* Summary Stat Cards */}
            {rosterStats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  label="Total Enrolled"
                  value={rosterStats.totalStudents}
                  color="blue"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Class Average"
                  value={`${rosterStats.classAverage}%`}
                  color={
                    rosterStats.classAverage >= 70
                      ? 'green'
                      : rosterStats.classAverage >= 50
                      ? 'amber'
                      : 'red'
                  }
                />
                <StatCard
                  icon={Award}
                  label="Passing Rate"
                  value={`${rosterStats.passRate}%`}
                  color="green"
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Missing Scores"
                  value={rosterStats.missingCount}
                  color={rosterStats.missingCount > 0 ? 'amber' : 'gray'}
                />
              </div>
            )}

            {/* Single Subject Grade Roster Table */}
            {rosterLoading ? (
              <PageLoader />
            ) : !rosterData?.students?.length ? (
              <div className="card p-12 text-center">
                <EmptyState
                  icon={Users}
                  title="No students found in this class"
                  description="Make sure students are enrolled in the selected class."
                />
              </div>
            ) : (
              <div className="card overflow-hidden border border-gray-200 shadow-sm print:shadow-none print:border-none">
                {/* Official School Result Sheet Header */}
                <div className="bg-gradient-to-r from-gray-50 to-primary-50/20 p-5 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-lg text-gray-900 leading-tight">
                          {rosterData.school?.name || 'TimhirtHub Academy'}
                        </h2>
                        <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mt-0.5">
                          Student Continuous Assessment & Examination Result Roster
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs text-gray-600 bg-white/80 p-3 rounded-lg border border-gray-200">
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase">Class / Grade</span>
                        <strong className="text-gray-900">
                          {rosterData.class?.name} ({rosterData.class?.gradeLevel?.name || 'Standard'})
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase">Subject</span>
                        <strong className="text-gray-900">{rosterData.subject?.name}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase">Academic Term</span>
                        <strong className="text-gray-900">{rosterData.term?.name}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase">Subject Teacher</span>
                        <span className="text-gray-900">
                          {rosterData.class?.classTeacher
                            ? `${rosterData.class.classTeacher.firstName} ${rosterData.class.classTeacher.lastName}`
                            : user?.firstName
                            ? `${user.firstName} ${user.lastName}`
                            : 'Teacher Assigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase">Academic Year</span>
                        <span className="text-gray-900 font-mono">{rosterData.class?.academicYear}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase">Total Students</span>
                        <span className="text-gray-900 font-bold">{rosterData.students.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Roster Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100/80 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                        <th className="p-3 w-12 text-center">Roll</th>
                        <th className="p-3 min-w-44">Student Name</th>
                        <th className="p-3 w-16 text-center">Age</th>
                        <th className="p-3 w-20 text-center">Gender</th>
                        <th className="p-3 min-w-32 text-center bg-blue-50/50 border-x border-gray-200">
                          <div>Cont. Assess.</div>
                          <span className="text-[10px] font-normal text-blue-600">(Max 60)</span>
                        </th>
                        <th className="p-3 min-w-32 text-center bg-purple-50/50 border-r border-gray-200">
                          <div>Final Exam</div>
                          <span className="text-[10px] font-normal text-purple-600">(Max 40)</span>
                        </th>
                        <th className="p-3 w-24 text-center bg-gray-50">
                          <div>Total Score</div>
                          <span className="text-[10px] font-normal text-gray-500">(100%)</span>
                        </th>
                        <th className="p-3 w-16 text-center">Grade</th>
                        <th className="p-3 w-20 text-center">GPA</th>
                        <th className="p-3 min-w-40">Remarks / Evaluation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-xs bg-white">
                      {filteredStudents.map((student) => {
                        const edited = editedScores[student.studentProfileId] || {};
                        const caValue =
                          edited.continuousAssessment !== undefined
                            ? edited.continuousAssessment
                            : student.continuousAssessment;
                        const finalValue =
                          edited.finalExam !== undefined ? edited.finalExam : student.finalExam;
                        const remarksValue =
                          edited.remarks !== undefined ? edited.remarks : student.remarks;

                        const hasCA = caValue !== null && caValue !== undefined;
                        const hasFinal = finalValue !== null && finalValue !== undefined;
                        const totalScore = hasCA || hasFinal ? (caValue ?? 0) + (finalValue ?? 0) : null;
                        const percentage = totalScore !== null ? Math.round((totalScore / 100) * 100) : null;

                        let liveGrade = '—';
                        let liveGpa = 0.0;
                        let liveStatus = '—';

                        if (percentage !== null) {
                          if (percentage >= 90) { liveGrade = 'A+'; liveGpa = 4.0; liveStatus = 'Distinction'; }
                          else if (percentage >= 80) { liveGrade = 'A'; liveGpa = 3.7; liveStatus = 'Excellent'; }
                          else if (percentage >= 70) { liveGrade = 'B'; liveGpa = 3.3; liveStatus = 'Very Good'; }
                          else if (percentage >= 60) { liveGrade = 'C'; liveGpa = 2.7; liveStatus = 'Good'; }
                          else if (percentage >= 50) { liveGrade = 'D'; liveGpa = 2.0; liveStatus = 'Pass'; }
                          else { liveGrade = 'F'; liveGpa = 0.0; liveStatus = 'Needs Help / Fail'; }
                        }

                        const isRowMissing = !hasCA || !hasFinal;
                        const isDirty =
                          edited.continuousAssessment !== undefined ||
                          edited.finalExam !== undefined ||
                          edited.remarks !== undefined;

                        return (
                          <tr
                            key={student.studentProfileId}
                            className={`hover:bg-gray-50/70 transition-colors ${
                              isDirty ? 'bg-amber-50/30' : isRowMissing ? 'bg-red-50/20' : ''
                            }`}
                          >
                            <td className="p-3 text-center font-mono font-bold text-gray-500">
                              {student.rollNumber}
                            </td>

                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                  {student.firstName[0]}
                                  {student.lastName[0]}
                                </div>
                                <div>
                                  <span className="font-bold text-gray-900 block">
                                    {student.fullName}
                                  </span>
                                  {student.admissionNumber && (
                                    <span className="text-[10px] text-gray-400 font-mono">
                                      Adm: {student.admissionNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="p-3 text-center text-gray-600 font-mono">
                              {student.age !== null ? `${student.age} yrs` : '—'}
                            </td>

                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  student.gender === 'FEMALE'
                                    ? 'bg-pink-100 text-pink-700'
                                    : student.gender === 'MALE'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {student.gender || '—'}
                              </span>
                            </td>

                            <td className="p-2 text-center bg-blue-50/30 border-x border-gray-200">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="60"
                                  step="0.5"
                                  placeholder="0–60"
                                  value={caValue !== null && caValue !== undefined ? caValue : ''}
                                  onChange={(e) =>
                                    handleScoreChange(
                                      student.studentProfileId,
                                      'continuousAssessment',
                                      e.target.value
                                    )
                                  }
                                  className={`input py-1 px-2 text-center text-sm font-mono font-bold w-20 ${
                                    caValue === null ? 'border-amber-400 bg-amber-50' : 'bg-white'
                                  }`}
                                />
                                <span className="text-[11px] text-gray-400 font-mono">/60</span>
                              </div>
                            </td>

                            <td className="p-2 text-center bg-purple-50/30 border-r border-gray-200">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="40"
                                  step="0.5"
                                  placeholder="0–40"
                                  value={finalValue !== null && finalValue !== undefined ? finalValue : ''}
                                  onChange={(e) =>
                                    handleScoreChange(
                                      student.studentProfileId,
                                      'finalExam',
                                      e.target.value
                                    )
                                  }
                                  className={`input py-1 px-2 text-center text-sm font-mono font-bold w-20 ${
                                    finalValue === null ? 'border-amber-400 bg-amber-50' : 'bg-white'
                                  }`}
                                />
                                <span className="text-[11px] text-gray-400 font-mono">/40</span>
                              </div>
                            </td>

                            <td className="p-3 text-center bg-gray-50">
                              <span className="font-mono font-bold text-sm text-gray-900">
                                {totalScore !== null ? totalScore : '—'}
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              <Badge variant={GRADE_COLOR[liveGrade] ?? 'gray'}>{liveGrade}</Badge>
                            </td>

                            <td className="p-3 text-center font-mono font-semibold text-gray-700">
                              {percentage !== null ? liveGpa.toFixed(1) : '—'}
                            </td>

                            <td className="p-2">
                              <input
                                placeholder="Teacher remark…"
                                value={remarksValue || ''}
                                onChange={(e) =>
                                  handleRemarkChange(student.studentProfileId, e.target.value)
                                }
                                className="input py-1 px-2 text-xs w-full"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="text-gray-500 flex items-center gap-2">
                    <span>
                      Showing {filteredStudents.length} of {rosterData.students.length} students
                    </span>
                    {Object.keys(editedScores).length > 0 && (
                      <span className="font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {Object.keys(editedScores).length} unsaved changes
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn-primary"
                      onClick={handleSaveAll}
                      disabled={saveRosterMutation.isPending || Object.keys(editedScores).length === 0}
                    >
                      <Save className="w-4 h-4" />
                      {saveRosterMutation.isPending ? 'Saving…' : 'Save All Changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Distribute Report Cards Modal ───────────────────────── */}
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

        {/* ── Submit to Admin Modal ───────────────────────────────── */}
        <Modal
          open={submitModalOpen}
          onClose={() => setSubmitModalOpen(false)}
          title="Submit Grade Roster to School Administration"
          size="md"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setSubmitModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary inline-flex items-center gap-1.5"
                onClick={() => submitToAdminMutation.mutate(submissionNotes)}
                disabled={submitToAdminMutation.isPending}
              >
                <Send className="w-4 h-4" />
                {submitToAdminMutation.isPending ? 'Submitting…' : 'Confirm Submission'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-600">
              You are about to submit the continuous assessment and examination results for{' '}
              <strong>
                Class {rosterData?.class?.name} — {rosterData?.subject?.name}
              </strong>{' '}
              ({rosterData?.term?.name}) to the administration for official approval and report card generation.
            </p>

            {rosterStats?.missingCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Warning:</strong> {rosterStats.missingCount} students currently have missing continuous assessment or final exam marks.
                </span>
              </div>
            )}

            <div>
              <label className="label">Submission Notes / Teacher Comments (Optional)</label>
              <textarea
                className="input min-h-20 resize-none text-xs"
                placeholder="Add any context, general performance observations, or remarks for the school principal/dean…"
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 2. STUDENT / PARENT VIEW
  // ════════════════════════════════════════════════════════════════
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

          {(isStudent() || isParent()) && (
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
          )}
        </div>
      </div>

      {/* ── Parent Child Switcher Banner ── */}
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

      {studentResultsLoading ? (
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

