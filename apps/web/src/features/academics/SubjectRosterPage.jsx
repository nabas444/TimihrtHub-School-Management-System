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
  Save,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  Search,
  Building2,
  Calendar,
  Printer,
} from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import { GRADE_COLOR } from './gradesConstants';
import toast from 'react-hot-toast';

export default function SubjectRosterPage() {
  const { user, isTeacher } = useAuthStore();
  const qc = useQueryClient();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);

  // Edit / Input marks state: Map of studentProfileId -> { continuousAssessment, finalExam, remarks, isAbsent }
  const [editedScores, setEditedScores] = useState({});
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');

  // Fetch Terms
  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => api.get('/academics/terms').then((r) => r.data.data),
  });

  const currentTerm = terms?.find((t) => t.isCurrent) || terms?.[0];
  const activeTermId = selectedTermId || currentTerm?.id;

  // Fetch Teacher's Assigned Classes & Subjects
  const { data: assignmentsData } = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: () => api.get('/academics/teacher-assignments').then((r) => r.data.data),
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

  // Fetch Single Subject Roster
  const {
    data: rosterData,
    isLoading: rosterLoading,
  } = useQuery({
    queryKey: ['class-roster', activeClassId, activeSubjectId, activeTermId],
    queryFn: () =>
      api
        .get(
          `/academics/roster?classId=${activeClassId}&subjectId=${activeSubjectId}&termId=${activeTermId}`
        )
        .then((r) => r.data.data),
    enabled: !!activeClassId && !!activeTermId,
  });

  // Save Scores Mutation
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

  // Submit Roster to Administration Mutation
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

  // Handle Inline Mark Changes
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

  // Export Single Subject CSV
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
      const fn =
        edited?.finalExam !== undefined ? edited.finalExam : s.finalExam;

      const hasBoth = ca !== null && ca !== undefined && fn !== null && fn !== undefined;
      if (hasBoth) {
        const total = ca + fn;
        totalScoreSum += total;
        gradedCount += 1;
        if (total >= 50) passCount += 1;
      } else {
        missingCount += 1;
      }
    });

    const totalStudents = students.length;
    const classAverage = gradedCount > 0 ? Math.round((totalScoreSum / gradedCount) * 10) / 10 : 0;
    const passRate = gradedCount > 0 ? Math.round((passCount / gradedCount) * 100) : 0;

    return {
      totalStudents,
      gradedCount,
      missingCount,
      classAverage,
      passRate,
    };
  }, [rosterData, editedScores]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-primary-600" />
            Subject Mark Entry Roster
          </h1>
          <p className="page-subtitle">
            Enter continuous assessment (CA 60) and final exam (40) scores, edit grades inline, and submit result sheets.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>

      {/* Filter Bar */}
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
            Showing {filteredStudents.length} students
          </span>
        </div>
      </div>

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

                  if (percentage !== null) {
                    if (percentage >= 90) { liveGrade = 'A+'; liveGpa = 4.0; }
                    else if (percentage >= 80) { liveGrade = 'A'; liveGpa = 3.7; }
                    else if (percentage >= 70) { liveGrade = 'B'; liveGpa = 3.3; }
                    else if (percentage >= 60) { liveGrade = 'C'; liveGpa = 2.7; }
                    else if (percentage >= 50) { liveGrade = 'D'; liveGpa = 2.0; }
                    else { liveGrade = 'F'; liveGpa = 0.0; }
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

      {/* Submit to Admin Modal */}
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
