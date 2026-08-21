import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Send,
  User,
  Users,
  Home,
  Clock,
  ArrowRight,
} from "lucide-react";
import api from "../../lib/api";
import toast from "react-hot-toast";

export default function PublicApplicationPage() {
  const { schoolSlug } = useParams();

  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    gradeLevelAppliedFor: "",
    previousSchool: "",
    fatherFirstName: "",
    fatherLastName: "",
    fatherMobile: "",
    motherFirstName: "",
    motherLastName: "",
    motherMobile: "",
    guardianEmail: "",
    guardianPhone: "",
    address: "",
    city: "",
    nationality: "",
  });

  const [submittedApplicant, setSubmittedApplicant] = useState(null);

  // Fetch school info
  const {
    data: schoolData,
    isLoading: isLoadingSchool,
    isError: isSchoolError,
  } = useQuery({
    queryKey: ["publicSchoolInfo", schoolSlug],
    queryFn: async () => {
      const res = await api.get(`/admissions/public/${schoolSlug}/info`);
      return res.data?.data;
    },
    enabled: !!schoolSlug,
    retry: 1,
  });

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/admissions/public/${schoolSlug}/apply`, payload);
      return res.data?.data;
    },
    onSuccess: (data) => {
      setSubmittedApplicant(data);
      toast.success("Application submitted successfully!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to submit application");
    },
  });

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Please enter the student's first and last name");
      return;
    }
    if (!form.guardianEmail.trim()) {
      toast.error("Please provide a valid guardian email address");
      return;
    }
    if (!form.gradeLevelAppliedFor.trim()) {
      toast.error("Please specify the grade level applying for");
      return;
    }

    applyMutation.mutate(form);
  };

  if (isLoadingSchool) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading admission portal...</p>
        </div>
      </div>
    );
  }

  if (isSchoolError || !schoolData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">School Portal Not Found</h2>
          <p className="text-sm text-slate-500 mb-6">
            We could not find an active admission portal for <strong>"{schoolSlug}"</strong>. Please check the URL link or contact the school administration.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (!schoolData.admissionsOpen) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Admissions Currently Closed</h2>
          <p className="text-sm text-slate-500 mb-6">
            Admissions for <strong>{schoolData.name}</strong> are currently closed for the upcoming term.
          </p>
          {schoolData.email && (
            <p className="text-xs text-slate-400">
              For inquiries, contact: <a href={`mailto:${schoolData.email}`} className="text-indigo-600 font-medium">{schoolData.email}</a>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Success Confirmation Screen
  if (submittedApplicant) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-white text-center relative">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-black">Application Received!</h1>
            <p className="text-emerald-100 text-sm mt-1">
              Thank you for applying to {schoolData.name}
            </p>
          </div>

          <div className="p-8 space-y-6">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center text-sm pb-3 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Application Reference ID</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  {submittedApplicant.id}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Student Name</span>
                <span className="font-semibold text-slate-900">
                  {submittedApplicant.firstName} {submittedApplicant.lastName}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Grade Applied For</span>
                <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {submittedApplicant.gradeLevelAppliedFor || "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Guardian Email</span>
                <span className="font-semibold text-slate-900">{submittedApplicant.guardianEmail}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">What Happens Next?</h3>
              <ul className="text-sm text-slate-600 space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>A confirmation email has been dispatched to <strong>{submittedApplicant.guardianEmail}</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span>The admissions committee will review academic background and scheduled interviews if required.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <span>Upon approval, your official acceptance letter and student portal credentials will be sent to your email.</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubmittedApplicant(null);
                  setForm({
                    firstName: "",
                    middleName: "",
                    lastName: "",
                    dateOfBirth: "",
                    gender: "",
                    gradeLevelAppliedFor: "",
                    previousSchool: "",
                    fatherFirstName: "",
                    fatherLastName: "",
                    fatherMobile: "",
                    motherFirstName: "",
                    motherLastName: "",
                    motherMobile: "",
                    guardianEmail: "",
                    guardianPhone: "",
                    address: "",
                    city: "",
                    nationality: "",
                  });
                }}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition text-center"
              >
                Submit Another Application
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* School Header Banner */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          {schoolData.logo ? (
            <img
              src={schoolData.logo}
              alt={schoolData.name}
              className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Building2 className="w-10 h-10" />
            </div>
          )}

          <div className="text-center sm:text-left flex-1 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Admissions Open · {schoolData.academicYear || "2024/2025"}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{schoolData.name}</h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500">
              {schoolData.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {schoolData.city}, {schoolData.country}
                </span>
              )}
              {schoolData.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {schoolData.phone}
                </span>
              )}
              {schoolData.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {schoolData.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
          <div className="border-b border-slate-100 p-6 sm:p-8 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-indigo-600" />
              Prospective Student Admission Form
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Please complete all required fields accurately. Official communications will be delivered to the guardian email.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Section 1: Student Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
                <User className="w-4 h-4" /> 1. Student Personal Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={handleChange("firstName")}
                    placeholder="e.g. Dawit"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Middle / Grandfather Name
                  </label>
                  <input
                    type="text"
                    value={form.middleName}
                    onChange={handleChange("middleName")}
                    placeholder="e.g. Haile"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Last / Family Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={handleChange("lastName")}
                    placeholder="e.g. Tadesse"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={handleChange("dateOfBirth")}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={handleChange("gender")}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white"
                  >
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Grade Applying For <span className="text-red-500">*</span>
                  </label>
                  {schoolData.gradeLevels && schoolData.gradeLevels.length > 0 ? (
                    <select
                      required
                      value={form.gradeLevelAppliedFor}
                      onChange={handleChange("gradeLevelAppliedFor")}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white"
                    >
                      <option value="">Select Grade Level</option>
                      {schoolData.gradeLevels.map((gl) => (
                        <option key={gl.id} value={gl.name}>
                          {gl.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={form.gradeLevelAppliedFor}
                      onChange={handleChange("gradeLevelAppliedFor")}
                      placeholder="e.g. Grade 10"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Previous School Attended
                </label>
                <input
                  type="text"
                  value={form.previousSchool}
                  onChange={handleChange("previousSchool")}
                  placeholder="e.g. St. Joseph Academy"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Section 2: Parents & Guardian Contacts */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
                <Users className="w-4 h-4" /> 2. Parent & Guardian Contact Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Guardian Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.guardianEmail}
                    onChange={handleChange("guardianEmail")}
                    placeholder="parent.guardian@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Official acceptance & portal credentials will be delivered here.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Guardian Primary Phone
                  </label>
                  <input
                    type="tel"
                    value={form.guardianPhone}
                    onChange={handleChange("guardianPhone")}
                    placeholder="+251 91 234 5678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Father's Info */}
              <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700">Father's Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <input
                      type="text"
                      value={form.fatherFirstName}
                      onChange={handleChange("fatherFirstName")}
                      placeholder="Father First Name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={form.fatherLastName}
                      onChange={handleChange("fatherLastName")}
                      placeholder="Father Last Name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      value={form.fatherMobile}
                      onChange={handleChange("fatherMobile")}
                      placeholder="Father Mobile Phone"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Mother's Info */}
              <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700">Mother's Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <input
                      type="text"
                      value={form.motherFirstName}
                      onChange={handleChange("motherFirstName")}
                      placeholder="Mother First Name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={form.motherLastName}
                      onChange={handleChange("motherLastName")}
                      placeholder="Mother Last Name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      value={form.motherMobile}
                      onChange={handleChange("motherMobile")}
                      placeholder="Mother Mobile Phone"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Address & Residence */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
                <Home className="w-4 h-4" /> 3. Address & Residence
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Street Address / Woreda
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={handleChange("address")}
                    placeholder="e.g. Bole Subcity, Kebele 03, House 450"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={handleChange("city")}
                    placeholder="e.g. Addis Ababa"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nationality
                </label>
                <input
                  type="text"
                  value={form.nationality}
                  onChange={handleChange("nationality")}
                  placeholder="e.g. Ethiopian"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              By submitting, you verify that all supplied details are accurate.
            </p>
            <button
              type="submit"
              disabled={applyMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-indigo-500/20 disabled:opacity-50 transition"
            >
              {applyMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting Application...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Application
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
