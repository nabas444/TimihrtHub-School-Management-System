import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Building,
  MapPin,
  Calendar,
  DollarSign,
  Search,
  GraduationCap,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Clock,
  Coins,
  Shield,
  Phone,
  Mail,
  Globe,
} from "lucide-react";
import api from "../../lib/api";
import { PageLoader, EmptyState, Badge } from "../../components/ui/index";
import clsx from "clsx";

export default function JobBoardPage() {
  const { schoolSlug = "timhirthub-academy" } = useParams();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["public-jobs", schoolSlug],
    queryFn: () =>
      api.get(`/recruiting/public/${schoolSlug}/jobs`).then((r) => r.data.data),
  });

  const school = data?.school || {
    name: "TimhirtHub International Academy",
    city: "Addis Ababa",
  };
  const postings = data?.postings || [];

  const departments = Array.from(
    new Set(postings.map((p) => p.department?.value).filter(Boolean)),
  );

  const filteredPostings = postings.filter((p) => {
    const matchesSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.companyTagline?.toLowerCase().includes(search.toLowerCase());
    const matchesDept =
      deptFilter === "ALL" || p.department?.value === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="min-h-screen bg-slate-50/60 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* School Careers Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-navy-900 via-primary-900 to-primary-800 rounded-3xl p-8 sm:p-12 text-white shadow-2xl text-center space-y-4">
          <div className="inline-flex p-3.5 bg-white/10 backdrop-blur-md rounded-2xl ring-1 ring-white/20 mb-1">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Careers at {school.name}
          </h1>
          <p className="text-primary-100/90 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Join our mission to empower the next generation. Explore faculty,
            administrative, leadership, and operational opportunities.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-primary-200">
            {school.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {school.city}
                {school.country ? `, ${school.country}` : ""}
              </span>
            )}
            {school.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {school.email}
              </span>
            )}
            {school.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {school.phone}
              </span>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search positions, keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              Department:
            </label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Postings List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Open Positions ({filteredPostings.length})
            </h2>
          </div>

          {isLoading ? (
            <PageLoader />
          ) : filteredPostings.length === 0 ? (
            <div className="card p-12 text-center">
              <EmptyState
                icon={Briefcase}
                title="No job openings available"
                description={
                  search || deptFilter !== "ALL"
                    ? "No job postings matched your search criteria. Try resetting filters."
                    : "There are currently no active job vacancies. Please check back soon!"
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPostings.map((job) => {
                return (
                  <div
                    key={job.id}
                    className="card overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col border border-gray-200/80 hover:border-primary-400/80 group"
                  >
                    {/* Optional Flyer Banner Image Thumbnail */}
                    {job.bannerImageUrl && (
                      <div className="h-32 w-full overflow-hidden bg-gray-100 relative">
                        <img
                          src={job.bannerImageUrl}
                          alt={job.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider bg-primary-50 px-2 py-0.5 rounded-md">
                            {job.department?.value || "General Faculty"}
                          </span>
                          <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-md">
                            {job.employmentType?.replace(/_/g, " ")}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-gray-900 group-hover:text-primary-600 transition">
                            {job.title}
                          </h3>
                          {job.companyTagline && (
                            <p className="text-xs text-gray-500 italic mt-0.5 line-clamp-1">
                              {job.companyTagline}
                            </p>
                          )}
                        </div>

                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                          {job.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 gap-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {job.location || "Main Campus"}
                          </span>
                          {job.salaryDisplay && (
                            <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              <Coins className="w-3.5 h-3.5" />
                              {job.salaryDisplay}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {job.closingDate
                              ? `Apply by ${new Date(job.closingDate).toLocaleDateString()}`
                              : "Open until filled"}
                          </span>

                          <Link
                            to={`/careers/${schoolSlug}/${job.slug}`}
                            className="btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1"
                          >
                            View &amp; Apply
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
