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
  Upload,
  Image as ImageIcon,
  FileDown,
  Globe,
  Share2,
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
  const [bannerUploading, setBannerUploading] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedInterviewId, setSelectedInterviewId] = useState(null);
  const [editingPosting, setEditingPosting] = useState(null);
  const [deleteConfirmPosting, setDeleteConfirmPosting] = useState(null);

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
    requisitionId: "",
    departmentId: "",
    positionId: "",
    employmentType: "FULL_TIME",
    location: "Main Campus",
    description: "",
    requirements: "",
    benefits: "Tuition waiver for staff children, medical coverage, transport subsidy.",
    salaryType: "RANGE",
    salaryRange: "20,000 - 30,000 ETB",
    salaryFixedAmount: "",
    salaryCurrency: "USD",
    closingDate: "",
    publishNow: true,

    // Marketing Flyer Fields
    bannerImageUrl: "",
    companyTagline: "",
    applicationDeadlineNote: "",
    socialLinks: [],
    flyerTheme: "default",
    contactEmail: "",
    contactPhone: "",
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
    mutationFn: (payload) => {
      const cleaned = {
        ...payload,
        requisitionId: payload.requisitionId || null,
        departmentId: payload.departmentId || null,
        positionId: payload.positionId || null,
        location: payload.location || null,
        requirements: payload.requirements || null,
        benefits: payload.benefits || null,
        salaryRange: payload.salaryRange || null,
        salaryFixedAmount:
          payload.salaryType === "FIXED" && payload.salaryFixedAmount
            ? parseFloat(payload.salaryFixedAmount)
            : null,
        closingDate: payload.closingDate || null,
        bannerImageUrl: payload.bannerImageUrl || null,
        companyTagline: payload.companyTagline || null,
        applicationDeadlineNote: payload.applicationDeadlineNote || null,
        contactEmail: payload.contactEmail || null,
        contactPhone: payload.contactPhone || null,
        socialLinks: (payload.socialLinks || [])
          .filter((s) => s.url && s.url.trim() !== "")
          .map((s) => ({
            platform: s.platform || "telegram",
            label: s.label || "",
            url: s.url.trim().startsWith("http") ? s.url.trim() : `https://${s.url.trim()}`,
          })),
      };
      return api.post("/recruiting/postings", cleaned);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-postings"] });
      qc.invalidateQueries({ queryKey: ["recruiting-dashboard"] });
      toast.success("Job posting published successfully");
      setCreatePostingModalOpen(false);
    },
    onError: (err) => {
      const fieldErrors = err.response?.data?.errors
        ?.map((e) => `${e.field ? e.field + ": " : ""}${e.message}`)
        .join(", ");
      const msg = fieldErrors || err.response?.data?.message || "Failed to publish job posting";
      toast.error(msg);
    },
  });

  const updatePostingMutation = useMutation({
    mutationFn: ({ id, payload }) => {
      const cleaned = {
        ...payload,
        requisitionId: payload.requisitionId || null,
        departmentId: payload.departmentId || null,
        positionId: payload.positionId || null,
        location: payload.location || null,
        requirements: payload.requirements || null,
        benefits: payload.benefits || null,
        salaryRange: payload.salaryRange || null,
        salaryFixedAmount:
          payload.salaryType === "FIXED" && payload.salaryFixedAmount
            ? parseFloat(payload.salaryFixedAmount)
            : null,
        closingDate: payload.closingDate || null,
        bannerImageUrl: payload.bannerImageUrl || null,
        companyTagline: payload.companyTagline || null,
        applicationDeadlineNote: payload.applicationDeadlineNote || null,
        contactEmail: payload.contactEmail || null,
        contactPhone: payload.contactPhone || null,
        socialLinks: (payload.socialLinks || [])
          .filter((s) => s.url && s.url.trim() !== "")
          .map((s) => ({
            platform: s.platform || "telegram",
            label: s.label || "",
            url: s.url.trim().startsWith("http") ? s.url.trim() : `https://${s.url.trim()}`,
          })),
      };
      return api.patch(`/recruiting/postings/${id}`, cleaned);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-postings"] });
      qc.invalidateQueries({ queryKey: ["recruiting-dashboard"] });
      toast.success("Job posting updated successfully");
      setCreatePostingModalOpen(false);
      setEditingPosting(null);
    },
    onError: (err) => {
      const fieldErrors = err.response?.data?.errors
        ?.map((e) => `${e.field ? e.field + ": " : ""}${e.message}`)
        .join(", ");
      const msg = fieldErrors || err.response?.data?.message || "Failed to update job posting";
      toast.error(msg);
    },
  });

  const changePostingStatusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/recruiting/postings/${id}`, { status }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["job-postings"] });
      qc.invalidateQueries({ queryKey: ["recruiting-dashboard"] });
      toast.success(`Job posting status updated to ${vars.status}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to change posting status");
    },
  });

  const deletePostingMutation = useMutation({
    mutationFn: (id) => api.delete(`/recruiting/postings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-postings"] });
      qc.invalidateQueries({ queryKey: ["recruiting-dashboard"] });
      toast.success("Job posting deleted and removed from channel");
      setDeleteConfirmPosting(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete job posting");
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

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file must be under 5MB");
      return;
    }

    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "MARKETING_FLYER");
      const res = await api.post("/files/upload", formData);
      const url = res.data?.data?.url || res.data?.url;
      if (url) {
        setPostingForm((prev) => ({ ...prev, bannerImageUrl: url }));
        toast.success("Banner image uploaded successfully");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload banner image");
    } finally {
      setBannerUploading(false);
    }
  };

  const handleAddSocialLink = () => {
    setPostingForm((prev) => ({
      ...prev,
      socialLinks: [
        ...(prev.socialLinks || []),
        { platform: "linkedin", url: "", label: "" },
      ],
    }));
  };

  const handleUpdateSocialLink = (index, field, val) => {
    setPostingForm((prev) => {
      const updated = [...(prev.socialLinks || [])];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, socialLinks: updated };
    });
  };

  const handleOpenCreatePosting = () => {
    setEditingPosting(null);
    setPostingForm({
      title: "",
      requisitionId: "",
      departmentId: "",
      positionId: "",
      employmentType: "FULL_TIME",
      location: "Main Campus",
      description: "",
      requirements: "",
      benefits: "Tuition waiver for staff children, medical coverage, transport subsidy.",
      salaryType: "RANGE",
      salaryRange: "20,000 - 30,000 ETB",
      salaryFixedAmount: "",
      salaryCurrency: "USD",
      closingDate: "",
      status: "PUBLISHED",
      publishNow: true,
      bannerImageUrl: "",
      companyTagline: "",
      applicationDeadlineNote: "",
      socialLinks: [],
      flyerTheme: "default",
      contactEmail: "",
      contactPhone: "",
    });
    setCreatePostingModalOpen(true);
  };

  const handleOpenEditPosting = (p) => {
    setEditingPosting(p);
    setPostingForm({
      title: p.title || "",
      requisitionId: p.requisitionId || "",
      departmentId: p.departmentId || "",
      positionId: p.positionId || "",
      employmentType: p.employmentType || "FULL_TIME",
      location: p.location || "Main Campus",
      description: p.description || "",
      requirements: p.requirements || "",
      benefits: p.benefits || "",
      salaryType: p.salaryType || "RANGE",
      salaryRange: p.salaryRange || "",
      salaryFixedAmount: p.salaryFixedAmount || "",
      salaryCurrency: p.salaryCurrency || "USD",
      closingDate: p.closingDate ? new Date(p.closingDate).toISOString().split("T")[0] : "",
      status: p.status || "DRAFT",
      publishNow: p.status === "PUBLISHED",
      bannerImageUrl: p.bannerImageUrl || "",
      companyTagline: p.companyTagline || "",
      applicationDeadlineNote: p.applicationDeadlineNote || "",
      socialLinks: Array.isArray(p.socialLinks) ? p.socialLinks : [],
      flyerTheme: p.flyerTheme || "default",
      contactEmail: p.contactEmail || "",
      contactPhone: p.contactPhone || "",
    });
    setCreatePostingModalOpen(true);
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
            onClick={handleOpenCreatePosting}
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
                className="bg-white rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all"
              >
                {p.bannerImageUrl && (
                  <div className="h-28 w-full overflow-hidden bg-gray-100 relative">
                    <img
                      src={p.bannerImageUrl}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 text-sm">{p.title}</h3>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge
                          variant={
                            p.status === "PUBLISHED"
                              ? "green"
                              : p.status === "CLOSED"
                              ? "red"
                              : "gray"
                          }
                        >
                          {p.status}
                        </Badge>
                        {p.telegramPostedAt && (
                          <span
                            className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-1"
                            title={`Posted to Telegram channel on ${new Date(p.telegramPostedAt).toLocaleString()}`}
                          >
                            📢 Telegram
                          </span>
                        )}
                      </div>
                    </div>

                    {p.companyTagline && (
                      <p className="text-[11px] text-gray-500 italic mt-0.5 line-clamp-1">
                        {p.companyTagline}
                      </p>
                    )}

                    <p className="text-xs text-primary-700 font-semibold mt-1">
                      {p.department?.value || "General"} • {p.employmentType?.replace("_", " ")}
                    </p>

                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{p.description}</p>
                  </div>

                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800">
                        {p._count?.applications || 0} Applicants
                      </span>
                      {p.salaryType !== "UNDISCLOSED" && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {p.salaryType === "FIXED"
                            ? `${p.salaryFixedAmount?.toLocaleString()} ${p.salaryCurrency || "USD"}`
                            : p.salaryType === "NEGOTIABLE"
                            ? "Negotiable"
                            : p.salaryRange || "Competitive"}
                        </span>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center justify-between pt-1 gap-1">
                      <div className="flex items-center gap-1">
                        <a
                          href={`/api/v1/recruiting/postings/${p.id}/preview-flyer.pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-[11px] py-1 px-2 inline-flex items-center gap-1"
                          title="Download / View Flyer PDF"
                        >
                          <FileDown className="w-3.5 h-3.5 text-primary-600" />
                          Flyer
                        </a>

                        {p.status === "PUBLISHED" ? (
                          <button
                            onClick={() =>
                              changePostingStatusMutation.mutate({ id: p.id, status: "CLOSED" })
                            }
                            disabled={changePostingStatusMutation.isPending}
                            className="btn-secondary text-[11px] py-1 px-2 text-amber-700 hover:text-amber-800"
                            title="Close this job posting"
                          >
                            Close
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              changePostingStatusMutation.mutate({ id: p.id, status: "PUBLISHED" })
                            }
                            disabled={changePostingStatusMutation.isPending}
                            className="btn-secondary text-[11px] py-1 px-2 text-emerald-700 hover:text-emerald-800"
                            title="Publish to career board & Telegram"
                          >
                            Publish
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEditPosting(p)}
                          className="p-1 text-gray-400 hover:text-primary-600 rounded transition"
                          title="Edit Posting"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirmPosting(p)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                          title="Delete Posting (and remove announcement from Telegram)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedPostingId(p.id);
                          setActiveTab("pipeline");
                        }}
                        className="btn-ghost text-xs text-primary-600 hover:text-primary-800 font-semibold inline-flex items-center gap-0.5"
                      >
                        Pipeline <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
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

      {/* ── CREATE / EDIT POSTING MODAL ─────────────────────────────────── */}
      <Modal
        open={createPostingModalOpen}
        onClose={() => {
          setCreatePostingModalOpen(false);
          setEditingPosting(null);
        }}
        title={editingPosting ? `Edit Job Posting — ${editingPosting.title}` : "Publish Rich Job Posting & Marketing Flyer"}
        size="xl"
        footer={
          <div className="flex justify-end items-center gap-2 w-full">
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                setCreatePostingModalOpen(false);
                setEditingPosting(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() => {
                if (editingPosting) {
                  updatePostingMutation.mutate({ id: editingPosting.id, payload: postingForm });
                } else {
                  createPostingMutation.mutate(postingForm);
                }
              }}
              disabled={
                (editingPosting ? updatePostingMutation.isPending : createPostingMutation.isPending) ||
                !postingForm.title ||
                !postingForm.description
              }
            >
              {editingPosting
                ? updatePostingMutation.isPending
                  ? "Saving Changes…"
                  : "Save Changes"
                : createPostingMutation.isPending
                ? "Publishing…"
                : postingForm.publishNow
                ? "Publish Job Posting"
                : "Save as Draft"}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
          {/* 1. Banner Image Upload */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="label font-bold flex items-center gap-1.5 mb-0">
                <ImageIcon className="w-4 h-4 text-primary-600" />
                Marketing Banner Flyer Image
              </label>
              <span className="text-[11px] text-gray-400">
                JPG, PNG, WebP up to 5MB
              </span>
            </div>

            {postingForm.bannerImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 h-36 w-full group">
                <img
                  src={postingForm.bannerImageUrl}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPostingForm({ ...postingForm, bannerImageUrl: "" })
                  }
                  className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg shadow-md hover:bg-red-700 transition"
                  title="Remove Image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-gray-300 hover:border-primary-500 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white transition text-center">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="font-semibold text-gray-700">
                  {bannerUploading
                    ? "Uploading image…"
                    : "Click to upload banner image"}
                </span>
                <span className="text-[10px] text-gray-400">
                  Will be displayed on the public career page and generated flyer PDF
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  disabled={bannerUploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* 2. Title & Tagline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Posting Title *</label>
              <input
                className="input text-xs"
                value={postingForm.title}
                onChange={(e) =>
                  setPostingForm({ ...postingForm, title: e.target.value })
                }
                placeholder="e.g. Senior ICT & Computer Science Teacher"
                required
              />
            </div>
            <div>
              <label className="label font-bold">Marketing Tagline / Slogan</label>
              <input
                className="input text-xs"
                value={postingForm.companyTagline}
                onChange={(e) =>
                  setPostingForm({
                    ...postingForm,
                    companyTagline: e.target.value,
                  })
                }
                placeholder="e.g. Inspiring Future Innovators and Global Thinkers"
              />
            </div>
          </div>

          {/* 3. Requisition, Department & Employment Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Linked Requisition</label>
              <select
                className="input text-xs"
                value={postingForm.requisitionId || ""}
                onChange={(e) =>
                  setPostingForm({
                    ...postingForm,
                    requisitionId: e.target.value || null,
                  })
                }
              >
                <option value="">None (Independent Posting)</option>
                {requisitions?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.requisitionNumber} — {r.title}
                  </option>
                ))}
              </select>
            </div>
            <LookupSelect
              type="DEPARTMENT"
              label="Department"
              value={postingForm.departmentId}
              onChange={(id) =>
                setPostingForm({ ...postingForm, departmentId: id })
              }
            />
            <div>
              <label className="label font-bold">Employment Type</label>
              <select
                className="input text-xs"
                value={postingForm.employmentType}
                onChange={(e) =>
                  setPostingForm({
                    ...postingForm,
                    employmentType: e.target.value,
                  })
                }
              >
                <option value="FULL_TIME">Full-Time</option>
                <option value="PART_TIME">Part-Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="TEMPORARY">Temporary / Seasonal</option>
                <option value="INTERN">Internship</option>
              </select>
            </div>
          </div>

          {/* 4. Location & Contact Overrides */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label font-bold">Campus / Location</label>
              <input
                className="input text-xs"
                value={postingForm.location}
                onChange={(e) =>
                  setPostingForm({ ...postingForm, location: e.target.value })
                }
                placeholder="e.g. Main Campus / Secondary Wing"
              />
            </div>
            <div>
              <label className="label font-bold">Inquiries Contact Email</label>
              <input
                type="email"
                className="input text-xs"
                value={postingForm.contactEmail}
                onChange={(e) =>
                  setPostingForm({ ...postingForm, contactEmail: e.target.value })
                }
                placeholder="careers@timhirthub.edu.et"
              />
            </div>
            <div>
              <label className="label font-bold">Inquiries Phone</label>
              <input
                className="input text-xs"
                value={postingForm.contactPhone}
                onChange={(e) =>
                  setPostingForm({ ...postingForm, contactPhone: e.target.value })
                }
                placeholder="+251 91 123 4567"
              />
            </div>
          </div>

          {/* 5. Salary Configuration */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="label font-bold text-gray-900 mb-0 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Compensation &amp; Salary Structure
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label font-semibold">Salary Display Mode</label>
                <select
                  className="input text-xs font-bold"
                  value={postingForm.salaryType}
                  onChange={(e) =>
                    setPostingForm({ ...postingForm, salaryType: e.target.value })
                  }
                >
                  <option value="RANGE">Salary Range (e.g. Min - Max)</option>
                  <option value="FIXED">Fixed Exact Salary</option>
                  <option value="NEGOTIABLE">Negotiable</option>
                  <option value="UNDISCLOSED">Undisclosed (Keep Hidden)</option>
                </select>
              </div>

              {postingForm.salaryType === "RANGE" && (
                <div className="sm:col-span-2">
                  <label className="label font-semibold">Salary Range Text *</label>
                  <input
                    className="input text-xs font-bold text-emerald-700"
                    value={postingForm.salaryRange}
                    onChange={(e) =>
                      setPostingForm({ ...postingForm, salaryRange: e.target.value })
                    }
                    placeholder="e.g. 25,000 - 35,000 ETB / month"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Auto-derived from linked requisition if left blank.
                  </p>
                </div>
              )}

              {postingForm.salaryType === "FIXED" && (
                <>
                  <div>
                    <label className="label font-semibold">Fixed Amount *</label>
                    <input
                      type="number"
                      min="1"
                      className="input text-xs font-bold text-emerald-700"
                      value={postingForm.salaryFixedAmount}
                      onChange={(e) =>
                        setPostingForm({
                          ...postingForm,
                          salaryFixedAmount: parseFloat(e.target.value) || "",
                        })
                      }
                      placeholder="e.g. 30000"
                    />
                  </div>
                  <div>
                    <label className="label font-semibold">Currency</label>
                    <input
                      className="input text-xs font-bold"
                      value={postingForm.salaryCurrency}
                      onChange={(e) =>
                        setPostingForm({
                          ...postingForm,
                          salaryCurrency: e.target.value,
                        })
                      }
                      placeholder="e.g. USD, ETB, EUR"
                    />
                  </div>
                </>
              )}

              {(postingForm.salaryType === "NEGOTIABLE" ||
                postingForm.salaryType === "UNDISCLOSED") && (
                <div className="sm:col-span-2 flex items-center text-gray-500 text-xs italic bg-white p-2.5 rounded-xl border border-gray-200">
                  {postingForm.salaryType === "NEGOTIABLE"
                    ? "Salary will be presented as 'Negotiable' across public job board and marketing flyers."
                    : "Salary numbers are kept private and completely omitted from public listings and flyers."}
                </div>
              )}
            </div>
          </div>

          {/* 6. Closing Date & Deadline Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Application Closing Date</label>
              <input
                type="date"
                className="input text-xs"
                value={postingForm.closingDate}
                onChange={(e) =>
                  setPostingForm({ ...postingForm, closingDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label font-bold">Deadline Note / Urgency</label>
              <input
                className="input text-xs"
                value={postingForm.applicationDeadlineNote}
                onChange={(e) =>
                  setPostingForm({
                    ...postingForm,
                    applicationDeadlineNote: e.target.value,
                  })
                }
                placeholder="e.g. Interviews scheduled on rolling basis"
              />
            </div>
          </div>

          {/* 7. Description, Requirements, Benefits */}
          <div>
            <label className="label font-bold">Role Description &amp; Responsibilities *</label>
            <textarea
              rows={3}
              className="input text-xs"
              value={postingForm.description}
              onChange={(e) =>
                setPostingForm({ ...postingForm, description: e.target.value })
              }
              placeholder="Detailed job description and key day-to-day duties..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label font-bold">Key Qualifications &amp; Requirements</label>
              <textarea
                rows={2}
                className="input text-xs"
                value={postingForm.requirements}
                onChange={(e) =>
                  setPostingForm({ ...postingForm, requirements: e.target.value })
                }
                placeholder="Required degrees, licenses, years of experience..."
              />
            </div>
            <div>
              <label className="label font-bold">Benefits &amp; Perks</label>
              <textarea
                rows={2}
                className="input text-xs"
                value={postingForm.benefits}
                onChange={(e) =>
                  setPostingForm({ ...postingForm, benefits: e.target.value })
                }
                placeholder="Medical coverage, tuition discounts, housing allowance..."
              />
            </div>
          </div>

          {/* 8. Social Channels & Marketing Links */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="label font-bold text-gray-900 mb-0 flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-primary-600" />
                Social Media &amp; Flyer Contact Links ({postingForm.socialLinks?.length || 0})
              </label>
              <button
                type="button"
                onClick={handleAddSocialLink}
                className="btn-secondary text-[11px] py-1 px-2 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-primary-600" /> Add Link
              </button>
            </div>

            {postingForm.socialLinks?.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic">
                No social channels added yet. Add LinkedIn, WhatsApp, or Telegram links to appear on the flyer.
              </p>
            ) : (
              <div className="space-y-2">
                {postingForm.socialLinks.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      className="input text-xs py-1.5 w-36 font-semibold"
                      value={s.platform}
                      onChange={(e) =>
                        handleUpdateSocialLink(idx, "platform", e.target.value)
                      }
                    >
                      <option value="linkedin">LinkedIn</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telegram">Telegram</option>
                      <option value="facebook">Facebook</option>
                      <option value="x">X / Twitter</option>
                      <option value="instagram">Instagram</option>
                      <option value="website">Website</option>
                      <option value="other">Other</option>
                    </select>

                    <input
                      type="url"
                      className="input text-xs py-1.5 flex-1"
                      placeholder="https://..."
                      value={s.url}
                      onChange={(e) =>
                        handleUpdateSocialLink(idx, "url", e.target.value)
                      }
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveSocialLink(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
                      title="Remove Link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 9. Publish Immediately Toggle */}
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={postingForm.publishNow}
              onChange={(e) =>
                setPostingForm({
                  ...postingForm,
                  publishNow: e.target.checked,
                  status: e.target.checked ? "PUBLISHED" : "DRAFT",
                })
              }
              className="rounded text-primary-600"
            />
            <span className="font-bold text-gray-800 text-xs">
              Publish on Public Careers Board &amp; Telegram Immediately
            </span>
          </label>
        </div>
      </Modal>

      {/* ── DELETE POSTING CONFIRMATION MODAL ─────────────────────────── */}
      <Modal
        open={Boolean(deleteConfirmPosting)}
        onClose={() => setDeleteConfirmPosting(null)}
        title="Delete Job Posting"
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button
              className="btn-secondary text-xs"
              onClick={() => setDeleteConfirmPosting(null)}
              disabled={deletePostingMutation.isPending}
            >
              Cancel
            </button>
            <button
              className="btn-danger text-xs"
              onClick={() => deletePostingMutation.mutate(deleteConfirmPosting?.id)}
              disabled={deletePostingMutation.isPending}
            >
              {deletePostingMutation.isPending ? "Deleting…" : "Delete Job"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-gray-600">
          <p>
            Are you sure you want to delete{" "}
            <span className="font-bold text-gray-900">"{deleteConfirmPosting?.title}"</span>?
          </p>
          {deleteConfirmPosting?.telegramPostedAt && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-[11px]">
              📢 <b>Telegram Channel Sync:</b> The announcement message in your Telegram channel will also be automatically deleted.
            </div>
          )}
          <p className="text-gray-400 text-[11px]">
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
