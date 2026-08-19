import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Users,
  Pencil,
  Trash2,
  X,
  Search,
  Layers,
  Sparkles,
  Check,
  Building2,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";

const STANDARD_SECTIONS = [
  "Section A",
  "Section B",
  "Section C",
  "Section D",
  "Section E",
  "Section F",
  "Section G",
  "Section H",
];

const ALPHABET_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

// Helper to extract or display section
function extractSectionName(className) {
  if (!className) return null;
  const match = className.match(/section\s*([a-z0-9]+)/i);
  if (match) return `Section ${match[1].toUpperCase()}`;
  const endLetter = className.match(/([0-9]+)\s*([a-z])$/i);
  if (endLetter) return `Section ${endLetter[2].toUpperCase()}`;
  return null;
}

export default function ClassesPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGradeLevel, setFilterGradeLevel] = useState("");
  const [filterSection, setFilterSection] = useState("");

  // Form State
  const [form, setForm] = useState({
    name: "",
    gradeLevelId: "",
    section: "Section A",
    customSection: "",
    isCustomSection: false,
    academicYear:
      new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
    capacity: 40,
    room: "",
    autoGenerateName: true,
  });

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
  });

  const { data: gradeLevels } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data),
  });

  const sortedGradeLevels = useMemo(() => {
    return (gradeLevels ?? [])
      .slice()
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [gradeLevels]);

  // Handle auto-generation of class name when grade or section changes
  const updateClassName = (gradeId, sectionValue, isCustom, customVal, autoGen) => {
    if (!autoGen) return;
    const grade = sortedGradeLevels.find((g) => g.id === gradeId);
    const gradeName = grade ? grade.name : "";
    const activeSec = isCustom ? (customVal || "").trim() : sectionValue;

    if (gradeName && activeSec) {
      const secFormatted = activeSec.toLowerCase().startsWith("section")
        ? activeSec
        : `Section ${activeSec}`;
      setForm((f) => ({
        ...f,
        name: `${gradeName} - ${secFormatted}`,
      }));
    } else if (gradeName) {
      setForm((f) => ({
        ...f,
        name: gradeName,
      }));
    }
  };

  const handleGradeChange = (e) => {
    const gradeId = e.target.value;
    setForm((f) => ({ ...f, gradeLevelId: gradeId }));
    updateClassName(
      gradeId,
      form.section,
      form.isCustomSection,
      form.customSection,
      form.autoGenerateName
    );
  };

  const handleLetterClick = (letter) => {
    const sectionName = `Section ${letter}`;
    setForm((f) => ({
      ...f,
      section: sectionName,
      isCustomSection: false,
      customSection: "",
    }));
    updateClassName(
      form.gradeLevelId,
      sectionName,
      false,
      "",
      form.autoGenerateName
    );
  };

  const handleCustomSectionToggle = (isCustom) => {
    setForm((f) => ({
      ...f,
      isCustomSection: isCustom,
      ...(isCustom ? {} : { section: "Section A" }),
    }));
    updateClassName(
      form.gradeLevelId,
      isCustom ? form.customSection : "Section A",
      isCustom,
      form.customSection,
      form.autoGenerateName
    );
  };

  const handleCustomSectionInput = (e) => {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      customSection: val,
    }));
    updateClassName(form.gradeLevelId, form.section, true, val, form.autoGenerateName);
  };

  const createMutation = useMutation({
    mutationFn: (d) =>
      api.post("/academics/classes", {
        name: d.name,
        gradeLevelId: d.gradeLevelId,
        academicYear: d.academicYear,
        room: d.room || undefined,
        capacity: parseInt(d.capacity),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class created successfully!");
      setAddOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create class");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d) =>
      api.patch(`/academics/classes/${selectedClass.id}`, {
        name: d.name,
        gradeLevelId: d.gradeLevelId,
        academicYear: d.academicYear,
        room: d.room || undefined,
        capacity: parseInt(d.capacity),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class updated successfully!");
      setEditOpen(false);
      setSelectedClass(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update class");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/academics/classes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class deleted");
      setSelectedClass(null);
      setDetailOpen(false);
    },
  });

  const resetForm = () => {
    setForm({
      name: "",
      gradeLevelId: sortedGradeLevels[0]?.id || "",
      section: "Section A",
      customSection: "",
      isCustomSection: false,
      academicYear:
        new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
      capacity: 40,
      room: "",
      autoGenerateName: true,
    });
  };

  const openAdd = () => {
    const defaultGrade = sortedGradeLevels[0]?.id || "";
    const defaultGradeName = sortedGradeLevels[0]?.name || "";
    setForm({
      name: defaultGradeName ? `${defaultGradeName} - Section A` : "",
      gradeLevelId: defaultGrade,
      section: "Section A",
      customSection: "",
      isCustomSection: false,
      academicYear:
        new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
      capacity: 40,
      room: "",
      autoGenerateName: true,
    });
    setAddOpen(true);
  };

  const openEdit = (klass) => {
    setSelectedClass(klass);
    const sec = extractSectionName(klass.name);
    const isCustom = !STANDARD_SECTIONS.includes(sec);

    setForm({
      name: klass.name,
      gradeLevelId: klass.gradeLevelId || klass.gradeLevel?.id || "",
      section: STANDARD_SECTIONS.includes(sec) ? sec : "Section A",
      customSection: isCustom && sec ? sec : "",
      isCustomSection: isCustom && !!sec,
      academicYear: klass.academicYear,
      capacity: klass.capacity,
      room: klass.room || "",
      autoGenerateName: false,
    });
    setEditOpen(true);
  };

  const openDetail = async (klass) => {
    const res = await api.get(`/academics/classes/${klass.id}`);
    setSelectedClass(res.data.data);
    setDetailOpen(true);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return (classes ?? []).filter((c) => {
      if (filterGradeLevel && c.gradeLevelId !== filterGradeLevel) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = c.name?.toLowerCase().includes(query);
        const matchRoom = c.room?.toLowerCase().includes(query);
        const matchGrade = c.gradeLevel?.name?.toLowerCase().includes(query);
        if (!matchName && !matchRoom && !matchGrade) return false;
      }
      if (filterSection) {
        const sec = extractSectionName(c.name);
        if (sec !== filterSection && !c.name.toLowerCase().includes(filterSection.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [classes, filterGradeLevel, filterSection, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary-600" />
            Classes & Sections
          </h1>
          <p className="page-subtitle">
            Configure school grades, sub-sections (Section A, B, C…), student capacities, and rooms.
          </p>
        </div>
        <button className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto" onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add Class / Section
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 text-xs"
            placeholder="Search class, section, room…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {/* Grade Filter */}
          <select
            className="input text-xs py-1.5 w-auto"
            value={filterGradeLevel}
            onChange={(e) => setFilterGradeLevel(e.target.value)}
          >
            <option value="">All Grade Levels</option>
            {sortedGradeLevels.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Section Filter */}
          <select
            className="input text-xs py-1.5 w-auto"
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
          >
            <option value="">All Sections</option>
            {STANDARD_SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {(filterGradeLevel || filterSection || searchQuery) && (
            <button
              onClick={() => {
                setFilterGradeLevel("");
                setFilterSection("");
                setSearchQuery("");
              }}
              className="btn-secondary text-xs py-1.5 px-2.5 text-gray-500 whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Classes Grid */}
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={Users}
                title="No classes found"
                description={
                  classes?.length === 0
                    ? "Create your first grade & sub-section to get started."
                    : "No classes match your current search or filter criteria."
                }
              />
            </div>
          )}

          {filteredClasses.map((c) => {
            const sectionBadge = extractSectionName(c.name);
            const studentCount = c._count?.students ?? 0;
            const occupancyPct = c.capacity ? Math.min(100, Math.round((studentCount / c.capacity) * 100)) : 0;

            return (
              <div
                key={c.id}
                className="card p-5 hover:border-primary-300 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.gradeLevel && (
                        <Badge variant="blue">{c.gradeLevel.name}</Badge>
                      )}
                      {sectionBadge && (
                        <Badge variant="purple">{sectionBadge}</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="btn-ghost p-1.5 text-gray-500 hover:text-primary-600 rounded-md"
                        onClick={() => openEdit(c)}
                        title="Edit Class & Section"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        className="btn-ghost p-1.5 text-gray-400 hover:text-red-600 rounded-md"
                        onClick={() => {
                          if (confirm(`Delete class ${c.name}?`))
                            deleteMutation.mutate(c.id);
                        }}
                        title="Delete Class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <button onClick={() => openDetail(c)} className="text-left w-full block">
                    <h3 className="font-bold text-gray-900 text-lg leading-snug group-hover:text-primary-600 transition-colors">
                      {c.name}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                      Academic Year: {c.academicYear}
                    </p>
                  </button>

                  {/* Student Capacity Meter */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {studentCount} / {c.capacity} Enrolled
                      </span>
                      <span className="font-mono text-gray-400">{occupancyPct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          occupancyPct >= 90
                            ? "bg-red-500"
                            : occupancyPct >= 70
                            ? "bg-amber-500"
                            : "bg-primary-600"
                        }`}
                        style={{ width: `${occupancyPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  {c.room ? (
                    <span className="font-medium text-gray-700">📍 {c.room}</span>
                  ) : (
                    <span className="text-gray-400 italic">No room assigned</span>
                  )}

                  {c.classTeacher?.length > 0 ? (
                    <span className="text-primary-700 font-semibold truncate max-w-[140px]" title={`${c.classTeacher[0]?.user?.firstName} ${c.classTeacher[0]?.user?.lastName}`}>
                      👩‍🏫 {c.classTeacher[0]?.user?.firstName} {c.classTeacher[0]?.user?.lastName}
                    </span>
                  ) : (
                    <span className="text-gray-400">No Class Teacher</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Class & Section Modal ── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Grade & Sub-Section"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name || !form.gradeLevelId}
            >
              {createMutation.isPending ? "Creating…" : "Create Class & Section"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Grade Level Selection */}
          <div>
            <label className="label">1. Select Grade Level *</label>
            <select
              className="input"
              value={form.gradeLevelId}
              onChange={handleGradeChange}
              required
            >
              <option value="">— Select Grade Level —</option>
              {sortedGradeLevels.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} (Level {g.level})
                </option>
              ))}
            </select>
          </div>

          {/* Section / Sub-Section Selection */}
          <div className="space-y-2 p-3 bg-gray-50/80 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <label className="label mb-0 flex items-center gap-1.5 text-gray-900 font-semibold">
                <Layers className="w-4 h-4 text-primary-600" />
                2. Sub-Section / Stream
              </label>
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleCustomSectionToggle(false)}
                  className={`px-2 py-0.5 rounded font-medium ${
                    !form.isCustomSection
                      ? "bg-primary-600 text-white"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomSectionToggle(true)}
                  className={`px-2 py-0.5 rounded font-medium ${
                    form.isCustomSection
                      ? "bg-primary-600 text-white"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {!form.isCustomSection ? (
              <>
                {/* Quick Alphabet Letter Pills */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-gray-500 block">Quick Letter Select:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ALPHABET_LETTERS.map((letter) => {
                      const secName = `Section ${letter}`;
                      const isSelected = form.section === secName;
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => handleLetterClick(letter)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                            isSelected
                              ? "bg-primary-600 text-white shadow-xs scale-105"
                              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dropdown for Standard Sections */}
                <div className="pt-1">
                  <select
                    className="input text-xs"
                    value={form.section}
                    onChange={(e) => {
                      const sec = e.target.value;
                      setForm((f) => ({ ...f, section: sec }));
                      updateClassName(
                        form.gradeLevelId,
                        sec,
                        false,
                        "",
                        form.autoGenerateName
                      );
                    }}
                  >
                    {STANDARD_SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              /* Custom Section Input */
              <div className="pt-1">
                <input
                  className="input text-xs"
                  placeholder="e.g. Section Alpha, Science Stream, 10-Blue…"
                  value={form.customSection}
                  onChange={handleCustomSectionInput}
                  autoFocus
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Enter any custom section identifier, stream, or room name.
                </span>
              </div>
            )}
          </div>

          {/* Class Display Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Class Display Name *</label>
              <label className="flex items-center gap-1.5 text-xs text-primary-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoGenerateName}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((f) => ({ ...f, autoGenerateName: checked }));
                    if (checked) {
                      updateClassName(
                        form.gradeLevelId,
                        form.section,
                        form.isCustomSection,
                        form.customSection,
                        true
                      );
                    }
                  }}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <Sparkles className="w-3.5 h-3.5" /> Auto-generate
              </label>
            </div>
            <input
              className="input font-semibold text-gray-900"
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Grade 10 - Section A"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Academic Year</label>
              <input
                className="input text-xs"
                value={form.academicYear}
                onChange={set("academicYear")}
              />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input
                className="input text-xs"
                type="number"
                value={form.capacity}
                onChange={set("capacity")}
              />
            </div>
            <div>
              <label className="label">Room / Hall</label>
              <input
                className="input text-xs"
                value={form.room}
                onChange={set("room")}
                placeholder="Room 101"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Edit Class Modal ── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Class & Section"
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => updateMutation.mutate(form)}
              disabled={updateMutation.isPending || !form.name || !form.gradeLevelId}
            >
              {updateMutation.isPending ? "Updating…" : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Grade Level *</label>
            <select
              className="input"
              value={form.gradeLevelId}
              onChange={handleGradeChange}
              required
            >
              <option value="">— Select Grade Level —</option>
              {sortedGradeLevels.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} (Level {g.level})
                </option>
              ))}
            </select>
          </div>

          {/* Section Selector in Edit */}
          <div className="space-y-2 p-3 bg-gray-50/80 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <label className="label mb-0 flex items-center gap-1.5 text-gray-900 font-semibold">
                <Layers className="w-4 h-4 text-primary-600" />
                Sub-Section
              </label>
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleCustomSectionToggle(false)}
                  className={`px-2 py-0.5 rounded font-medium ${
                    !form.isCustomSection
                      ? "bg-primary-600 text-white"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomSectionToggle(true)}
                  className={`px-2 py-0.5 rounded font-medium ${
                    form.isCustomSection
                      ? "bg-primary-600 text-white"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {!form.isCustomSection ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ALPHABET_LETTERS.map((letter) => {
                  const secName = `Section ${letter}`;
                  const isSelected = form.section === secName;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => handleLetterClick(letter)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-primary-600 text-white shadow-xs"
                          : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="pt-1">
                <input
                  className="input text-xs"
                  placeholder="e.g. Section Alpha, Science Stream…"
                  value={form.customSection}
                  onChange={handleCustomSectionInput}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Class Name *</label>
              <button
                type="button"
                className="text-xs text-primary-600 font-medium inline-flex items-center gap-1 hover:underline"
                onClick={() =>
                  updateClassName(
                    form.gradeLevelId,
                    form.section,
                    form.isCustomSection,
                    form.customSection,
                    true
                  )
                }
              >
                <Sparkles className="w-3 h-3" /> Regenerate from Section
              </button>
            </div>
            <input
              className="input font-semibold"
              value={form.name}
              onChange={set("name")}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Academic Year</label>
              <input
                className="input text-xs"
                value={form.academicYear}
                onChange={set("academicYear")}
              />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input
                className="input text-xs"
                type="number"
                value={form.capacity}
                onChange={set("capacity")}
              />
            </div>
            <div>
              <label className="label">Room</label>
              <input
                className="input text-xs"
                value={form.room}
                onChange={set("room")}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selectedClass?.name ?? "Class Details"}
        size="lg"
      >
        {selectedClass && (
          <div className="space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900">{selectedClass.name}</h3>
                  {extractSectionName(selectedClass.name) && (
                    <Badge variant="purple">{extractSectionName(selectedClass.name)}</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Academic Year: {selectedClass.academicYear}
                </p>
              </div>
              <button
                className="btn-secondary p-2"
                onClick={() => setDetailOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <span className="font-semibold text-gray-400 uppercase text-[10px] block">
                  Grade Level
                </span>
                <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                  {selectedClass.gradeLevel?.name || "—"}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <span className="font-semibold text-gray-400 uppercase text-[10px] block">
                  Room
                </span>
                <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                  {selectedClass.room || "—"}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <span className="font-semibold text-gray-400 uppercase text-[10px] block">
                  Capacity
                </span>
                <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                  {selectedClass.capacity} students
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <span className="font-semibold text-gray-400 uppercase text-[10px] block">
                  Enrolled Students
                </span>
                <span className="font-bold text-primary-600 text-sm mt-0.5 block">
                  {selectedClass.students?.length ?? 0}
                </span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 text-sm mb-2.5 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary-600" />
                Enrolled Students ({selectedClass.students?.length ?? 0})
              </h4>
              {selectedClass.students?.length ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {selectedClass.students.map((student) => (
                    <div
                      key={student.user.id}
                      className="flex items-center justify-between border border-gray-200 rounded-xl p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                          {student.user.firstName?.[0]}{student.user.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-gray-900">
                            {student.user.firstName} {student.user.lastName}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {student.user.email} · Roll #{student.rollNumber || "—"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="blue">
                        Adm: {student.admissionNumber || student.id.slice(0, 8)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No students assigned"
                  description="This class doesn’t have any student records yet."
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

