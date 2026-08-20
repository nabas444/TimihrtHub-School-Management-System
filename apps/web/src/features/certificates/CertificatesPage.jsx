import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  GraduationCap,
  Sparkles,
  History,
  Download,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  ShieldCheck,
  Send,
  Trash2,
  Eye,
  Check,
  RotateCw,
  Plus,
  Printer,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import { Avatar, Badge, EmptyState } from "../../components/ui/index";
import PageLoader from "../../components/ui/PageLoader";
import Modal from "../../components/ui/Modal";
import CertificateRecognitionTemplate from "./components/CertificateRecognitionTemplate";
import clsx from "clsx";
import toast from "react-hot-toast";

const RECOGNITION_PRESET_TITLES = [
  "Certificate of Academic Excellence",
  "Certificate of Perfect Attendance",
  "Certificate of Outstanding Leadership",
  "Certificate of Exemplary Behaviour",
  "Certificate of Sports & Athletic Achievement",
  "Distinguished Teaching & Mentorship Award",
  "Outstanding Staff Service Recognition",
];

const CITATION_PRESETS = {
  "Certificate of Academic Excellence":
    "For demonstrating exceptional academic performance, scholarly discipline, and intellectual curiosity throughout the academic term.",
  "Certificate of Perfect Attendance":
    "In recognition of maintaining a flawless 100% attendance record and showing steadfast commitment to daily learning.",
  "Certificate of Outstanding Leadership":
    "For exemplary student leadership, initiative in school activities, and inspiring fellow classmates through active engagement.",
  "Certificate of Exemplary Behaviour":
    "For maintaining highest standards of integrity, respect, and positive contributions to the school community.",
  "Certificate of Sports & Athletic Achievement":
    "In recognition of outstanding athletic excellence, sportsmanship, and teamwork representing the school.",
  "Distinguished Teaching & Mentorship Award":
    "In sincere gratitude for tireless dedication to pedagogical excellence, student mentorship, and academic leadership.",
  "Outstanding Staff Service Recognition":
    "In high appreciation for noteworthy diligence, professionalism, and invaluable contributions to school operations.",
};

