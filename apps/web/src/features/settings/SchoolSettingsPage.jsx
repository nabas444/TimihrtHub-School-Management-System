import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import { Save, Settings, Clock, CheckCircle, HelpCircle } from "lucide-react";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";

export default function SchoolSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({});
  const [settings, setSettings] = useState({});

  const { data: school, isLoading } = useQuery({
    queryKey: ["school-profile"],
    queryFn: () => api.get("/schools/profile").then((r) => r.data.data),
    onSuccess: (d) => {
      setForm({
        name: d.name,
        email: d.email ?? "",
        phone: d.phone ?? "",
        address: d.address ?? "",
        city: d.city ?? "",
        website: d.website ?? "",
        academicYear: d.academicYear,
        termSystem: d.termSystem,
        gradingSystem: d.gradingSystem,
      });
      setSettings(d.settings ?? {});
    },
  });

  const profileMutation = useMutation({
    mutationFn: (d) => api.patch("/schools/profile", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-profile"] });
      toast.success("School profile updated");
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (d) => api.patch("/schools/settings", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-profile"] });
      toast.success("Settings saved");
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSetting = (k) => (e) =>
    setSettings((s) => ({
      ...s,
      [k]:
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.type === "number"
          ? parseInt(e.target.value, 10) || 0
          : e.target.value,
    }));

  if (isLoading) return <PageLoader />;

  const windowMins = settings.lateThresholdMinutes ?? 15;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">School Settings</h1>
        <p className="page-subtitle">Configure your school's profile and policies</p>
      </div>

      {/* School Profile */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">School Information</h3>
        <div className="space-y-4">
          <div>
            <label className="label">School Name</label>
            <input
              className="input"
              value={form.name ?? ""}
              onChange={set("name")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email ?? ""}
                onChange={set("email")}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form.phone ?? ""}
                onChange={set("phone")}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">City</label>
              <input
                className="input"
                value={form.city ?? ""}
                onChange={set("city")}
              />
            </div>
            <div>
              <label className="label">Website</label>
              <input
                className="input"
                value={form.website ?? ""}
                onChange={set("website")}
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Academic Year</label>
              <input
                className="input"
                value={form.academicYear ?? ""}
                onChange={set("academicYear")}
                placeholder="2024/2025"
              />
            </div>
            <div>
              <label className="label">Term System</label>
              <select
                className="input"
                value={form.termSystem ?? ""}
                onChange={set("termSystem")}
              >
                {["SEMESTER", "TRIMESTER", "QUARTER"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Grading</label>
              <select
                className="input"
                value={form.gradingSystem ?? ""}
                onChange={set("gradingSystem")}
              >
                {["PERCENTAGE", "GPA", "LETTER"].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => profileMutation.mutate(form)}
            disabled={profileMutation.isPending}
          >
            <Save className="w-4 h-4" />{" "}
            {profileMutation.isPending ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>

      {/* School Policies */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" /> School Policies
        </h3>
        <div className="space-y-5">
          {/* Dynamic Teaching Period Attendance Policy */}
          <div className="p-4 bg-primary-50/60 rounded-2xl border border-primary-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-primary-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary-600" />
                Attendance Policy: Per-Teaching-Period Window
              </label>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-primary-200 text-primary-800 rounded-md">
                Timetable Driven
              </span>
            </div>

            <p className="text-xs text-primary-800 leading-relaxed">
              Attendance start is dynamically triggered at the beginning of <strong>every teaching period</strong> on the school timetable. The assigned teacher must report attendance within the configured reporting window.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="label text-xs font-bold">
                  Period Reporting Window (Minutes) *
                </label>
                <div className="relative flex items-center">
                  <input
                    className="input text-xs font-mono pr-12"
                    type="number"
                    min="5"
                    max="60"
                    value={windowMins}
                    onChange={setSetting("lateThresholdMinutes")}
                  />
                  <span className="absolute right-3 text-xs text-gray-400 font-semibold pointer-events-none">
                    mins
                  </span>
                </div>
              </div>

              <div>
                <label className="label text-xs font-bold">Pass Mark (%)</label>
                <input
                  className="input text-xs"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.passMarkPercentage ?? 50}
                  onChange={setSetting("passMarkPercentage")}
                />
              </div>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-primary-100 text-[11px] text-gray-600 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Example:</strong> If a timetable period starts at <strong>08:00</strong>, the teacher must submit attendance between <strong>08:00 and {8}:{(windowMins < 10 ? '0' : '') + windowMins}</strong>. The same applies for 09:00, 10:00, and all subsequent periods.
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {[
              ["allowParentChat", "Allow parents to chat with teachers"],
              ["allowStudentChat", "Allow students to use chat"],
              ["enableAiFeatures", "Enable AI insights and chatbot"],
              ["enableLibrary", "Enable library management"],
              ["enableTransport", "Enable transport/bus routes"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-3 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={settings[key] ?? true}
                  onChange={setSetting(key)}
                  className="rounded w-4 h-4 accent-primary-600"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <button
            className="btn-primary"
            onClick={() => settingsMutation.mutate(settings)}
            disabled={settingsMutation.isPending}
          >
            <Save className="w-4 h-4" />{" "}
            {settingsMutation.isPending ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
