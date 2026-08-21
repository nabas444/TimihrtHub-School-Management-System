import { useState } from "react";
import { useParams } from "react-router-dom";
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
} from "lucide-react";
import api from "../../lib/api";
import { PageLoader, Modal } from "../../components/ui/index";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function PublicJobBoardPage() {
  const { schoolSlug = "timhirthub-academy" } = useParams();
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [isSuccessSubmitted, setIsSuccessSubmitted] = useState(false);

  const [form, setForm] = useState({
    candidateName: "",
    email: "",
    phone: "",
    experienceYears: 3,
    highestEducation: "B.Ed / Bachelor Degree",
    currentEmployer: "",
    resumeUrl: "",
    coverLetter: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["public-jobs", schoolSlug],
    queryFn: () =>
      api.get(`/recruiting/public/${schoolSlug}/jobs`).then((r) => r.data.data),
  });

  const school = data?.school || { name: "TimhirtHub International Academy", city: "Addis Ababa" };
  const postings = data?.postings || [];

  const applyMutation = useMutation({
    mutationFn: (payload) =>
      api.post(`/recruiting/public/${schoolSlug}/jobs/${selectedJob.id}/apply`, payload),
    onSuccess: () => {
      setIsSuccessSubmitted(true);
      toast.success("Application submitted successfully!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit application");
    },
  });

  const openApplyModal = (job) => {
    setSelectedJob(job);
    setIsSuccessSubmitted(false);
    setForm({
      candidateName: "",
      email: "",
      phone: "",
      experienceYears: 3,
      highestEducation: "Bachelor of Education",
      currentEmployer: "",
      resumeUrl: "",
      coverLetter: "",
    });
    setApplyModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* School Careers Banner */}
        <div className="bg-gradient-to-r from-primary-700 to-primary-900 rounded-3xl p-8 text-white shadow-xl text-center space-y-3">
          <div className="inline-flex p-3 bg-white/10 rounded-2xl mb-1">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{school.name} Careers</h1>
          <p className="text-primary-100 max-w-xl mx-auto text-sm">
            Join our mission to empower the next generation. Explore faculty, administrative, and operations career opportunities.
          </p>
        </div>

        {/* Postings List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Open Positions ({postings.length})
            </h2>
            <span className="text-xs text-gray-500 font-medium">Addis Ababa, Ethiopia</span>
          </div>

          {isLoading ? (
            <PageLoader />
          ) : postings.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-2">
              <Briefcase className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="font-bold text-gray-700 text-sm">No Active Openings Right Now</p>
              <p className="text-xs text-gray-400">
                Please check back soon or follow our school updates.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {postings.map((job) => (
                <div
                  key={job.id}
                  className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-primary-400 hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-base">{job.title}</h3>
                      <span className="bg-primary-50 text-primary-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {job.employmentType?.replace("_", " ")}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2">{job.description}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-medium pt-1">
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-gray-400" />
                        {job.department?.value || "Academic"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {job.location || "Main Campus"}
                      </span>
                      {job.salaryRange && (
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          {job.salaryRange}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => openApplyModal(job)}
                    className="btn-primary text-xs whitespace-nowrap self-stretch sm:self-auto shadow-sm"
                  >
                    Apply for Position
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── APPLY MODAL ─────────────────────────────────────────────────── */}
      <Modal
        open={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        title={selectedJob ? `Apply: ${selectedJob.title}` : "Job Application"}
        size="lg"
        footer={
          !isSuccessSubmitted && (
            <div className="flex justify-end gap-2 w-full">
              <button className="btn-secondary text-xs" onClick={() => setApplyModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary text-xs inline-flex items-center gap-1.5"
                onClick={() => applyMutation.mutate(form)}
                disabled={applyMutation.isPending || !form.candidateName || !form.email}
              >
                <Send className="w-3.5 h-3.5" />
                {applyMutation.isPending ? "Submitting Application…" : "Submit Application"}
              </button>
            </div>
          )
        }
      >
        {isSuccessSubmitted ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Application Received!</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Thank you for applying to {school.name}. Our recruitment team will review your application and contact you.
            </p>
            <button
              onClick={() => setApplyModalOpen(false)}
              className="btn-secondary text-xs mx-auto mt-2"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label font-bold">Full Name *</label>
                <input
                  className="input text-xs"
                  value={form.candidateName}
                  onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                  placeholder="e.g. Almaz Bekele"
                  required
                />
              </div>
              <div>
                <label className="label font-bold">Email Address *</label>
                <input
                  type="email"
                  className="input text-xs"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="almaz@example.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label font-bold">Phone Number</label>
                <input
                  className="input text-xs"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+251 9..."
                />
              </div>
              <div>
                <label className="label font-bold">Years of Experience</label>
                <input
                  type="number"
                  step="0.5"
                  className="input text-xs"
                  value={form.experienceYears}
                  onChange={(e) =>
                    setForm({ ...form, experienceYears: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="label font-bold">Highest Degree / Education</label>
                <input
                  className="input text-xs"
                  value={form.highestEducation}
                  onChange={(e) => setForm({ ...form, highestEducation: e.target.value })}
                  placeholder="e.g. Master of Education"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label font-bold">Current Employer / School</label>
                <input
                  className="input text-xs"
                  value={form.currentEmployer}
                  onChange={(e) => setForm({ ...form, currentEmployer: e.target.value })}
                />
              </div>
              <div>
                <label className="label font-bold">Resume / CV Link (Google Drive / PDF)</label>
                <input
                  className="input text-xs"
                  value={form.resumeUrl}
                  onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            </div>

            <div>
              <label className="label font-bold">Cover Letter / Note</label>
              <textarea
                rows={3}
                className="input text-xs"
                value={form.coverLetter}
                onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
                placeholder="Tell us why you are a great fit for this position..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
