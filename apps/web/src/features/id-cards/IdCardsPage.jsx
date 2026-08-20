import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  Download,
  RotateCw,
  Sparkles,
  Users,
  GraduationCap,
  Briefcase,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Filter,
  Eye,
  Check,
} from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import { Avatar, Badge, EmptyState } from "../../components/ui/index";
import PageLoader from "../../components/ui/PageLoader";
import clsx from "clsx";
import toast from "react-hot-toast";

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_SESSION = `${CURRENT_YEAR} - ${CURRENT_YEAR + 1}`;

export default function IdCardsPage() {
  const [scope, setScope] = useState("CLASS"); // "STUDENT" | "CLASS" | "SECTION" | "STAFF" | "ALL"
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedStaffRole, setSelectedStaffRole] = useState("");
  const [layout, setLayout] = useState("HORIZONTAL"); // "HORIZONTAL" | "VERTICAL"
  const [colorMode, setColorMode] = useState("STRIP"); // "STRIP" | "BACKGROUND" | "NONE"
  const [validUpto, setValidUpto] = useState(DEFAULT_SESSION);
  const [printBack, setPrintBack] = useState(true);

  // Live visual preview card side
  const [previewSide, setPreviewSide] = useState("front"); // "front" | "back"
  const [generating, setGenerating] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────
  const { data: schoolInfo } = useQuery({
    queryKey: ["school-settings"],
    queryFn: () => api.get("/schools/settings").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data ?? []),
  });

  const { data: gradeLevelsData } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data ?? []),
  });

  const { data: studentsData } = useQuery({
    queryKey: ["students-id-card-select"],
    queryFn: () =>
      api.get("/users?role=STUDENT&page=1&limit=300").then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  // Query matching records for preview
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: [
      "id-cards-preview",
      scope,
      selectedStudentId,
      selectedClassId,
      selectedGradeId,
      selectedStaffRole,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("scope", scope);
      if (scope === "STUDENT" && selectedStudentId) params.append("studentId", selectedStudentId);
      if (scope === "CLASS" && selectedClassId) params.append("classId", selectedClassId);
      if (scope === "SECTION" && selectedGradeId) params.append("gradeLevelId", selectedGradeId);
      if (scope === "STAFF" && selectedStaffRole) params.append("role", selectedStaffRole);

      return api.get(`/id-cards/preview-list?${params.toString()}`).then((r) => r.data.data);
    },
    enabled:
      scope === "ALL" ||
      (scope === "STUDENT" && !!selectedStudentId) ||
      (scope === "CLASS" && !!selectedClassId) ||
      (scope === "SECTION" && !!selectedGradeId) ||
      scope === "STAFF",
  });

  const previewUsers = previewData?.users ?? [];
  const previewCount = previewData?.total ?? 0;

  // Selected or demo preview person
  const demoPerson = useMemo(() => {
    if (previewUsers.length > 0) {
      const u = previewUsers[0];
      const sp = u.studentProfile || {};
      const tp = u.teacherProfile || {};
      const ap = u.adminProfile || {};
      return {
        name: [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" "),
        role: u.role === "STUDENT" ? "Student" : u.role === "TEACHER" ? "Teacher" : "Staff",
        idNumber: sp.admissionNumber || tp.employeeId || ap.employeeId || "ADM-2026-001",
        className: sp.class?.name || "Grade 10-A",
        rollNumber: sp.rollNumber || "12",
        bloodGroup: sp.bloodGroup || "O+",
        houseName: sp.house?.value || tp.house?.value || "Lion House",
        houseColor: sp.house?.colorHex || tp.house?.colorHex || "#4F46E5",
        avatar: u.avatar || null,
        phone: u.phone || "+251 91 123 4567",
      };
    }
    return {
      name: "Abel Kebede Tadesse",
      role: "Student",
      idNumber: "ADM-2026-084",
      className: "Grade 10-A",
      rollNumber: "14",
      bloodGroup: "O+",
      houseName: "Eagle House",
      houseColor: "#3B82F6",
      avatar: null,
      phone: "+251 91 123 4567",
    };
  }, [previewUsers]);

  // Handle PDF Generation & Download
  const handleGeneratePdf = async () => {
    try {
      setGenerating(true);
      const payload = {
        scope,
        studentId: scope === "STUDENT" ? selectedStudentId : undefined,
        classId: scope === "CLASS" ? selectedClassId : undefined,
        gradeLevelId: scope === "SECTION" ? selectedGradeId : undefined,
        role: scope === "STAFF" && selectedStaffRole ? selectedStaffRole : undefined,
        layout,
        colorMode,
        validUpto,
        printBack,
      };

      const res = await api.post("/id-cards/generate", payload, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `id-cards-${scope.toLowerCase()}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("ID cards PDF downloaded successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate ID cards PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-primary-600" /> ID Card Generator & Printing
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Generate and batch-print official CR80 student and staff identity cards with house themes, photos, barcodes, and terms.
          </p>
        </div>

        <button
          className="btn-primary text-xs inline-flex items-center gap-2 shadow-sm py-2 px-4"
          onClick={handleGeneratePdf}
          disabled={generating || previewCount === 0}
        >
          <Download className="w-4 h-4" />
          {generating ? "Rendering PDF…" : `Print / Download (${previewCount} Cards)`}
        </button>
      </div>

      {/* ── Main Two-Column Layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ══ LEFT COLUMN: Configuration Controls (7 cols) ══ */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card 1: Target Scope Selection */}
          <div className="card p-5 bg-white border border-gray-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2.5">
              <Users className="w-4 h-4 text-primary-600" /> 1. Select Target Scope
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { id: "CLASS", label: "Class", icon: Users },
                { id: "SECTION", label: "Grade", icon: GraduationCap },
                { id: "STUDENT", label: "Individual", icon: GraduationCap },
                { id: "STAFF", label: "Staff", icon: Briefcase },
                { id: "ALL", label: "All Students", icon: Layers },
              ].map((item) => {
                const Icon = item.icon;
                const active = scope === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setScope(item.id)}
                    className={clsx(
                      "p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all text-center",
                      active
                        ? "bg-primary-50 border-primary-500 text-primary-700 shadow-2xs"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <Icon className={clsx("w-4 h-4", active ? "text-primary-600" : "text-gray-400")} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Contextual Selector based on Scope */}
            <div className="pt-2">
              {scope === "STUDENT" && (
                <div>
                  <label className="label font-bold text-xs">Choose Student</label>
                  <select
                    className="input text-xs"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                  >
                    <option value="">— Select Student —</option>
                    {(studentsData ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.studentProfile?.admissionNumber || s.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === "CLASS" && (
                <div>
                  <label className="label font-bold text-xs">Choose Class</label>
                  <select
                    className="input text-xs"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    <option value="">— Select Class —</option>
                    {(classesData ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.gradeLevel ? `(${c.gradeLevel.name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === "SECTION" && (
                <div>
                  <label className="label font-bold text-xs">Choose Grade Level</label>
                  <select
                    className="input text-xs"
                    value={selectedGradeId}
                    onChange={(e) => setSelectedGradeId(e.target.value)}
                  >
                    <option value="">— Select Grade Level —</option>
                    {(gradeLevelsData ?? []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (Level {g.level})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === "STAFF" && (
                <div>
                  <label className="label font-bold text-xs">Staff Role Filter</label>
                  <select
                    className="input text-xs"
                    value={selectedStaffRole}
                    onChange={(e) => setSelectedStaffRole(e.target.value)}
                  >
                    <option value="">All Staff (Teachers + Admins)</option>
                    <option value="TEACHER">Teachers Only</option>
                    <option value="ADMIN">Admins Only</option>
                    <option value="FINANCE">Finance Officers Only</option>
                  </select>
                </div>
              )}

              {scope === "ALL" && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-800 text-xs">
                  All active enrolled students across all grade levels will be included in the batch PDF.
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Layout, Color & Printing Options */}
          <div className="card p-5 bg-white border border-gray-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2.5">
              <Sparkles className="w-4 h-4 text-purple-600" /> 2. Layout & Card Design
            </h3>

            {/* Layout Style */}
            <div>
              <label className="label font-bold text-xs mb-1.5">Card Orientation (CR80 Standard)</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLayout("HORIZONTAL")}
                  className={clsx(
                    "p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all",
                    layout === "HORIZONTAL"
                      ? "bg-purple-50 border-purple-500 text-purple-800 shadow-2xs"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="text-left">
                    <p className="font-extrabold">Horizontal (Landscape)</p>
                    <p className="text-[10px] text-gray-400 font-mono">3.375" × 2.125"</p>
                  </div>
                  {layout === "HORIZONTAL" && <Check className="w-4 h-4 text-purple-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setLayout("VERTICAL")}
                  className={clsx(
                    "p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all",
                    layout === "VERTICAL"
                      ? "bg-purple-50 border-purple-500 text-purple-800 shadow-2xs"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="text-left">
                    <p className="font-extrabold">Vertical (Portrait)</p>
                    <p className="text-[10px] text-gray-400 font-mono">2.125" × 3.375"</p>
                  </div>
                  {layout === "VERTICAL" && <Check className="w-4 h-4 text-purple-600" />}
                </button>
              </div>
            </div>

            {/* Color Accent Mode */}
            <div>
              <label className="label font-bold text-xs mb-1.5">House Color Accent Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "STRIP", label: "Top Color Strip", desc: "House Color Bar" },
                  { id: "BACKGROUND", label: "Tinted Card", desc: "House Color Shade" },
                  { id: "NONE", label: "Classic Slate", desc: "Monochrome Dark" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setColorMode(m.id)}
                    className={clsx(
                      "p-2.5 rounded-xl border text-xs font-bold text-center transition-all",
                      colorMode === m.id
                        ? "bg-primary-50 border-primary-500 text-primary-700 shadow-2xs"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <p className="text-xs">{m.label}</p>
                    <p className="text-[10px] text-gray-400">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Validity & Backside */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="label font-bold text-xs">Valid Session / Period</label>
                <input
                  className="input text-xs"
                  value={validUpto}
                  onChange={(e) => setValidUpto(e.target.value)}
                  placeholder="e.g. 2024 - 2025"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printBack}
                    onChange={(e) => setPrintBack(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-xs text-gray-800 block">Print Card Back</span>
                    <span className="text-[10px] text-gray-400">Includes rules, barcode & signature</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ══ RIGHT COLUMN: Live Interactive Preview & Matching Records (5 cols) ══ */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Preview Card Box */}
          <div className="card p-5 bg-white border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-primary-600" /> Live Interactive Preview
              </h3>
              <button
                type="button"
                className="btn-ghost text-xs text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 py-0.5 px-2"
                onClick={() => setPreviewSide((s) => (s === "front" ? "back" : "front"))}
              >
                <RotateCw className="w-3 h-3" /> Flip ({previewSide === "front" ? "Back" : "Front"})
              </button>
            </div>

            {/* Visual Card Simulation */}
            <div className="flex justify-center p-2">
              <div
                className={clsx(
                  "relative rounded-2xl shadow-xl border border-gray-300 overflow-hidden text-gray-900 transition-all duration-300",
                  layout === "HORIZONTAL" ? "w-full max-w-[340px] aspect-[1.586]" : "w-[220px] aspect-[0.63]"
                )}
              >
                {previewSide === "front" ? (
                  /* ── FRONT SIDE ── */
                  <div
                    className={clsx(
                      "w-full h-full flex flex-col justify-between p-3.5 relative text-white",
                      colorMode === "BACKGROUND"
                        ? "bg-slate-900"
                        : "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950"
                    )}
                  >
                    {/* Top Color Accent Strip */}
                    {colorMode === "STRIP" && (
                      <div
                        className="absolute top-0 left-0 right-0 h-2"
                        style={{ backgroundColor: demoPerson.houseColor }}
                      />
                    )}

                    {/* School Header */}
                    <div className="flex items-center gap-2 border-b border-slate-700/60 pb-1.5">
                      <GraduationCap className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-black text-[11px] tracking-tight text-white truncate">
                          {schoolInfo?.name || "TIMHIRTHUB ACADEMY"}
                        </h4>
                        <p className="text-[8px] uppercase tracking-widest text-primary-300 font-bold">
                          {demoPerson.role} Identity Card
                        </p>
                      </div>
                    </div>

                    {/* Body Info */}
                    <div
                      className={clsx(
                        "gap-2.5 items-center my-auto",
                        layout === "HORIZONTAL" ? "flex" : "flex flex-col text-center"
                      )}
                    >
                      <div className="w-14 h-16 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center p-0.5 relative overflow-hidden shadow-inner flex-shrink-0">
                        {demoPerson.avatar ? (
                          <img src={demoPerson.avatar} alt="Avatar" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary-600/30 text-primary-200 font-black text-sm rounded-lg">
                            {demoPerson.name[0]}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <h2 className="font-black text-xs text-white leading-tight truncate">
                          {demoPerson.name}
                        </h2>
                        <p className="font-mono text-[9px] text-amber-400 font-bold tracking-wide">
                          ID: {demoPerson.idNumber}
                        </p>
                        <div className="grid grid-cols-2 gap-x-1 text-[9px] text-slate-300 pt-0.5">
                          <div>
                            <span className="text-slate-400">Class:</span>{" "}
                            <strong className="text-white">{demoPerson.className}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400">Roll:</span>{" "}
                            <strong className="text-white">{demoPerson.rollNumber}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400">House:</span>{" "}
                            <strong style={{ color: demoPerson.houseColor }}>{demoPerson.houseName}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400">Blood:</span>{" "}
                            <strong className="text-red-400">{demoPerson.bloodGroup}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[8px] text-slate-400">
                      <span className="font-mono text-[7px] tracking-wider text-slate-400">|||||||||||||||||</span>
                      <span className="font-bold text-slate-300">VALID: {validUpto}</span>
                    </div>
                  </div>
                ) : (
                  /* ── BACK SIDE ── */
                  <div className="w-full h-full flex flex-col justify-between p-3.5 bg-slate-50 text-gray-800 text-[9px]">
                    <div className="border-b border-gray-200 pb-1 flex items-center justify-between">
                      <span className="font-black text-[10px] text-primary-900 uppercase tracking-wider">
                        Instructions & Rules
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
                    </div>

                    <div className="space-y-1 text-gray-600 text-[8px] my-auto">
                      <p>1. This card is valid only for session {validUpto}.</p>
                      <p>2. Must be presented upon request by school staff.</p>
                      <p>3. If found, please return to school administration.</p>
                      <p className="font-bold text-gray-800">Emergency Tel: {demoPerson.phone}</p>
                    </div>

                    <div className="pt-1.5 border-t border-gray-200 flex items-center justify-between text-[8px] text-gray-500">
                      <span>Authorized Signature</span>
                      <div className="w-16 border-b border-gray-400 mb-0.5" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Matched Records Summary Card */}
          <div className="card p-4 bg-white border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-xs text-gray-900">
                Matched Persons to Print ({previewCount})
              </h4>
              {previewLoading && <span className="text-[10px] text-gray-400">Loading…</span>}
            </div>

            {previewUsers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                No matching persons for selected criteria.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 text-xs">
                {previewUsers.map((u) => {
                  const sp = u.studentProfile || {};
                  const fullName = [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ");
                  const idNum = sp.admissionNumber || u.teacherProfile?.employeeId || u.id.slice(0, 8);

                  return (
                    <div key={u.id} className="py-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={fullName} src={u.avatar} className="w-6 h-6 text-[10px]" />
                        <span className="font-bold text-gray-800 truncate">{fullName}</span>
                      </div>
                      <span className="font-mono text-[10px] text-gray-500 font-bold flex-shrink-0">
                        {idNum}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