export default function CertificatesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("recognition"); // recognition | graduation | history

  // ── Recognition Tab State ────────────────────────────────────────────────
  const [recipientType, setRecipientType] = useState("STUDENT"); // STUDENT | STAFF
  const [studentScope, setStudentScope] = useState("CLASS"); // CLASS | SECTION | SELECTED
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [selectedStaffRole, setSelectedStaffRole] = useState("");

  const [titlePreset, setTitlePreset] = useState(RECOGNITION_PRESET_TITLES[0]);
  const [customTitle, setCustomTitle] = useState("");
  const [reasonText, setReasonText] = useState(
    CITATION_PRESETS[RECOGNITION_PRESET_TITLES[0]],
  );
  const [layout, setLayout] = useState("ONE_SIDED"); // ONE_SIDED | TWO_SIDED
  const [academicYear, setAcademicYear] = useState("2024/2025");
  const [issuingBatch, setIssuingBatch] = useState(false);

  // ── Graduation Tab State ─────────────────────────────────────────────────
  const [gradClassId, setGradClassId] = useState("");
  const [gradAcademicYear, setGradAcademicYear] = useState("2024/2025");
  const [issuingGraduation, setIssuingGraduation] = useState(false);

  // ── History Tab State ────────────────────────────────────────────────────
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("ALL");
  const [historyRecipientFilter, setHistoryRecipientFilter] = useState("ALL");
  const [selectedHistoryCert, setSelectedHistoryCert] = useState(null);

  // ── Certificate Template Preview & Customizer State ─────────────────────
  const [previewCertModalOpen, setPreviewCertModalOpen] = useState(false);
  const [previewCertData, setPreviewCertData] = useState(null);
  const [certRibbonColor, setCertRibbonColor] = useState("#0284C7");
  const [certSealColor, setCertSealColor] = useState("#0F172A");
  const [certLeftSignatoryTitle, setCertLeftSignatoryTitle] = useState("Homeroom Teacher");
  const [certLeftSignatoryName, setCertLeftSignatoryName] = useState("Mr. Daniel Tesfaye");
  const [certRightSignatoryTitle, setCertRightSignatoryTitle] = useState("School Principal / Director");
  const [certRightSignatoryName, setCertRightSignatoryName] = useState("Dr. Almaz Bekele");
  const [certLocation, setCertLocation] = useState("Addis Ababa, Ethiopia");
  const [certCitation1, setCertCitation1] = useState(
    "Thank you for demonstrating the type of character and integrity that inspire others."
  );
  const [certCitation2, setCertCitation2] = useState(
    "Your selfless efforts are appreciated and haven't gone unnoticed."
  );
  const [activeCertModalTab, setActiveCertModalTab] = useState("template"); // template | customizer

  // ── 1. Fetch Classes & Grade Levels ──────────────────────────────────────
  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data ?? []),
  });

  const { data: gradeLevelsData } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () =>
      api.get("/schools/grade-levels").then((r) => r.data.data ?? []),
  });

  const activeRecognitionClassId =
    selectedClassId || classesData?.[0]?.id || "";
  const activeGradClassId = gradClassId || classesData?.[0]?.id || "";

  // ── 2. Preview Recognition Candidates Query ──────────────────────────────
  const { data: recognitionPreviewData, isLoading: previewLoading } = useQuery({
    queryKey: [
      "certificates-preview",
      recipientType,
      studentScope,
      activeRecognitionClassId,
      selectedGradeId,
      academicYear,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("type", "RECOGNITION");
      params.append("recipientType", recipientType);
      params.append("scope", studentScope);
      if (recipientType === "STUDENT" && activeRecognitionClassId) {
        params.append("classId", activeRecognitionClassId);
      }
      if (recipientType === "STUDENT" && selectedGradeId) {
        params.append("gradeLevelId", selectedGradeId);
      }
      params.append("academicYear", academicYear);

      return api
        .get(`/certificates/preview-recipients?${params.toString()}`)
        .then((r) => r.data.data);
    },
  });

  // ── 3. Preview Graduation Candidates Query ───────────────────────────────
  const { data: graduationPreviewData, isLoading: gradPreviewLoading } =
    useQuery({
      queryKey: [
        "certificates-graduation-preview",
        activeGradClassId,
        gradAcademicYear,
      ],
      queryFn: () => {
        const params = new URLSearchParams();
        params.append("type", "GRADUATION");
        params.append("recipientType", "STUDENT");
        params.append("scope", "CLASS");
        params.append("classId", activeGradClassId);
        params.append("academicYear", gradAcademicYear);

        return api
          .get(`/certificates/preview-recipients?${params.toString()}`)
          .then((r) => r.data.data);
      },
      enabled: !!activeGradClassId,
    });

  // ── 4. Fetch Issued Certificates History ─────────────────────────────────
  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: [
      "certificates-history",
      historyTypeFilter,
      historyRecipientFilter,
      historySearch,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (historyTypeFilter !== "ALL") params.append("type", historyTypeFilter);
      if (historyRecipientFilter !== "ALL")
        params.append("recipientType", historyRecipientFilter);
      if (historySearch) params.append("search", historySearch);

      return api.get(`/certificates?${params.toString()}`).then((r) => r.data.data);
    },
  });

  // ── 5. Issue Recognition Certificates ────────────────────────────────────
  const effectiveTitle = customTitle.trim() || titlePreset;

  const handleIssueRecognition = async () => {
    try {
      setIssuingBatch(true);
      const payload = {
        type: "RECOGNITION",
        recipientType,
        scope:
          recipientType === "STUDENT" ? studentScope : "STAFF_GROUP",
        classId:
          recipientType === "STUDENT" && studentScope === "CLASS"
            ? activeRecognitionClassId
            : undefined,
        gradeLevelId:
          recipientType === "STUDENT" && studentScope === "SECTION"
            ? selectedGradeId
            : undefined,
        studentProfileIds:
          recipientType === "STUDENT" && selectedStudentIds.length > 0
            ? selectedStudentIds
            : undefined,
        userIds:
          recipientType === "STAFF" && selectedStaffIds.length > 0
            ? selectedStaffIds
            : undefined,
        title: effectiveTitle,
        reason: reasonText,
        layout,
        academicYear,
      };

      const res = await api.post("/certificates/bulk", payload);
      toast.success(res.data.message || "Certificates issued successfully");
      queryClient.invalidateQueries({ queryKey: ["certificates-history"] });
      setActiveTab("history");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to issue certificates",
      );
    } finally {
      setIssuingBatch(false);
    }
  };

  // ── 6. Issue Graduation Certificates ─────────────────────────────────────
  const handleIssueGraduation = async () => {
    try {
      setIssuingGraduation(true);
      const payload = {
        type: "GRADUATION",
        recipientType: "STUDENT",
        scope: "CLASS",
        classId: activeGradClassId,
        title: "Certificate of Graduation",
        layout,
        academicYear: gradAcademicYear,
      };

      const res = await api.post("/certificates/bulk", payload);
      toast.success(res.data.message || "Graduation certificates issued successfully");
      queryClient.invalidateQueries({ queryKey: ["certificates-history"] });
      setActiveTab("history");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to issue graduation certificates",
      );
    } finally {
      setIssuingGraduation(false);
    }
  };

  // ── 7. Delete Certificate Mutation ───────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/certificates/${id}`),
    onSuccess: () => {
      toast.success("Certificate deleted");
      queryClient.invalidateQueries({ queryKey: ["certificates-history"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete certificate");
    },
  });

  // ── 8. Download Certificate PDF ──────────────────────────────────────────
  const handleDownloadPdf = async (cert) => {
    try {
      const url = `/certificates/${cert.id}/pdf`;
      const safeTitle = cert.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const filename = `certificate-${safeTitle}.pdf`;
      await downloadFile(url, filename);
      toast.success("Certificate PDF downloaded");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to download certificate PDF",
      );
    }
  };

  const recognitionRecipients = recognitionPreviewData?.recipients ?? [];
  const graduationRecipients = graduationPreviewData?.recipients ?? [];
  const eligibleGradCount = graduationRecipients.filter((r) => r.isEligible).length;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" />
            Certificates & Recognition Awards
          </h1>
          <p className="page-subtitle">
            Issue official Certificate of Recognition awards, Graduation Certificates, and manage issued document records.
          </p>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("recognition")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors",
              activeTab === "recognition"
                ? "border-primary-600 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white",
            )}
          >
            <Sparkles className="w-4 h-4" />
            Recognition Certificates
          </button>

          <button
            onClick={() => setActiveTab("graduation")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors",
              activeTab === "graduation"
                ? "border-primary-600 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white",
            )}
          >
            <GraduationCap className="w-4 h-4" />
            Graduation Certificates
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors",
              activeTab === "history"
                ? "border-primary-600 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white",
            )}
          >
            <History className="w-4 h-4" />
            Issued Records History
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 1: RECOGNITION CERTIFICATES
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "recognition" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Configuration Form */}
            <div className="lg:col-span-1 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Certificate Config
                </h3>

                {/* Recipient Type Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Recipient Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRecipientType("STUDENT")}
                      className={clsx(
                        "py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5",
                        recipientType === "STUDENT"
                          ? "border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
                          : "border-gray-200 dark:border-gray-800 text-gray-600",
                      )}
                    >
                      <Users className="w-3.5 h-3.5" /> Students
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientType("STAFF")}
                      className={clsx(
                        "py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5",
                        recipientType === "STAFF"
                          ? "border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
                          : "border-gray-200 dark:border-gray-800 text-gray-600",
                      )}
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Staff Members
                    </button>
                  </div>
                </div>

                {/* Target Scope */}
                {recipientType === "STUDENT" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Target Class
                    </label>
                    <select
                      value={activeRecognitionClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="input w-full"
                    >
                      {(classesData ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Preset Title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Award Title Preset
                  </label>
                  <select
                    value={titlePreset}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTitlePreset(val);
                      if (CITATION_PRESETS[val]) {
                        setReasonText(CITATION_PRESETS[val]);
                      }
                    }}
                    className="input w-full text-xs"
                  >
                    {RECOGNITION_PRESET_TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Title Override */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Custom Title (Optional override)
                  </label>
                  <input
                    type="text"
                    placeholder="Leave blank to use preset title"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="input w-full text-xs"
                  />
                </div>

                {/* Reason Citation */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Citation / Achievement Description
                  </label>
                  <textarea
                    rows={4}
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    className="input w-full text-xs"
                    placeholder="Describe the reason or achievement…"
                  />
                </div>

                {/* Layout Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Print Layout
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLayout("ONE_SIDED")}
                      className={clsx(
                        "py-1.5 text-xs font-semibold rounded-lg border",
                        layout === "ONE_SIDED"
                          ? "border-primary-600 bg-primary-50 text-primary-700 font-bold"
                          : "border-gray-200 dark:border-gray-800 text-gray-600",
                      )}
                    >
                      One-Sided
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayout("TWO_SIDED")}
                      className={clsx(
                        "py-1.5 text-xs font-semibold rounded-lg border",
                        layout === "TWO_SIDED"
                          ? "border-primary-600 bg-primary-50 text-primary-700 font-bold"
                          : "border-gray-200 dark:border-gray-800 text-gray-600",
                      )}
                    >
                      Two-Sided
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const sampleRecipient = recognitionRecipients[0] || {
                        name: "Abebe Kebede Girma",
                        section: "Section 10A",
                        grade: "Grade 10",
                      };
                      setPreviewCertData({
                        recipientName: sampleRecipient.name,
                        section: sampleRecipient.section || "Section 10A",
                        yearLevel: sampleRecipient.grade || "Grade 10",
                        batch: academicYear,
                        title: customTitle.trim() || titlePreset,
                        achievement: customTitle.trim() || titlePreset,
                        reason: reasonText,
                      });
                      setPreviewCertModalOpen(true);
                      setActiveCertModalTab("template");
                    }}
                    className="btn-secondary flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Eye className="w-4 h-4 text-amber-500" /> Preview Template
                  </button>

                  <button
                    type="button"
                    onClick={handleIssueRecognition}
                    disabled={issuingBatch || recognitionRecipients.length === 0}
                    className="btn-primary flex-1 py-2.5 inline-flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Award className="w-4 h-4" />
                    {issuingBatch
                      ? "Issuing…"
                      : `Issue (${recognitionRecipients.length})`}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Recipients Preview Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">
                      Target Recipients Preview
                    </h3>
                    <p className="text-xs text-gray-500">
                      {recognitionRecipients.length} recipients selected for{" "}
                      <strong>{effectiveTitle}</strong>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    {recognitionRecipients.length} Candidates
                  </span>
                </div>

                {previewLoading ? (
                  <PageLoader />
                ) : recognitionRecipients.length === 0 ? (
                  <div className="p-8 text-center">
                    <EmptyState
                      icon={Users}
                      title="No matching recipients found"
                      description="Select a valid class or staff group to preview recipients."
                    />
                  </div>
                ) : (
                  <div className="table-wrapper max-h-[500px] overflow-y-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Recipient</th>
                          <th>ID / Adm</th>
                          <th>Class / Dept</th>
                          <th className="text-center">Commendations</th>
                          <th className="text-center">Academic Avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {recognitionRecipients.map((r) => (
                          <tr key={r.studentProfileId || r.id}>
                            <td className="font-semibold text-gray-900 dark:text-white">
                              {r.name}
                            </td>
                            <td className="text-xs font-mono text-gray-500">
                              {r.admissionNumber || r.employeeId || "—"}
                            </td>
                            <td className="text-xs text-gray-600 dark:text-gray-300">
                              {r.className || r.department || r.role || "—"}
                            </td>
                            <td className="text-center">
                              {r.commendationCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                                  ⭐ {r.commendationCount}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">0</span>
                              )}
                            </td>
                            <td className="text-center font-bold text-xs">
                              {r.overallAverage != null ? (
                                `${r.overallAverage.toFixed(1)}%`
                              ) : (
                                <span className="text-gray-400 font-normal">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 2: GRADUATION CERTIFICATES
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "graduation" && (
        <div className="space-y-6">
          <div className="card p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Class Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Graduating Class
                </label>
                <select
                  value={activeGradClassId}
                  onChange={(e) => setGradClassId(e.target.value)}
                  className="input w-full"
                >
                  {(classesData ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Year */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Academic Year
                </label>
                <select
                  value={gradAcademicYear}
                  onChange={(e) => setGradAcademicYear(e.target.value)}
                  className="input w-full"
                >
                  <option value="2024/2025">2024 / 2025</option>
                  <option value="2025/2026">2025 / 2026</option>
                </select>
              </div>

              {/* Action Button */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleIssueGraduation}
                  disabled={issuingGraduation || eligibleGradCount === 0}
                  className="btn-primary w-full inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <GraduationCap className="w-4 h-4" />
                  {issuingGraduation
                    ? "Issuing Certificates…"
                    : `Issue Graduation Certificates (${eligibleGradCount})`}
                </button>
              </div>
            </div>
          </div>

          {/* Graduation Eligibility Table */}
          {gradPreviewLoading ? (
            <PageLoader />
          ) : graduationRecipients.length === 0 ? (
            <div className="card p-12 text-center">
              <EmptyState
                icon={GraduationCap}
                title="No students found in this graduating class"
                description="Select another class or confirm student enrollment."
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
                      <th>Class Status</th>
                      <th className="text-center">Academic Avg</th>
                      <th className="text-center">Pass Status</th>
                      <th className="text-center">Graduation Eligibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {graduationRecipients.map((s) => (
                      <tr key={s.studentProfileId}>
                        <td className="font-semibold text-gray-900 dark:text-white">
                          {s.name}
                        </td>
                        <td className="text-xs font-mono text-gray-500">
                          {s.admissionNumber || "—"}
                        </td>
                        <td>
                          <Badge
                            variant={s.status === "ARCHIVE" ? "neutral" : "primary"}
                            size="sm"
                          >
                            {s.status}
                          </Badge>
                        </td>
                        <td className="text-center font-bold text-xs">
                          {s.overallAverage != null
                            ? `${s.overallAverage.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="text-center">
                          {s.isPassing ? (
                            <Badge variant="success" size="sm">
                              PASSED
                            </Badge>
                          ) : (
                            <Badge variant="danger" size="sm">
                              NOT PASSING
                            </Badge>
                          )}
                        </td>
                        <td className="text-center">
                          {s.isEligible ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" /> Eligible
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-red-500"
                              title={s.eligibilityReason}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />{" "}
                              {s.eligibilityReason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 3: ISSUED RECORDS HISTORY
          ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="card p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search recipient or title…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="input pl-9 w-full"
                />
              </div>

              {/* Type Filter */}
              <div>
                <select
                  value={historyTypeFilter}
                  onChange={(e) => setHistoryTypeFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="ALL">All Certificate Types</option>
                  <option value="RECOGNITION">Recognition Awards</option>
                  <option value="GRADUATION">Graduation Certificates</option>
                </select>
              </div>

              {/* Recipient Filter */}
              <div>
                <select
                  value={historyRecipientFilter}
                  onChange={(e) => setHistoryRecipientFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="ALL">All Recipients (Student & Staff)</option>
                  <option value="STUDENT">Students Only</option>
                  <option value="STAFF">Staff Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* History Records Table */}
          {historyLoading ? (
            <PageLoader />
          ) : (historyData?.certificates ?? []).length === 0 ? (
            <div className="card p-12 text-center">
              <EmptyState
                icon={FileText}
                title="No certificates issued yet"
                description="Issue recognition or graduation certificates from the tabs above."
              />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Type</th>
                      <th>Certificate Title</th>
                      <th>Reason / Citation</th>
                      <th>Issue Date</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(historyData?.certificates ?? []).map((cert) => {
                      const isStudent = cert.recipientType === "STUDENT";
                      const recipientUser = isStudent
                        ? cert.studentProfile?.user
                        : cert.user;
                      const recipientName = recipientUser
                        ? [
                            recipientUser.firstName,
                            recipientUser.middleName,
                            recipientUser.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        : "Recipient";

                      return (
                        <tr
                          key={cert.id}
                          className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          {/* Recipient */}
                          <td>
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={recipientUser?.avatar}
                                alt={recipientName}
                                fallback={recipientName?.[0]}
                                size="sm"
                              />
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                  {recipientName}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {isStudent
                                    ? `Class: ${cert.studentProfile?.class?.name || "—"}`
                                    : `Staff: ${recipientUser?.role}`}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Certificate Type */}
                          <td>
                            <Badge
                              variant={
                                cert.type === "GRADUATION" ? "primary" : "warning"
                              }
                              size="sm"
                            >
                              {cert.type}
                            </Badge>
                          </td>

                          {/* Title */}
                          <td className="font-bold text-gray-900 dark:text-white text-xs">
                            {cert.title}
                          </td>

                          {/* Reason */}
                          <td className="text-xs text-gray-500 max-w-xs truncate">
                            {cert.reason || "Standard graduation criteria"}
                          </td>

                          {/* Issue Date */}
                          <td className="text-xs text-gray-500">
                            {new Date(cert.issueDate).toLocaleDateString("en-GB")}
                          </td>

                          {/* Actions */}
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setPreviewCertData({
                                    recipientName,
                                    section: cert.studentProfile?.class?.name || "Section A",
                                    yearLevel: "Academic Year",
                                    batch: cert.academicYear || "2024/2025",
                                    title: cert.title,
                                    achievement: cert.title,
                                    reason: cert.reason,
                                    issueDate: cert.issueDate,
                                  });
                                  setPreviewCertModalOpen(true);
                                  setActiveCertModalTab("template");
                                }}
                                className="p-1.5 rounded-md hover:bg-amber-50 text-amber-600 transition-colors"
                                title="Preview Official Certificate Template"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDownloadPdf(cert)}
                                className="p-1.5 rounded-md hover:bg-primary-50 text-primary-600 transition-colors"
                                title="Download PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Are you sure you want to delete this certificate record?",
                                    )
                                  ) {
                                    deleteMutation.mutate(cert.id);
                                  }
                                }}
                                className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                                title="Delete Certificate"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
        </div>
      )}

      {/* ── PREVIEW OFFICIAL CERTIFICATE MODAL ── */}
      {previewCertModalOpen && previewCertData && (
        <Modal
          isOpen={previewCertModalOpen}
          onClose={() => setPreviewCertModalOpen(false)}
          title={`Certificate — ${previewCertData.recipientName || "Official Recognition"}`}
          size="xl"
        >
          <div className="space-y-4">
            {/* Tabs Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
              <div className="flex gap-2">
                {[
                  { id: "template", label: "Official Certificate Template" },
                  { id: "customizer", label: "Customize Template & Signatories" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCertModalTab(tab.id)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      activeCertModalTab === tab.id
                        ? "bg-amber-600 text-white shadow-xs"
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
                title="Print Official Certificate"
              >
                <Printer className="w-3.5 h-3.5" /> Print Certificate
              </button>
            </div>

            {/* TAB 1: OFFICIAL CERTIFICATE TEMPLATE */}
            {activeCertModalTab === "template" && (
              <div className="overflow-x-auto p-3 bg-gray-100/70 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800">
                <CertificateRecognitionTemplate
                  schoolName="DEMO INTERNATIONAL ACADEMY"
                  certificateTitle={previewCertData.title || "CERTIFICATE OF RECOGNITION"}
                  recipientName={previewCertData.recipientName || "Abebe Kebede Girma"}
                  section={previewCertData.section || "Section 10A"}
                  yearLevel={previewCertData.yearLevel || "Grade 10"}
                  batch={previewCertData.batch || "2024/2025"}
                  achievement={previewCertData.achievement || previewCertData.title || "Academic Excellence Award"}
                  issueDay={new Date().getDate().toString()}
                  issueMonth={new Date().toLocaleString("default", { month: "long" })}
                  issueYear={new Date().getFullYear().toString()}
                  location={certLocation}
                  citationParagraph1={certCitation1}
                  citationParagraph2={certCitation2}
                  ribbonColor={certRibbonColor}
                  sealColor={certSealColor}
                  signatoryLeft={{
                    title: certLeftSignatoryTitle,
                    name: certLeftSignatoryName,
                  }}
                  signatoryRight={{
                    title: certRightSignatoryTitle,
                    name: certRightSignatoryName,
                  }}
                />
              </div>
            )}

            {/* TAB 2: CUSTOMIZE TEMPLATE */}
            {activeCertModalTab === "customizer" && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Certificate Details & Appearance
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Recipient Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Recipient Full Name
                    </label>
                    <input
                      type="text"
                      value={previewCertData.recipientName || ""}
                      onChange={(e) =>
                        setPreviewCertData((d) => ({ ...d, recipientName: e.target.value }))
                      }
                      className="input w-full text-xs"
                    />
                  </div>

                  {/* Achievement Title */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Achievement Specification
                    </label>
                    <input
                      type="text"
                      value={previewCertData.achievement || ""}
                      onChange={(e) =>
                        setPreviewCertData((d) => ({ ...d, achievement: e.target.value }))
                      }
                      className="input w-full text-xs"
                    />
                  </div>

                  {/* Left Signatory */}
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                    <p className="text-[11px] font-bold uppercase text-gray-500">
                      Signatory 1 (Left)
                    </p>
                    <input
                      type="text"
                      placeholder="Name (e.g. Mr. Daniel Tesfaye)"
                      value={certLeftSignatoryName}
                      onChange={(e) => setCertLeftSignatoryName(e.target.value)}
                      className="input w-full text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Position (e.g. Homeroom Teacher)"
                      value={certLeftSignatoryTitle}
                      onChange={(e) => setCertLeftSignatoryTitle(e.target.value)}
                      className="input w-full text-xs"
                    />
                  </div>

                  {/* Right Signatory */}
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                    <p className="text-[11px] font-bold uppercase text-gray-500">
                      Signatory 2 (Right)
                    </p>
                    <input
                      type="text"
                      placeholder="Name (e.g. Dr. Almaz Bekele)"
                      value={certRightSignatoryName}
                      onChange={(e) => setCertRightSignatoryName(e.target.value)}
                      className="input w-full text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Position (e.g. School Principal)"
                      value={certRightSignatoryTitle}
                      onChange={(e) => setCertRightSignatoryTitle(e.target.value)}
                      className="input w-full text-xs"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Issue Location
                    </label>
                    <input
                      type="text"
                      value={certLocation}
                      onChange={(e) => setCertLocation(e.target.value)}
                      className="input w-full text-xs"
                    />
                  </div>

                  {/* Ribbon Color */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Rosette Ribbon Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={certRibbonColor}
                        onChange={(e) => setCertRibbonColor(e.target.value)}
                        className="w-9 h-9 rounded cursor-pointer border p-0.5"
                      />
                      <span className="text-xs font-mono">{certRibbonColor}</span>
                    </div>
                  </div>
                </div>

                {/* Citation Paragraphs */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Citation Paragraph 1
                  </label>
                  <input
                    type="text"
                    value={certCitation1}
                    onChange={(e) => setCertCitation1(e.target.value)}
                    className="input w-full text-xs"
                  />
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Citation Paragraph 2
                  </label>
                  <input
                    type="text"
                    value={certCitation2}
                    onChange={(e) => setCertCitation2(e.target.value)}
                    className="input w-full text-xs"
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setPreviewCertModalOpen(false)}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Certificate
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
