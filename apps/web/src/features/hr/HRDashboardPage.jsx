import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Building,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Briefcase,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Calendar,
} from "lucide-react";
import api from "../../lib/api";
import { PageLoader, Badge } from "../../components/ui/index";
import clsx from "clsx";

export default function HRDashboardPage() {
  const navigate = useNavigate();

  const { data: hrData, isLoading } = useQuery({
    queryKey: ["hr-dashboard"],
    queryFn: () => api.get("/employees/dashboard").then((r) => r.data.data),
  });

  const { data: recruitingData } = useQuery({
    queryKey: ["recruiting-dashboard"],
    queryFn: () => api.get("/recruiting/dashboard").then((r) => r.data.data),
  });

  if (isLoading) return <PageLoader />;

  const headcount = hrData?.headcount || { total: 0, active: 0, onLeave: 0, probation: 0 };
  const deptBreakdown = hrData?.departmentBreakdown || [];
  const typeBreakdown = hrData?.employmentTypeBreakdown || [];
  const expiringDocs = hrData?.upcomingExpiringDocs || [];
  const recentDisciplinary = hrData?.recentDisciplinary || [];

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-primary-600" />
            Human Resources & Workforce Overview
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time analytics across school staff headcount, department allocation, compliance licenses, and onboarding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/recruiting")}
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <Briefcase className="w-3.5 h-3.5" />
            Recruiting Pipeline
          </button>
          <button
            onClick={() => navigate("/employees")}
            className="btn-primary text-xs inline-flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            View Staff Directory
          </button>
        </div>
      </div>

      {/* ── TOP KPI METRIC CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Headcount */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">Total Headcount</p>
            <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{headcount.total}</p>
          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-emerald-600">{headcount.active} Active</span> •{" "}
            <span className="font-semibold text-blue-600">{headcount.probation} Probation</span> •{" "}
            <span className="font-semibold text-amber-600">{headcount.onLeave} On Leave</span>
          </p>
        </div>

        {/* Onboarding in Progress */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">Active Onboarding</p>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {hrData?.pendingOnboardingCount || 0}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Checklists in progress</p>
        </div>

        {/* Expiring Compliance Documents */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">Expiring Licenses / Docs</p>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{expiringDocs.length}</p>
          <p className="text-[11px] text-amber-600 font-semibold mt-1">
            Within next 60 days
          </p>
        </div>

        {/* Open Job Requisitions / Postings */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">Active Job Postings</p>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {recruitingData?.metrics?.activePostingsCount || 0}
          </p>
          <p className="text-[11px] text-purple-700 font-semibold mt-1">
            {recruitingData?.metrics?.totalApplications || 0} applications received
          </p>
        </div>
      </div>

      {/* ── DEPARTMENT & EMPLOYMENT TYPE BREAKDOWN ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Distribution */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-primary-600" />
              Staff Headcount by Department
            </h3>
            <span className="text-xs text-gray-400 font-medium">
              {deptBreakdown.length} Departments
            </span>
          </div>

          {deptBreakdown.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-6 text-center">
              No department allocations configured yet.
            </p>
          ) : (
            <div className="space-y-3">
              {deptBreakdown.map((d) => {
                const percentage =
                  headcount.total > 0 ? Math.round((d.count / headcount.total) * 100) : 0;
                return (
                  <div key={d.departmentId || "unassigned"} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-gray-800">{d.departmentName}</span>
                      <span className="text-gray-500 font-mono">
                        {d.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: d.colorHex || "#4f46e5",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Employment Type Distribution */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary-600" />
            Employment Type
          </h3>

          <div className="space-y-2.5">
            {typeBreakdown.map((t) => (
              <div
                key={t.employmentType}
                className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-semibold"
              >
                <span className="text-gray-700">{t.employmentType.replace("_", " ")}</span>
                <span className="bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-900 font-bold">
                  {t.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── EXPIRING DOCUMENTS & COMPLIANCE VAULT ────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Upcoming Expiring Credentials & Teaching Licenses
            </h3>
            <p className="text-xs text-gray-500">
              Proactive alerts for work permits, medical licenses, and Ministry of Education teaching certificates requiring renewal.
            </p>
          </div>
        </div>

        {expiringDocs.length === 0 ? (
          <div className="p-8 text-center bg-emerald-50/50 rounded-xl border border-dashed border-emerald-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-emerald-900">All Document Credentials Up to Date</p>
            <p className="text-[11px] text-emerald-600">
              No staff licenses or contracts expiring in the next 60 days.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 text-[10px] uppercase font-bold border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Document Title</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {expiringDocs.map((doc) => {
                  const daysLeft = Math.ceil(
                    (new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/70">
                      <td className="py-3 px-3">
                        <p className="font-bold text-gray-900">
                          {doc.employee?.firstName} {doc.employee?.lastName}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {doc.employee?.employeeNumber}
                        </p>
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-800">{doc.title}</td>
                      <td className="py-3 px-3">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-mono">
                          {doc.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-800">
                        {new Date(doc.expiryDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded text-[10px] font-bold inline-block",
                            daysLeft < 30
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
