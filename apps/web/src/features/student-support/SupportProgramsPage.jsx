import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  HeartHandshake,
  Plus,
  Search,
  Users,
  Utensils,
  DollarSign,
  Award,
  HelpCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Percent,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState, PageLoader } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import clsx from "clsx";
import toast from "react-hot-toast";

const PROGRAM_TYPES = [
  { value: "ALL", label: "All Programs", icon: HeartHandshake },
  { value: "FINANCIAL_AID", label: "Financial Aid", icon: DollarSign },
  { value: "MEAL_SUPPORT", label: "Meal Support", icon: Utensils },
  { value: "SCHOLARSHIP", label: "Scholarships", icon: Award },
  { value: "OTHER", label: "Other Support", icon: HelpCircle },
];

const initialFormState = {
  name: "",
  type: "SCHOLARSHIP",
  description: "",
  waiverPercent: "",
  academicYear: "2026",
  isActive: true,
};

export default function SupportProgramsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [form, setForm] = useState(initialFormState);

  // Fetch support programs
  const { data, isLoading } = useQuery({
    queryKey: ["support-programs", activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== "ALL") params.append("type", activeTab);
      const res = await api.get(`/student-support/programs?${params.toString()}`);
      return res.data?.data?.programs || [];
    },
  });

  // Create program mutation
  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/student-support/programs", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-programs"] });
      toast.success("Support program created successfully");
      setIsModalOpen(false);
      setForm(initialFormState);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create program");
    },
  });

  // Update program mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      api.patch(`/student-support/programs/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-programs"] });
      toast.success("Support program updated successfully");
      setIsModalOpen(false);
      setEditingProgram(null);
      setForm(initialFormState);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update program");
    },
  });

  // Delete program mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/student-support/programs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-programs"] });
      toast.success("Support program deleted");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete program");
    },
  });

  const programs = data || [];

  const filteredPrograms = programs.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const handleOpenCreate = () => {
    setEditingProgram(null);
    setForm(initialFormState);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (program) => {
    setEditingProgram(program);
    setForm({
      name: program.name,
      type: program.type,
      description: program.description || "",
      waiverPercent:
        program.waiverPercent !== null && program.waiverPercent !== undefined
          ? String(program.waiverPercent)
          : "",
      academicYear: program.academicYear || "2026",
      isActive: program.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Program name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim() || null,
      waiverPercent: form.waiverPercent ? parseFloat(form.waiverPercent) : null,
      academicYear: form.academicYear.trim() || null,
      isActive: form.isActive,
    };

    if (editingProgram) {
      updateMutation.mutate({ id: editingProgram.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "FINANCIAL_AID":
        return <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case "MEAL_SUPPORT":
        return <Utensils className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case "SCHOLARSHIP":
        return <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <HeartHandshake className="w-5 h-5 text-primary-600 dark:text-primary-400" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case "FINANCIAL_AID":
        return <Badge variant="success">Financial Aid</Badge>;
      case "MEAL_SUPPORT":
        return <Badge variant="warning">Meal Support</Badge>;
      case "SCHOLARSHIP":
        return <Badge variant="indigo">Scholarship</Badge>;
      default:
        return <Badge variant="default">Other</Badge>;
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-100 dark:bg-primary-950/60 rounded-xl text-primary-600 dark:text-primary-400">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Student Support Programs
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage scholarships, financial aid waivers, meal assistance, and recognition
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/student-support/enrollments")}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            <span>Manage Enrollments</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Program</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Type Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {PROGRAM_TYPES.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={clsx(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                  isSelected
                    ? "bg-primary-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Program Cards Grid */}
      {filteredPrograms.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No support programs found"
          description="Create scholarships, financial aid, or meal programs to support students."
          action={{
            label: "Create First Program",
            onClick: handleOpenCreate,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPrograms.map((program) => {
            return (
              <div
                key={program.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top line: Icon, Type Badge & Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                        {getTypeIcon(program.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {getTypeBadge(program.type)}
                          {program.academicYear && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {program.academicYear}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(program)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit Program"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete "${program.name}"?`
                            )
                          ) {
                            deleteMutation.mutate(program.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        title="Delete Program"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug mb-1">
                    {program.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                    {program.description || "No description provided."}
                  </p>

                  {/* Program Properties / Badges */}
                  <div className="grid grid-cols-2 gap-2.5 py-3 border-y border-slate-100 dark:border-slate-800/80 mb-4">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-emerald-500" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Fee Waiver</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {program.waiverPercent !== null && program.waiverPercent !== undefined
                            ? `${program.waiverPercent}% Waived`
                            : "None (0%)"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary-500" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Enrolled</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {program.activeEnrollments || 0} Active
                          <span className="text-[10px] font-normal text-slate-400 ml-1">
                            ({program.totalEnrollments || 0} total)
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span
                      className={clsx(
                        "w-2 h-2 rounded-full",
                        program.isActive ? "bg-emerald-500" : "bg-slate-400"
                      )}
                    />
                    <span className="text-slate-600 dark:text-slate-400">
                      {program.isActive ? "Active Program" : "Inactive"}
                    </span>
                  </span>

                  <button
                    onClick={() =>
                      navigate(
                        `/student-support/enrollments?programId=${program.id}`
                      )
                    }
                    className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 group"
                  >
                    <span>View Roster</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Program Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProgram ? "Edit Support Program" : "Create Support Program"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Program Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Full Tuition Academic Scholarship 2026"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Support Category *
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              >
                <option value="SCHOLARSHIP">Scholarship</option>
                <option value="FINANCIAL_AID">Financial Aid</option>
                <option value="MEAL_SUPPORT">Meal Support</option>
                <option value="OTHER">Other Support</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Academic Year
              </label>
              <input
                type="text"
                placeholder="e.g. 2026"
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Fee Waiver Percentage (0 - 100%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="e.g. 100 for Full Scholarship, 50 for Half"
                value={form.waiverPercent}
                onChange={(e) =>
                  setForm({ ...form, waiverPercent: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100 pr-10"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                %
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              When applied to an enrolled student, automatically discounts tuition invoice balances by this percentage.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Description & Eligibility Criteria
            </label>
            <textarea
              rows={3}
              placeholder="Criteria, benefactor details, or notes about this program..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-700"
            />
            <label
              htmlFor="isActiveCheck"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Program is currently active and open for enrollments
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {editingProgram ? "Save Changes" : "Create Program"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
