import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Users,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Star,
  DollarSign,
  Building,
  Mail,
  Phone,
  Link as LinkIcon,
  Copy,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import {
  Avatar,
  Badge,
  SearchInput,
  Pagination,
  PageLoader,
  Modal,
} from "../../components/ui/index";
import LookupSelect from "../../components/shared/LookupSelect";
import clsx from "clsx";
import toast from "react-hot-toast";

const PIPELINE_STAGES = [
  { key: "APPLIED", label: "Applied", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "SCREENING", label: "Screening", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "INTERVIEW", label: "Interview", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "OFFER", label: "Offer Made", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "HIRED", label: "Hired 🎉", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "REJECTED", label: "Archived / Rejected", color: "bg-gray-100 text-gray-500 border-gray-200" },
];

export default function RecruitingPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("pipeline"); // 'pipeline' | 'postings' | 'requisitions' | 'offers'
  const [selectedPostingId, setSelectedPostingId] = useState("");
  const [search, setSearch] = useState("");

  // Modals
  const [createReqModalOpen, setCreateReqModalOpen] = useState(false);
  const [createPostingModalOpen, setCreatePostingModalOpen] = useState(false);
  const [candidateDetailModalOpen, setCandidateDetailModalOpen] = useState(false);
  const [scheduleInterviewModalOpen, setScheduleInterviewModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [hireModalOpen, setHireModalOpen] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedInterviewId, setSelectedInterviewId] = useState(null);

  // Forms
  const [reqForm, setReqForm] = useState({
    title: "",
    departmentId: "",
    positionId: "",
    vacanciesCount: 1,
    employmentType: "FULL_TIME",
    salaryMin: "",
    salaryMax: "",
    reason: "REPLACEMENT",
    description: "",
    justification: "",
    autoApprove: true,
  });

  const [postingForm, setPostingForm] = useState({
    title: "",
    departmentId: "",
    positionId: "",
    employmentType: "FULL_TIME",
    location: "Main Campus",
    description: "",
    requirements: "",
    benefits: "Tuition waiver for staff children, medical coverage, transport subsidy.",
    salaryRange: "20,000 - 30,000 ETB",
    closingDate: "",
    publishNow: true,
  });

  const [interviewForm, setInterviewForm] = useState({
    title: "1st Round Panel Interview",
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    durationMinutes: 45,
    format: "IN_PERSON",
    locationOrLink: "Conference Room A",
    notes: "",
  });

  const [feedbackForm, setFeedbackForm] = useState({
    score: 4.5,
    recommendation: "STRONG_HIRE",
    strengths: "",
    concerns: "",
    notes: "",
  });

  const [offerForm, setOfferForm] = useState({
    positionTitle: "",
    departmentName: "",
    employmentType: "FULL_TIME",
    offeredSalary: 25000,
    salaryPeriod: "MONTHLY",
    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    probationMonths: 3,
    benefits: "Medical insurance, housing allowance, annual paid leave.",
    conditions: "Contingent on authentic educational credentials verification.",
  });

  const [hireForm, setHireForm] = useState({
    createUserAccount: true,
    userRole: "TEACHER",
    userPassword: "Welcome@123",
  });

  // ── Queries ────────────────────────────────────────────────────────
  const { data: dashboardData } = useQuery({
    queryKey: ["recruiting-dashboard"],
    queryFn: () => api.get("/recruiting/dashboard").then((r) => r.data.data),
  });

  const { data: postings } = useQuery({
    queryKey: ["job-postings"],
    queryFn: () => api.get("/recruiting/postings").then((r) => r.data.data || []),
  });

  const { data: requisitions } = useQuery({
    queryKey: ["job-requisitions"],
    queryFn: () => api.get("/recruiting/requisitions").then((r) => r.data.data || []),
  });

  const { data: applications, isLoading: isAppLoading } = useQuery({
    queryKey: ["job-applications", selectedPostingId, search],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: "100",
        ...(selectedPostingId && { postingId: selectedPostingId }),
        ...(search && { search }),
      });
      return api.get(`/recruiting/applications?${params.toString()}`).then((r) => r.data.data || []);
    },
  });

  // Fetch full details of selected application
  const { data: applicationDetail, isLoading: isCandidateLoading } = useQuery({
    queryKey: ["application-detail", selectedCandidate?.id],
    queryFn: () =>
      selectedCandidate ? api.get(`/recruiting/applications/${selectedCandidate.id}`).then((r) => r.data.data) : null,
    enabled: Boolean(selectedCandidate?.id),
  });

  // ── Mutations ──────────────────────────────────────────────────────
  const createReqMutation = useMutation({
    mutationFn: (payload) => api.post("/recruiting/requisitions", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-requisitions"] });
      qc.invalidateQueries({ queryKey: ["recruiting-dashboard"] });
      toast.success("Job requisition submitted");
      setCreateReqModalOpen(false);
    },
  });

  const createPostingMutation = useMutation({
    mutationFn: (payload) => api.post("/recruiting/postings", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-postings"] });
      qc.invalidateQueries({ queryKey: ["recruiting-dashboard"] });
      toast.success("Job posting published");
      setCreatePostingModalOpen(false);
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ appId, stage, rating }) =>
      api.patch(`/recruiting/applications/${appId}/stage`, { stage, rating }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-applications"] });
      qc.invalidateQueries({ queryKey: ["application-detail", selectedCandidate?.id] });
      qc.invalidateQueries({ queryKey: ["recruiting-dashboard"] });
      toast.success("Candidate stage updated");
    },
  });

  const scheduleInterviewMutation = useMutation({
    mutationFn: ({ appId, payload }) =>
      api.post(`/recruiting/applications/${appId}/interviews`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application-detail", selectedCandidate?.id] });
      qc.invalidateQueries({ queryKey: ["job-applications"] });
      toast.success("Interview scheduled successfully");
      setScheduleInterviewModalOpen(false);
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: ({ interviewId, payload }) =>
      api.post(`/recruiting/interviews/${interviewId}/feedback`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application-detail", selectedCandidate?.id] });
      toast.success("Structured feedback submitted");
      setFeedbackModalOpen(false);
    },
  });

  const createOfferMutation = useMutation({
    mutationFn: ({ appId, payload }) =>
      api.post(`/recruiting/applications/${appId}/offer`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["application-detail", selectedCandidate?.id] });
      qc.invalidateQueries({ queryKey: ["job-applications"] });
      toast.success("Job offer generated successfully");
      setOfferModalOpen(false);
    },
  });

  const convertToHireMutation = useMutation({
    mutationFn: ({ offerId, payload }) =>
      api.post(`/recruiting/offers/${offerId}/convert-to-hire`, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["job-applications"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["recruiting-dashboard"] });
      toast.success("Applicant converted into active Employee record!");
      setHireModalOpen(false);
      setCandidateDetailModalOpen(false);
    },
  });

  const openCandidateModal = (candidate) => {
    setSelectedCandidate(candidate);
    setCandidateDetailModalOpen(true);
  };

  const handleCreateOffer = () => {
    if (!applicationDetail) return;
    setOfferForm({
      positionTitle: applicationDetail.posting?.title || "Teacher",
      departmentName: applicationDetail.posting?.department?.value || "Academic",
      employmentType: applicationDetail.posting?.employmentType || "FULL_TIME",
      offeredSalary: 25000,
      salaryPeriod: "MONTHLY",
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      probationMonths: 3,
      benefits: "Health insurance, housing allowance, tuition waiver for staff children.",
      conditions: "Contingent on successful reference checks and valid teaching license.",
    });
    setOfferModalOpen(true);
  };

  const handleDownloadOfferPdf = (offerId, offerNumber) => {
    downloadFile(
      `/recruiting/offers/${offerId}/pdf`,
      `Offer_Letter_${offerNumber || offerId}.pdf`
    ).catch(() => toast.error("Could not generate offer letter PDF"));
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & NAVIGATION ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Briefcase className="w-7 h-7 text-primary-600" />
            Recruiting & Talent Acquisition
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage hiring requisitions, public job board, applicant pipeline, structured interviews, and offer letters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateReqModalOpen(true)}
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Requisition
          </button>
          <button
            onClick={() => setCreatePostingModalOpen(true)}
            className="btn-primary text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Post a Job
          </button>
        </div>
      </div>

      {/* ── TABS ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 text-xs font-semibold gap-2">
        {[
          { id: "pipeline", label: `Pipeline Board (${applications?.length || 0})`, icon: Users },
          { id: "postings", label: `Job Postings (${postings?.length || 0})`, icon: Briefcase },
          { id: "requisitions", label: `Requisitions (${requisitions?.length || 0})`, icon: Building },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-3.5 py-2.5 rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 font-bold",
                activeTab === tab.id
                  ? "border-primary-600 text-primary-700 bg-primary-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: APPLICANT TRACKING PIPELINE (KANBAN) ──────────────────── */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-80">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search candidate name, email, phone…"
              />
            </div>
            <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
              <select
                value={selectedPostingId}
                onChange={(e) => setSelectedPostingId(e.target.value)}
                className="input text-xs py-1.5"
              >
                <option value="">All Job Postings</option>
                {postings?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p._count?.applications || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 min-h-[500px]">
            {PIPELINE_STAGES.map((col) => {
              const stageApps = applications?.filter((a) => a.stage === col.key) || [];
              return (
                <div
                  key={col.key}
                  className="bg-gray-50/80 rounded-xl border border-gray-200/80 p-3 flex flex-col"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
                    <span className="font-bold text-xs text-gray-800">{col.label}</span>
                    <span className="bg-white border border-gray-200 text-gray-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {stageApps.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 flex-1 overflow-y-auto">
                    {stageApps.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => openCandidateModal(app)}
                        className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs hover:border-primary-400 hover:shadow-md cursor-pointer transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-bold text-gray-900 text-xs truncate">
                            {app.candidateName}
                          </p>
                          {app.rating && (
                            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-amber-400" /> {app.rating}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-gray-500 truncate font-semibold">
                          {app.posting?.title}
                        </p>

                        <div className="pt-1 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                          <span>{new Date(app.appliedAt).toLocaleDateString()}</span>
                          {app.hiredEmployee && (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                              {app.hiredEmployee.employeeNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: JOB POSTINGS ─────────────────────────────────────────── */}
      {activeTab === "postings" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {postings?.map((p) => (
              <div
                key={p.id}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 text-sm">{p.title}</h3>
                    <Badge variant={p.status === "PUBLISHED" ? "green" : "gray"}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-primary-700 font-semibold mt-1">
                    {p.department?.value || "General"} • {p.employmentType?.replace("_", " ")}
                  </p>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-3">{p.description}</p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">
                    {p._count?.applications || 0} Applicants
                  </span>
                  <button
                    onClick={() => {
                      setSelectedPostingId(p.id);
                      setActiveTab("pipeline");
                    }}
                    className="btn-ghost text-xs text-primary-600 hover:text-primary-800 font-semibold inline-flex items-center gap-1"
                  >
                    View Pipeline <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: JOB REQUISITIONS ─────────────────────────────────────── */}
      {activeTab === "requisitions" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 text-[10px] uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Req Number & Title</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Vacancies</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {requisitions?.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/70">
                  <td className="py-3 px-4">
                    <p className="font-bold text-gray-900">{r.title}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{r.requisitionNumber}</p>
                  </td>
                  <td className="py-3 px-4">{r.department?.value || "General"}</td>
                  <td className="py-3 px-4 font-bold">{r.vacanciesCount}</td>
                  <td className="py-3 px-4">
                    {r.requestedBy ? `${r.requestedBy.firstName} ${r.requestedBy.lastName}` : "Admin"}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={r.status === "APPROVED" ? "green" : "blue"}>
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CANDIDATE 360 & INTERVIEW DRAWER MODAL ──────────────────────── */}
      <Modal
        open={candidateDetailModalOpen}
        onClose={() => setCandidateDetailModalOpen(false)}
        title={
          applicationDetail
            ? `${applicationDetail.candidateName} — Application`
            : "Candidate Details"
        }
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {/* Move Stage Quick Actions */}
              <span className="text-xs text-gray-500 font-medium">Move Stage:</span>
              <select
                className="input text-xs py-1"
                value={applicationDetail?.stage || "APPLIED"}
                onChange={(e) =>
                  updateStageMutation.mutate({
                    appId: applicationDetail.id,
                    stage: e.target.value,
                  })
                }
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                onClick={() => setScheduleInterviewModalOpen(true)}
              >
                <Calendar className="w-3.5 h-3.5" />
                Schedule Interview
              </button>
              <button
                className="btn-primary text-xs inline-flex items-center gap-1.5"
                onClick={handleCreateOffer}
              >
                <Award className="w-3.5 h-3.5" />
                Generate Offer Letter
              </button>
            </div>
          </div>
        }
      >
        {isCandidateLoading || !applicationDetail ? (
          <PageLoader />
        ) : (
          <div className="space-y-4 text-xs">
            {/* Candidate Header Summary */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {applicationDetail.candidateName}
                </h3>
                <p className="text-xs text-primary-700 font-semibold mt-0.5">
                  Applied for: {applicationDetail.posting?.title} ({applicationDetail.posting?.department?.value || "General"})
                </p>
                <div className="flex items-center gap-4 text-gray-500 text-[11px] mt-1">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-gray-400" /> {applicationDetail.email}
                  </span>
                  {applicationDetail.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-gray-400" /> {applicationDetail.phone}
                    </span>
                  )}
                </div>
              </div>

              {applicationDetail.resumeUrl && (
                <a
                  href={applicationDetail.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-primary-600" />
                  View Resume / CV
                </a>
              )}
            </div>

            {/* Experience & Education */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-gray-400 text-[10px] font-bold uppercase">Experience</p>
                <p className="font-bold text-gray-900 mt-1">
                  {applicationDetail.experienceYears
                    ? `${applicationDetail.experienceYears} Years`
                    : "Not specified"}
                </p>
                <p className="text-gray-500 mt-0.5">{applicationDetail.currentEmployer || "—"}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 sm:col-span-2">
                <p className="text-gray-400 text-[10px] font-bold uppercase">Education & Credentials</p>
                <p className="font-bold text-gray-900 mt-1">
                  {applicationDetail.highestEducation || "Not specified"}
                </p>
              </div>
            </div>

            {/* Cover Letter */}
            {applicationDetail.coverLetter && (
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Cover Letter</p>
                <p className="text-gray-700 whitespace-pre-wrap">{applicationDetail.coverLetter}</p>
              </div>
            )}

            {/* Scheduled Interviews & Structured Feedback */}
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary-600" />
                  Interview Rounds ({applicationDetail.interviews?.length || 0})
                </h4>
              </div>

              {applicationDetail.interviews?.map((inv) => (
                <div key={inv.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{inv.title}</p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(inv.scheduledAt).toLocaleString()} ({inv.durationMinutes} mins) • {inv.format}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedInterviewId(inv.id);
                        setFeedbackModalOpen(true);
                      }}
                      className="btn-secondary text-xs py-1 inline-flex items-center gap-1"
                    >
                      <Star className="w-3 h-3 text-amber-500" /> Submit Score
                    </button>
                  </div>

                  {inv.feedbacks?.length > 0 && (
                    <div className="pt-2 border-t border-gray-200 space-y-1">
                      {inv.feedbacks.map((fb) => (
                        <div key={fb.id} className="bg-white p-2 rounded-lg border border-gray-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-gray-800">{fb.interviewer?.firstName}:</span>{" "}
                            <span className="text-gray-600">{fb.notes || "Feedback submitted"}</span>
                          </div>
                          <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">
                            {fb.score} / 5 ({fb.recommendation})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Generated Offers & Convert to Hire */}
            {applicationDetail.offers?.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <h4 className="font-bold text-gray-900 text-xs">Job Offers Issued</h4>
                {applicationDetail.offers.map((off) => (
                  <div
                    key={off.id}
                    className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-emerald-900 flex items-center gap-2">
                        {off.offerNumber} • {off.positionTitle}
                        <Badge variant="green">{off.status}</Badge>
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Offered: {off.offeredSalary?.toLocaleString()} ETB / {off.salaryPeriod?.toLowerCase()} • Start: {new Date(off.startDate).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadOfferPdf(off.id, off.offerNumber)}
                        className="btn-secondary text-xs py-1 inline-flex items-center gap-1 border-emerald-300 text-emerald-800 bg-white"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF Offer
                      </button>

                      {applicationDetail.stage !== "HIRED" && (
                        <button
                          onClick={() => setHireModalOpen(true)}
                          className="btn-primary text-xs py-1 bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Convert to Employee
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── SCHEDULE INTERVIEW MODAL ────────────────────────────────────── */}
      <Modal
        open={scheduleInterviewModalOpen}
        onClose={() => setScheduleInterviewModalOpen(false)}
        title="Schedule Interview Round"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setScheduleInterviewModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() =>
                scheduleInterviewMutation.mutate({
                  appId: selectedCandidate?.id,
                  payload: interviewForm,
                })
              }
              disabled={scheduleInterviewMutation.isPending || !interviewForm.title}
            >
              {scheduleInterviewMutation.isPending ? "Scheduling…" : "Confirm Interview"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Interview Title</label>
            <input
              className="input text-xs"
              value={interviewForm.title}
              onChange={(e) => setInterviewForm({ ...interviewForm, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Date & Time</label>
              <input
                type="datetime-local"
                className="input text-xs"
                value={interviewForm.scheduledAt}
                onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-bold">Format</label>
              <select
                className="input text-xs"
                value={interviewForm.format}
                onChange={(e) => setInterviewForm({ ...interviewForm, format: e.target.value })}
              >
                <option value="IN_PERSON">In-Person Campus Interview</option>
                <option value="VIDEO_CALL">Video Call (Google Meet / Zoom)</option>
                <option value="PHONE">Phone Screening</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label font-bold">Location or Meeting Link</label>
            <input
              className="input text-xs"
              value={interviewForm.locationOrLink}
              onChange={(e) => setInterviewForm({ ...interviewForm, locationOrLink: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* ── STRUCTURED FEEDBACK MODAL ───────────────────────────────────── */}
      <Modal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        title="Submit Structured Interview Feedback"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setFeedbackModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() =>
                submitFeedbackMutation.mutate({
                  interviewId: selectedInterviewId,
                  payload: feedbackForm,
                })
              }
              disabled={submitFeedbackMutation.isPending}
            >
              {submitFeedbackMutation.isPending ? "Submitting…" : "Save Evaluation"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Score Rating (1 - 5)</label>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                className="input text-xs font-bold"
                value={feedbackForm.score}
                onChange={(e) =>
                  setFeedbackForm({ ...feedbackForm, score: parseFloat(e.target.value) || 5 })
                }
              />
            </div>
            <div>
              <label className="label font-bold">Recommendation</label>
              <select
                className="input text-xs font-bold"
                value={feedbackForm.recommendation}
                onChange={(e) =>
                  setFeedbackForm({ ...feedbackForm, recommendation: e.target.value })
                }
              >
                <option value="STRONG_HIRE">Strong Hire 🔥</option>
                <option value="HIRE">Hire ✅</option>
                <option value="HOLD">Hold / Consider ⏳</option>
                <option value="NO_HIRE">No Hire ❌</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label font-bold">Candidate Strengths</label>
            <textarea
              rows={2}
              className="input text-xs"
              value={feedbackForm.strengths}
              onChange={(e) => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })}
              placeholder="e.g. Excellent pedagogical clarity, strong subject mastery"
            />
          </div>
        </div>
      </Modal>

      {/* ── CREATE OFFER MODAL ──────────────────────────────────────────── */}
      <Modal
        open={offerModalOpen}
        onClose={() => setOfferModalOpen(false)}
        title="Generate Official Employment Offer"
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setOfferModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() =>
                createOfferMutation.mutate({
                  appId: selectedCandidate?.id,
                  payload: offerForm,
                })
              }
              disabled={createOfferMutation.isPending || !offerForm.positionTitle}
            >
              {createOfferMutation.isPending ? "Generating…" : "Generate Offer Letter"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Position Title</label>
              <input
                className="input text-xs"
                value={offerForm.positionTitle}
                onChange={(e) => setOfferForm({ ...offerForm, positionTitle: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-bold">Department</label>
              <input
                className="input text-xs"
                value={offerForm.departmentName}
                onChange={(e) => setOfferForm({ ...offerForm, departmentName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Monthly Offered Salary (ETB)</label>
              <input
                type="number"
                className="input text-xs font-bold"
                value={offerForm.offeredSalary}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, offeredSalary: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="label font-bold">Target Start Date</label>
              <input
                type="date"
                className="input text-xs"
                value={offerForm.startDate}
                onChange={(e) => setOfferForm({ ...offerForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label font-bold">Probation Period (Months)</label>
              <input
                type="number"
                className="input text-xs"
                value={offerForm.probationMonths}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, probationMonths: parseInt(e.target.value) || 3 })
                }
              />
            </div>
          </div>

          <div>
            <label className="label font-bold">Benefits & Allowances</label>
            <input
              className="input text-xs"
              value={offerForm.benefits}
              onChange={(e) => setOfferForm({ ...offerForm, benefits: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* ── CONVERT TO HIRE MODAL ──────────────────────────────────────── */}
      <Modal
        open={hireModalOpen}
        onClose={() => setHireModalOpen(false)}
        title="One-Click Hire: Convert Candidate to Employee"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setHireModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={() =>
                convertToHireMutation.mutate({
                  offerId: applicationDetail?.offers?.[0]?.id,
                  payload: hireForm,
                })
              }
              disabled={convertToHireMutation.isPending}
            >
              {convertToHireMutation.isPending ? "Creating Employee Record…" : "Confirm Hire"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-gray-600">
            This will automatically convert candidate <span className="font-bold text-gray-900">{applicationDetail?.candidateName}</span> into an official Employee record with an initialized onboarding checklist.
          </p>

          <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-gray-100">
            <input
              type="checkbox"
              checked={hireForm.createUserAccount}
              onChange={(e) => setHireForm({ ...hireForm, createUserAccount: e.target.checked })}
              className="rounded text-emerald-600"
            />
            <span className="font-bold text-gray-800">
              Provision Portal Login Account Immediately
            </span>
          </label>

          {hireForm.createUserAccount && (
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2.5">
              <div>
                <label className="label font-bold">System Role</label>
                <select
                  className="input text-xs font-bold"
                  value={hireForm.userRole}
                  onChange={(e) => setHireForm({ ...hireForm, userRole: e.target.value })}
                >
                  <option value="TEACHER">Teacher / Faculty</option>
                  <option value="ADMIN">School Administrator</option>
                  <option value="FINANCE">Finance Officer</option>
                </select>
              </div>
              <div>
                <label className="label font-bold">Initial Password</label>
                <input
                  className="input text-xs font-mono"
                  value={hireForm.userPassword}
                  onChange={(e) => setHireForm({ ...hireForm, userPassword: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── CREATE REQUISITION MODAL ────────────────────────────────────── */}
      <Modal
        open={createReqModalOpen}
        onClose={() => setCreateReqModalOpen(false)}
        title="Create Job Requisition"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setCreateReqModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() => createReqMutation.mutate(reqForm)}
              disabled={createReqMutation.isPending || !reqForm.title}
            >
              {createReqMutation.isPending ? "Submitting…" : "Create Requisition"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Job Title *</label>
            <input
              className="input text-xs"
              value={reqForm.title}
              onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })}
              placeholder="e.g. High School Biology Instructor"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LookupSelect
              type="DEPARTMENT"
              label="Department"
              value={reqForm.departmentId}
              onChange={(id) => setReqForm({ ...reqForm, departmentId: id })}
            />
            <div>
              <label className="label font-bold">Vacancies Count</label>
              <input
                type="number"
                min="1"
                className="input text-xs"
                value={reqForm.vacanciesCount}
                onChange={(e) =>
                  setReqForm({ ...reqForm, vacanciesCount: parseInt(e.target.value) || 1 })
                }
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── CREATE POSTING MODAL ────────────────────────────────────────── */}
      <Modal
        open={createPostingModalOpen}
        onClose={() => setCreatePostingModalOpen(false)}
        title="Publish Job Posting"
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button className="btn-secondary text-xs" onClick={() => setCreatePostingModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() => createPostingMutation.mutate(postingForm)}
              disabled={createPostingMutation.isPending || !postingForm.title || !postingForm.description}
            >
              {createPostingMutation.isPending ? "Publishing…" : "Publish Job Posting"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="label font-bold">Posting Title *</label>
            <input
              className="input text-xs"
              value={postingForm.title}
              onChange={(e) => setPostingForm({ ...postingForm, title: e.target.value })}
              placeholder="e.g. Senior ICT & Computer Science Teacher"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LookupSelect
              type="DEPARTMENT"
              label="Department"
              value={postingForm.departmentId}
              onChange={(id) => setPostingForm({ ...postingForm, departmentId: id })}
            />
            <div>
              <label className="label font-bold">Salary Range</label>
              <input
                className="input text-xs"
                value={postingForm.salaryRange}
                onChange={(e) => setPostingForm({ ...postingForm, salaryRange: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label font-bold">Job Description *</label>
            <textarea
              rows={3}
              className="input text-xs"
              value={postingForm.description}
              onChange={(e) => setPostingForm({ ...postingForm, description: e.target.value })}
              placeholder="Detailed job description and responsibilities..."
              required
            />
          </div>
          <div>
            <label className="label font-bold">Key Requirements</label>
            <textarea
              rows={2}
              className="input text-xs"
              value={postingForm.requirements}
              onChange={(e) => setPostingForm({ ...postingForm, requirements: e.target.value })}
              placeholder="Qualifications, years of experience, teaching licenses required..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
