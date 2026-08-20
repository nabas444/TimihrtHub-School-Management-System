import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Download,
  RotateCw,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Send,
  GraduationCap,
  Users,
  Award,
  Layers,
  Check,
  ChevronDown,
  X,
  Printer,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import { Avatar, Badge, EmptyState } from "../../components/ui/index";
import PageLoader from "../../components/ui/PageLoader";
import Modal from "../../components/ui/Modal";
import ReportCardModernTemplate from "./components/ReportCardModernTemplate";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function ReportCardsPage() {
  const queryClient = useQueryClient();

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("2024/2025");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | PASSING | AT_RISK | PUBLISHED | DRAFT

  // Modals state
  const [previewStudent, setPreviewStudent] = useState(null);
  const [activePreviewTab, setActivePreviewTab] = useState("template"); // template | breakdown | customizer
  const [pdfDownloadStudent, setPdfDownloadStudent] = useState(null);
  const [selectedPdfLayout, setSelectedPdfLayout] = useState("ONE_SIDED"); // ONE_SIDED | TWO_SIDED
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Template Customizer State
  const [templatePrimaryColor, setTemplatePrimaryColor] = useState("#0D1B2A");
  const [templateAccentColor, setTemplateAccentColor] = useState("#7CB342");
  const [templateTeacherFeedback, setTemplateTeacherFeedback] = useState(
    "Demonstrates exemplary scholarly discipline, active participation, and outstanding mastery of core academic subjects."
  );
  const [templateTeacherName, setTemplateTeacherName] = useState("Mr. Daniel Tesfaye");
  const [templateTotalDays, setTemplateTotalDays] = useState(180);
  const [templateAttendedDays, setTemplateAttendedDays] = useState(176);
  const [templateAbsentDays, setTemplateAbsentDays] = useState(4);
  const [templateShowPencil, setTemplateShowPencil] = useState(true);

  // ── 1. Fetch School Settings & Academic Info ─────────────────────────────
  const { data: schoolInfo } = useQuery({
    queryKey: ["school-settings"],
    queryFn: () => api.get("/schools/settings").then((r) => r.data.data),
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data ?? []),
  });

  // Default to first class if none selected
  const activeClassId = selectedClassId || classesData?.[0]?.id || "";
  const currentAcademicYear =
    selectedAcademicYear || schoolInfo?.academicYear || "2024/2025";

  // ── 2. Fetch Class Report Cards Roster ────────────────────────────────────
  const {
    data: classRosterData,
    isLoading: rosterLoading,
    refetch: refetchRoster,
  } = useQuery({
    queryKey: [
      "academic-year-summaries-class",
      activeClassId,
      currentAcademicYear,
    ],
    queryFn: () =>
      api
        .get(
          `/academic-year-summaries/class/${activeClassId}?academicYear=${encodeURIComponent(
            currentAcademicYear,
          )}`,
        )
        .then((r) => r.data.data),
    enabled: !!activeClassId,
  });

  // ── 3. Generate / Refresh Summaries Mutation ──────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/academic-year-summaries/generate", {
        classId: activeClassId,
        academicYear: currentAcademicYear,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Generated annual summaries for ${data.data?.total || 0} students`,
      );
      queryClient.invalidateQueries({
        queryKey: ["academic-year-summaries-class", activeClassId],
      });
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.message || "Failed to generate summaries",
      );
    },
  });

  // ── 4. Publish / Unpublish Mutation ───────────────────────────────────────
  const publishMutation = useMutation({
    mutationFn: async ({ summaryId, isPublished }) => {
      const res = await api.patch(
        `/academic-year-summaries/${summaryId}/publish`,
        { isPublished },
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.isPublished
          ? "Report card published and students notified"
          : "Report card unpublished",
      );
      queryClient.invalidateQueries({
        queryKey: ["academic-year-summaries-class", activeClassId],
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update publish status");
    },
  });

  // ── 5. Bulk Publish All Mutation ─────────────────────────────────────────
  const [publishingAll, setPublishingAll] = useState(false);
  const handlePublishAll = async () => {
    const unpublished = (classRosterData?.students || []).filter(
      (s) => s.summary && !s.summary.isPublished,
    );
    if (unpublished.length === 0) {
      toast.error("No unpublished summaries to publish in this class");
      return;
    }

    try {
      setPublishingAll(true);
      await Promise.all(
        unpublished.map((s) =>
          api.patch(`/academic-year-summaries/${s.summary.id}/publish`, {
            isPublished: true,
          }),
        ),
      );
      toast.success(`Published report cards for ${unpublished.length} students`);
      queryClient.invalidateQueries({
        queryKey: ["academic-year-summaries-class", activeClassId],
      });
    } catch (err) {
      toast.error("Some report cards could not be published");
    } finally {
      setPublishingAll(false);
    }
  };

  // ── 6. Handle PDF Download ────────────────────────────────────────────────
  const handleDownloadPdf = async (student, layout = selectedPdfLayout) => {
    try {
      setDownloadingPdf(true);
      const url = `/report-cards/${student.studentProfileId}/pdf?academicYear=${encodeURIComponent(
        currentAcademicYear,
      )}&layout=${layout}`;
      const safeName = student.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const filename = `report-card-${safeName}-${currentAcademicYear.replace(
        "/",
        "-",
      )}.pdf`;

      await downloadFile(url, filename);
      toast.success("Report card PDF downloaded");
      setPdfDownloadStudent(null);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to generate report card PDF",
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ── 7. Filtering & Statistics ─────────────────────────────────────────────
  const rawStudents = classRosterData?.students ?? [];

  const filteredStudents = useMemo(() => {
    return rawStudents.filter((s) => {
      // Search
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.admissionNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNumber?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === "PASSING") return s.summary?.isPassing === true;
      if (statusFilter === "AT_RISK")
        return s.summary && s.summary.isPassing === false;
      if (statusFilter === "PUBLISHED")
        return s.summary?.isPublished === true;
      if (statusFilter === "DRAFT")
        return !s.summary || s.summary.isPublished === false;

      return true;
    });
  }, [rawStudents, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = rawStudents.length;
    const generated = rawStudents.filter((s) => s.summary !== null).length;
    const published = rawStudents.filter((s) => s.summary?.isPublished).length;
    const passing = rawStudents.filter((s) => s.summary?.isPassing).length;
    const passingRate =
      generated > 0 ? Math.round((passing / generated) * 100) : 0;

    return { total, generated, published, passingRate };
  }, [rawStudents]);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary-600" />
            Annual Report Cards & Cumulative Summaries
          </h1>
          <p className="page-subtitle">
            Generate, rank, verify, and publish cumulative academic year report cards for classes.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const demoStudent = rawStudents[0] || {
                id: "demo",
                name: "Abebe Kebede Girma",
                admissionNumber: "ADM-2024-001",
                summary: {
                  overallAverage: 92.4,
                  overallRank: 1,
                  isPassing: true,
                },
              };
              setPreviewStudent(demoStudent);
              setActivePreviewTab("template");
            }}
            className="btn-secondary inline-flex items-center gap-2 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Official Report Card Template
          </button>

          <button
            onClick={() => generateMutation.mutate()}
            disabled={!activeClassId || generateMutation.isPending}
            className="btn-primary inline-flex items-center gap-2 shadow-sm"
          >
            <RotateCw
              className={clsx(
                "w-4 h-4",
                generateMutation.isPending && "animate-spin",
              )}
            />
            {generateMutation.isPending
              ? "Calculating Summaries…"
              : "Generate / Refresh Summaries"}
          </button>

          <button
            onClick={handlePublishAll}
            disabled={publishingAll || stats.generated === 0}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4 text-emerald-600" />
            {publishingAll ? "Publishing All…" : "Publish All in Class"}
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Class Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Select Class
            </label>
            <select
              value={activeClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="input w-full"
            >
              {(classesData ?? []).map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} {cls.gradeLevel ? `(${cls.gradeLevel.name})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Academic Year
            </label>
            <select
              value={currentAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="input w-full"
            >
              <option value="2024/2025">2024 / 2025</option>
              <option value="2025/2026">2025 / 2026</option>
              <option value="2026/2027">2026 / 2027</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Search Student
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Name, Adm #, Roll #…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 w-full"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Standing / Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-full"
            >
              <option value="ALL">All Students ({rawStudents.length})</option>
              <option value="PASSING">Passing / Promoted</option>
              <option value="AT_RISK">At Risk / Retained</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft / Unpublished</option>
            </select>
          </div>
        </div>

        {/* ── Summary Stats Pills ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Users className="w-5 h-5 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500 font-medium">Class Roster</p>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {stats.total} students
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40">
            <Layers className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="text-xs text-indigo-700 font-medium">Summaries</p>
              <p className="text-base font-bold text-indigo-900 dark:text-indigo-200">
                {stats.generated} / {stats.total}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-xs text-emerald-700 font-medium">Pass Rate</p>
              <p className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                {stats.passingRate}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40">
            <Award className="w-5 h-5 text-sky-600" />
            <div>
              <p className="text-xs text-sky-700 font-medium">Published</p>
              <p className="text-base font-bold text-sky-900 dark:text-sky-200">
                {stats.published} / {stats.generated}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Students Table ── */}
      {rosterLoading ? (
        <PageLoader />
      ) : filteredStudents.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={FileText}
            title="No report cards matching filter"
            description="Generate summaries for this class or change your search filter."
            action={
              <button
                onClick={() => generateMutation.mutate()}
                className="btn-primary inline-flex items-center gap-2 mt-4"
              >
                <RotateCw className="w-4 h-4" /> Generate Summaries Now
              </button>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Admission #</th>
                  <th>Term Breakdown</th>
                  <th className="text-center">Overall Average</th>
                  <th className="text-center">Rank</th>
                  <th className="text-center">Standing</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredStudents.map((student) => {
                  const summary = student.summary;
                  const termList = Array.isArray(summary?.termBreakdown)
                    ? summary.termBreakdown
                    : [];

                  return (
                    <tr
                      key={student.studentProfileId}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      {/* Student Info */}
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={student.avatar}
                            alt={student.name}
                            fallback={student.name?.[0]}
                            size="sm"
                          />
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              {student.name}
                            </p>
                            {student.rollNumber && (
                              <p className="text-xs text-gray-400">
                                Roll #{student.rollNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Admission Number */}
                      <td className="text-xs font-mono text-gray-600 dark:text-gray-300">
                        {student.admissionNumber || "—"}
                      </td>

                      {/* Term Breakdown Pills */}
                      <td>
                        {termList.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {termList.map((t, idx) => (
                              <span
                                key={t.termId || idx}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                title={`${t.termName}: GPA ${t.gpa ?? "—"}, Rank #${t.rank ?? "—"}`}
                              >
                                {t.termName?.slice(0, 6)}:{" "}
                                <strong className="font-bold">
                                  {t.percentage != null
                                    ? `${Math.round(t.percentage)}%`
                                    : "—"}
                                </strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            No term reports
                          </span>
                        )}
                      </td>

                      {/* Overall Average */}
                      <td className="text-center font-bold text-sm">
                        {summary?.overallAverage != null ? (
                          <span
                            className={clsx(
                              summary.overallAverage >= 50
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {summary.overallAverage.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">—</span>
                        )}
                      </td>

                      {/* Class Rank */}
                      <td className="text-center">
                        {summary?.overallRank != null ? (
                          <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-full text-xs font-extrabold bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                            #{summary.overallRank}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Standing (Pass / Fail) */}
                      <td className="text-center">
                        {summary ? (
                          <Badge
                            variant={summary.isPassing ? "success" : "danger"}
                            size="sm"
                          >
                            {summary.isPassing ? "PASSED" : "RETAINED"}
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            UNRECORDED
                          </Badge>
                        )}
                      </td>

                      {/* Published Status */}
                      <td className="text-center">
                        {summary?.isPublished ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Published
                          </span>
                        ) : summary ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            Draft
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Per-row Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Preview Button */}
                          <button
                            onClick={() => setPreviewStudent(student)}
                            disabled={!summary}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-30"
                            title="Preview Report Card"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download PDF Button */}
                          <button
                            onClick={() => setPdfDownloadStudent(student)}
                            disabled={!summary}
                            className="p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-950 text-primary-600 dark:text-primary-400 transition-colors disabled:opacity-30"
                            title="Download PDF Report Card"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Publish / Unpublish Toggle */}
                          {summary && (
                            <button
                              onClick={() =>
                                publishMutation.mutate({
                                  summaryId: summary.id,
                                  isPublished: !summary.isPublished,
                                })
                              }
                              disabled={publishMutation.isPending}
                              className={clsx(
                                "px-2.5 py-1 rounded text-xs font-semibold transition-colors",
                                summary.isPublished
                                  ? "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs",
                              )}
                              title={
                                summary.isPublished
                                  ? "Unpublish report card"
                                  : "Publish report card to student & parent"
                              }
                            >
                              {summary.isPublished ? "Unpublish" : "Publish"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PREVIEW REPORT CARD MODAL ── */}
      {previewStudent && (
        <Modal
          isOpen={!!previewStudent}
          onClose={() => setPreviewStudent(null)}
          title={`Report Card — ${previewStudent.name}`}
          size="xl"
        >
          <div className="space-y-4">
            {/* Modal Tabs Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
              <div className="flex gap-2">
                {[
                  { id: "template", label: "Official Document Template" },
                  { id: "breakdown", label: "Performance Summary" },
                  { id: "customizer", label: "Customize Template" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActivePreviewTab(tab.id)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      activePreviewTab === tab.id
                        ? "bg-primary-600 text-white shadow-xs"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Print Action */}
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary text-xs inline-flex items-center gap-1.5 py-1 px-3 shadow-xs"
                title="Print Official Document"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>

            {/* TAB 1: OFFICIAL TEMPLATE */}
            {activePreviewTab === "template" && (
              <div className="overflow-x-auto p-2 bg-gray-100/70 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800">
                <ReportCardModernTemplate
                  schoolName={schoolInfo?.name || "Demo International School"}
                  schoolLogo={schoolInfo?.logo}
                  studentName={previewStudent.name}
                  classSection={classRosterData?.class?.name || "Grade 10 - Section A"}
                  schoolYear={currentAcademicYear}
                  teacherName={templateTeacherName}
                  primaryColor={templatePrimaryColor}
                  accentColor={templateAccentColor}
                  teacherFeedback={templateTeacherFeedback}
                  showPencil={templateShowPencil}
                  attendance={{
                    totalDays: templateTotalDays,
                    attended: templateAttendedDays,
                    absent: templateAbsentDays,
                  }}
                  termsGrades={{
                    q1: previewStudent.summary?.termBreakdown?.[0]?.percentage != null
                      ? `${Math.round(previewStudent.summary.termBreakdown[0].percentage)}%`
                      : "88%",
                    q2: previewStudent.summary?.termBreakdown?.[1]?.percentage != null
                      ? `${Math.round(previewStudent.summary.termBreakdown[1].percentage)}%`
                      : "91%",
                    q3: previewStudent.summary?.termBreakdown?.[2]?.percentage != null
                      ? `${Math.round(previewStudent.summary.termBreakdown[2].percentage)}%`
                      : "90%",
                    q4: previewStudent.summary?.termBreakdown?.[3]?.percentage != null
                      ? `${Math.round(previewStudent.summary.termBreakdown[3].percentage)}%`
                      : "93%",
                    avg1: previewStudent.summary?.termBreakdown?.[0]?.gpa != null
                      ? Number(previewStudent.summary.termBreakdown[0].gpa).toFixed(2)
                      : "3.80",
                    avg2: previewStudent.summary?.termBreakdown?.[1]?.gpa != null
                      ? Number(previewStudent.summary.termBreakdown[1].gpa).toFixed(2)
                      : "3.92",
                    avg3: previewStudent.summary?.termBreakdown?.[2]?.gpa != null
                      ? Number(previewStudent.summary.termBreakdown[2].gpa).toFixed(2)
                      : "3.88",
                    avg4: previewStudent.summary?.termBreakdown?.[3]?.gpa != null
                      ? Number(previewStudent.summary.termBreakdown[3].gpa).toFixed(2)
                      : "3.95",
                  }}
                />
              </div>
            )}

            {/* TAB 2: PERFORMANCE BREAKDOWN */}
            {activePreviewTab === "breakdown" && (
              <div className="space-y-6">
                {/* Header Box */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-primary-900 to-indigo-900 text-white flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-primary-200 font-bold">
                      {schoolInfo?.name || "TimhirtHub Academy"}
                    </p>
                    <h3 className="text-lg font-extrabold">{previewStudent.name}</h3>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      Admission No: {previewStudent.admissionNumber || "—"} | Class:{" "}
                      {classRosterData?.class?.name} | Year: {currentAcademicYear}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-indigo-200">Overall Standing</p>
                    <span
                      className={clsx(
                        "inline-block px-3 py-1 rounded-full text-xs font-extrabold mt-1",
                        previewStudent.summary?.isPassing
                          ? "bg-emerald-500 text-white"
                          : "bg-red-500 text-white",
                      )}
                    >
                      {previewStudent.summary?.isPassing
                        ? "PASSED / PROMOTED"
                        : "RETAINED / UNDER REVIEW"}
                    </span>
                  </div>
                </div>

                {/* Overall Metric Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
                    <p className="text-xs text-gray-500">Cumulative Average</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1">
                      {previewStudent.summary?.overallAverage != null
                        ? `${previewStudent.summary.overallAverage.toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
                    <p className="text-xs text-gray-500">Class Rank</p>
                    <p className="text-xl font-black text-primary-600 mt-1">
                      {previewStudent.summary?.overallRank != null
                        ? `#${previewStudent.summary.overallRank} of ${stats.total}`
                        : "—"}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
                    <p className="text-xs text-gray-500">Terms Recorded</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white mt-1">
                      {Array.isArray(previewStudent.summary?.termBreakdown)
                        ? previewStudent.summary.termBreakdown.length
                        : 0}
                    </p>
                  </div>
                </div>

                {/* Term-by-Term Table */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Term Performance Record
                  </h4>
                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    <table className="table">
                      <thead className="bg-gray-50 dark:bg-gray-800/60">
                        <tr>
                          <th>Term / Semester</th>
                          <th className="text-center">GPA (4.0)</th>
                          <th className="text-center">Percentage</th>
                          <th className="text-center">Term Rank</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {Array.isArray(previewStudent.summary?.termBreakdown) &&
                          previewStudent.summary.termBreakdown.map((t, idx) => (
                            <tr key={idx}>
                              <td className="font-semibold text-gray-800 dark:text-gray-200">
                                {t.termName}
                              </td>
                              <td className="text-center">
                                {t.gpa != null ? Number(t.gpa).toFixed(2) : "—"}
                              </td>
                              <td className="text-center font-bold text-gray-900 dark:text-white">
                                {t.percentage != null
                                  ? `${Number(t.percentage).toFixed(1)}%`
                                  : "—"}
                              </td>
                              <td className="text-center font-medium">
                                {t.rank != null ? `#${t.rank}` : "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TEMPLATE CUSTOMIZER */}
            {activePreviewTab === "customizer" && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Report Card Template Customization
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Primary Color */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Primary Header & Banner Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={templatePrimaryColor}
                        onChange={(e) => setTemplatePrimaryColor(e.target.value)}
                        className="w-9 h-9 rounded cursor-pointer border p-0.5"
                      />
                      <span className="text-xs font-mono">{templatePrimaryColor}</span>
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Accent Curve & Crest Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={templateAccentColor}
                        onChange={(e) => setTemplateAccentColor(e.target.value)}
                        className="w-9 h-9 rounded cursor-pointer border p-0.5"
                      />
                      <span className="text-xs font-mono">{templateAccentColor}</span>
                    </div>
                  </div>

                  {/* Homeroom Teacher */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Homeroom Teacher Name
                    </label>
                    <input
                      type="text"
                      value={templateTeacherName}
                      onChange={(e) => setTemplateTeacherName(e.target.value)}
                      className="input w-full text-xs"
                    />
                  </div>

                  {/* Attendance Controls */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        Total Days
                      </label>
                      <input
                        type="number"
                        value={templateTotalDays}
                        onChange={(e) => setTemplateTotalDays(Number(e.target.value))}
                        className="input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        Attended
                      </label>
                      <input
                        type="number"
                        value={templateAttendedDays}
                        onChange={(e) => setTemplateAttendedDays(Number(e.target.value))}
                        className="input w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        Absent
                      </label>
                      <input
                        type="number"
                        value={templateAbsentDays}
                        onChange={(e) => setTemplateAbsentDays(Number(e.target.value))}
                        className="input w-full text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Teacher's Feedback */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Teacher's Feedback & Comments
                  </label>
                  <textarea
                    rows={2}
                    value={templateTeacherFeedback}
                    onChange={(e) => setTemplateTeacherFeedback(e.target.value)}
                    className="input w-full text-xs"
                  />
                </div>

                {/* Toggle Pencil Graphic */}
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateShowPencil}
                    onChange={(e) => setTemplateShowPencil(e.target.checked)}
                    className="rounded text-primary-600"
                  />
                  <span>Display Pencil Graphic Accent on Margin</span>
                </label>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400">
                Generated on{" "}
                {previewStudent.summary?.generatedAt
                  ? new Date(previewStudent.summary.generatedAt).toLocaleDateString()
                  : new Date().toLocaleDateString()}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewStudent(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(previewStudent, "ONE_SIDED")}
                  disabled={downloadingPdf}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── PDF LAYOUT SELECTOR MODAL ── */}
      {pdfDownloadStudent && (
        <Modal
          isOpen={!!pdfDownloadStudent}
          onClose={() => setPdfDownloadStudent(null)}
          title="Download Report Card PDF"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select page layout for{" "}
              <strong className="text-gray-900 dark:text-white font-bold">
                {pdfDownloadStudent.name}
              </strong>
              's annual report card:
            </p>

            {/* Layout Options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedPdfLayout("ONE_SIDED")}
                className={clsx(
                  "p-4 rounded-xl border text-left transition-all",
                  selectedPdfLayout === "ONE_SIDED"
                    ? "border-primary-600 bg-primary-50/60 dark:bg-primary-950/40 ring-2 ring-primary-500/20"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">
                    One-Sided Card
                  </span>
                  {selectedPdfLayout === "ONE_SIDED" && (
                    <Check className="w-4 h-4 text-primary-600" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Standard 1-page summary with term breakdown, cumulative rank, and official signatures.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPdfLayout("TWO_SIDED")}
                className={clsx(
                  "p-4 rounded-xl border text-left transition-all",
                  selectedPdfLayout === "TWO_SIDED"
                    ? "border-primary-600 bg-primary-50/60 dark:bg-primary-950/40 ring-2 ring-primary-500/20"
                    : "border-gray-200 dark:border-gray-800 hover:border-gray-300",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">
                    Two-Sided Expanded
                  </span>
                  {selectedPdfLayout === "TWO_SIDED" && (
                    <Check className="w-4 h-4 text-primary-600" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Includes 2nd page with recent term subjects breakdown, attendance records & remarks.
                </p>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setPdfDownloadStudent(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPdf(pdfDownloadStudent, selectedPdfLayout)}
                disabled={downloadingPdf}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {downloadingPdf ? "Generating PDF…" : "Download Report Card"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
