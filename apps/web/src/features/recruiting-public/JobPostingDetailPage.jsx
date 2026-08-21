import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Briefcase,
  Building,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle2,
  Send,
  FileText,
  GraduationCap,
  Sparkles,
  Download,
  Share2,
  ArrowLeft,
  Coins,
  Clock,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Facebook,
  Instagram,
  MessageCircle,
  Link as LinkIcon,
  Check,
  Award,
} from "lucide-react";
import api from "../../lib/api";
import { PageLoader, EmptyState, Badge, Modal } from "../../components/ui/index";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function JobPostingDetailPage() {
  const { schoolSlug = "timhirthub-academy", postingSlug } = useParams();
  const [isSuccessSubmitted, setIsSuccessSubmitted] = useState(false);

  const [form, setForm] = useState({
    candidateName: "",
    email: "",
    phone: "",
    experienceYears: 3,
    highestEducation: "Bachelor's Degree / B.Ed",
    currentEmployer: "",
    resumeUrl: "",
    coverLetter: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-job-detail", schoolSlug, postingSlug],
    queryFn: () =>
      api
        .get(`/recruiting/public/${schoolSlug}/jobs/${postingSlug}`)
        .then((r) => r.data.data),
  });

  const school = data?.school;
  const posting = data?.posting;

  const applyMutation = useMutation({
    mutationFn: (payload) =>
      api.post(`/recruiting/public/${schoolSlug}/jobs/${posting?.id}/apply`, payload),
    onSuccess: () => {
      setIsSuccessSubmitted(true);
      toast.success("Application submitted successfully!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit application");
    },
  });

  const handleSubmitApplication = (e) => {
    e.preventDefault();
    if (!form.candidateName || !form.email) {
      toast.error("Please fill in your name and email address");
      return;
    }
    applyMutation.mutate(form);
  };

  const getSocialIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case "linkedin":
        return <Linkedin className="w-4 h-4 text-[#0077b5]" />;
      case "facebook":
        return <Facebook className="w-4 h-4 text-[#1877f2]" />;
      case "instagram":
        return <Instagram className="w-4 h-4 text-[#e4405f]" />;
      case "whatsapp":
      case "telegram":
        return <MessageCircle className="w-4 h-4 text-[#25d366]" />;
      case "website":
      default:
        return <Globe className="w-4 h-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <PageLoader />
      </div>
    );
  }

  if (error || !posting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="card p-8 max-w-md w-full text-center space-y-4 shadow-md">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Job Not Found</h2>
          <p className="text-sm text-gray-500">
            This job posting is no longer available, was unpublished, or has passed its application deadline.
          </p>
          <Link to={`/careers/${schoolSlug}`} className="btn-primary text-xs py-2 inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to Careers
          </Link>
        </div>
      </div>
    );
  }

  const flyerPdfUrl = `/api/v1/recruiting/public/${schoolSlug}/jobs/${posting.slug}/flyer.pdf`;

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to={`/careers/${schoolSlug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-primary-600 transition"
          >
            <ArrowLeft className="w-4 h-4" /> All {school?.name || "School"} Careers
          </Link>

          <a
            href={flyerPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 shadow-sm border-gray-300"
          >
            <Download className="w-3.5 h-3.5 text-primary-600" />
            Download Flyer (PDF)
          </a>
        </div>

        {/* Main Job Card */}
        <div className="card overflow-hidden shadow-lg border border-gray-200/80">
          {/* Banner Image */}
          {posting.bannerImageUrl && (
            <div className="w-full h-56 sm:h-72 overflow-hidden bg-gray-100 relative">
              <img
                src={posting.bannerImageUrl}
                alt={posting.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 text-white">
                <span className="bg-primary-600/90 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {posting.department?.value || "Academic Faculty"}
                </span>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            {/* Header / Title */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {!posting.bannerImageUrl && (
                  <span className="bg-primary-50 text-primary-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {posting.department?.value || "Academic Faculty"}
                  </span>
                )}
                <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  {posting.employmentType?.replace(/_/g, " ")}
                </span>
                {posting.salaryDisplay && (
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> {posting.salaryDisplay}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {posting.title}
              </h1>

              {posting.companyTagline && (
                <p className="text-sm font-medium text-gray-500 italic">
                  {posting.companyTagline}
                </p>
              )}

              <p className="text-xs text-primary-700 font-semibold pt-1">
                {school?.name} • {posting.location || school?.city || "Campus"}
              </p>
            </div>

            {/* Key Facts Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-gray-400 font-bold uppercase text-[10px]">Employment</span>
                <p className="font-bold text-gray-800 mt-0.5">{posting.employmentType?.replace(/_/g, " ")}</p>
              </div>
              <div>
                <span className="text-gray-400 font-bold uppercase text-[10px]">Location</span>
                <p className="font-bold text-gray-800 mt-0.5">{posting.location || "Campus"}</p>
              </div>
              <div>
                <span className="text-gray-400 font-bold uppercase text-[10px]">Salary Offer</span>
                <p className="font-bold text-emerald-700 mt-0.5">{posting.salaryDisplay || "Undisclosed"}</p>
              </div>
              <div>
                <span className="text-gray-400 font-bold uppercase text-[10px]">Deadline</span>
                <p className="font-bold text-gray-800 mt-0.5">
                  {posting.closingDate
                    ? new Date(posting.closingDate).toLocaleDateString()
                    : "Rolling Admission"}
                </p>
              </div>
            </div>

            {/* Social Share / Connect Row */}
            {Array.isArray(posting.socialLinks) && posting.socialLinks.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs font-semibold text-gray-500 mr-1">Share / Connect:</span>
                <div className="flex flex-wrap gap-2">
                  {posting.socialLinks.map((s, idx) => (
                    <a
                      key={idx}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-2xs transition"
                    >
                      {getSocialIcon(s.platform)}
                      <span className="capitalize">{s.label || s.platform}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Description Section */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary-600" /> Role Overview &amp; Responsibilities
              </h2>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {posting.description}
              </div>
            </div>

            {/* Requirements Section */}
            {posting.requirements && (
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-primary-600" /> Qualifications &amp; Requirements
                </h2>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {posting.requirements}
                </div>
              </div>
            )}

            {/* Benefits Section */}
            {posting.benefits && (
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" /> What We Offer &amp; Benefits
                </h2>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {posting.benefits}
                </div>
              </div>
            )}

            {/* Contact / Inquiries Note */}
            {(posting.contactEmail || posting.contactPhone || posting.applicationDeadlineNote) && (
              <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl text-xs space-y-1 text-amber-900">
                <p className="font-bold">Important Application Note:</p>
                {posting.applicationDeadlineNote && <p>{posting.applicationDeadlineNote}</p>}
                <div className="flex flex-wrap gap-4 pt-1 text-amber-800">
                  {posting.contactEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {posting.contactEmail}
                    </span>
                  )}
                  {posting.contactPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {posting.contactPhone}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── APPLY NOW SECTION ─────────────────────────────────────────────── */}
        <div id="apply" className="card p-6 sm:p-8 shadow-lg border border-gray-200/80 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-primary-600" /> Apply for this Position
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Submit your credentials directly to the {school?.name || "School"} Human Resources panel.
            </p>
          </div>

          {isSuccessSubmitted ? (
            <div className="p-8 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-emerald-900">Application Submitted!</h3>
              <p className="text-xs text-emerald-700 max-w-md mx-auto">
                Thank you for applying. The recruiting committee will review your application and contact you regarding next interview steps.
              </p>
              <Link to={`/careers/${schoolSlug}`} className="btn-secondary text-xs py-2 inline-flex items-center gap-1.5 mt-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Careers
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmitApplication} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label font-bold">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="input text-xs"
                    placeholder="e.g. Dr. Abebe Bikila"
                    value={form.candidateName}
                    onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label font-bold">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="input text-xs"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label font-bold">Phone Number</label>
                  <input
                    type="tel"
                    className="input text-xs"
                    placeholder="+251 91 123 4567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label font-bold">Years of Experience</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="input text-xs"
                    value={form.experienceYears}
                    onChange={(e) =>
                      setForm({ ...form, experienceYears: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="label font-bold">Highest Degree / License</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="e.g. Master of Education"
                    value={form.highestEducation}
                    onChange={(e) => setForm({ ...form, highestEducation: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label font-bold">Current or Most Recent Employer</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="e.g. Addis Ababa Secondary School"
                    value={form.currentEmployer}
                    onChange={(e) => setForm({ ...form, currentEmployer: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label font-bold">Resume / CV Link (Google Drive, Cloudinary, etc.)</label>
                  <input
                    type="url"
                    className="input text-xs"
                    placeholder="https://drive.google.com/..."
                    value={form.resumeUrl}
                    onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label font-bold">Cover Letter / Personal Statement</label>
                <textarea
                  rows={4}
                  className="input text-xs"
                  placeholder="Introduce yourself, your teaching philosophy, and why you are excited to join our school..."
                  value={form.coverLetter}
                  onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={applyMutation.isPending}
                  className="btn-primary text-xs py-2.5 px-6 font-bold inline-flex items-center gap-2 shadow-md"
                >
                  {applyMutation.isPending ? "Submitting Application…" : "Submit Application"}
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
