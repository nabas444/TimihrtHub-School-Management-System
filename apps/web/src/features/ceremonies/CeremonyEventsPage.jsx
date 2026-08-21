import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Award,
  Users,
  Calendar,
  Building,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  ArrowLeft,
  ChevronRight,
  Shirt,
  FileText,
  UserPlus,
  Check,
  X,
  Clock,
  HelpCircle,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState, ConfirmDialog, Avatar } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import toast from "react-hot-toast";

const CEREMONY_TYPES = [
  { value: "GRADUATION", label: "Graduation Ceremony" },
  { value: "COMPLETION", label: "Completion Ceremony" },
  { value: "OTHER", label: "Other Celebration Event" },
];

export default function CeremonyEventsPage() {
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterType, setFilterType] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);

  // Form State for Event
  const [eventForm, setEventForm] = useState({
    title: "",
    type: "GRADUATION",
    gradeLevelId: "",
    academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    ceremonyDate: "",
    venue: "School Main Auditorium",
    attireNote: "Cap and gown, provided by school",
    program: "1. Processional & National Anthem\n2. Welcome Address by Principal\n3. Student Valedictorian Speech\n4. Conferral of Certificates\n5. Recessional & Commemorative Photos",
  });

  // Queries
  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ["ceremony-events", filterYear, filterGrade, filterType],
    queryFn: () =>
      api
        .get("/ceremonies/events", {
          params: {
            academicYear: filterYear || undefined,
            gradeLevelId: filterGrade || undefined,
            type: filterType || undefined,
          },
        })
        .then((r) => r.data.data),
  });

  const { data: gradeLevels } = useQuery({
    queryKey: ["grade-levels"],
    queryFn: () => api.get("/schools/grade-levels").then((r) => r.data.data),
  });

  const { data: selectedEvent } = useQuery({
    queryKey: ["ceremony-event", selectedEventId],
    queryFn: () =>
      api.get(`/ceremonies/events/${selectedEventId}`).then((r) => r.data.data),
    enabled: !!selectedEventId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => api.post("/ceremonies/events", data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ceremony-events"] });
      setCreateModalOpen(false);
      toast.success("Ceremony event created successfully");
      if (res.data?.data?.id) {
        setSelectedEventId(res.data.data.id);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create ceremony event");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/ceremonies/events/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ceremony-events"] });
      qc.invalidateQueries({ queryKey: ["ceremony-event", selectedEventId] });
      setEditModalOpen(false);
      toast.success("Ceremony event updated successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update event");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/ceremonies/events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ceremony-events"] });
      if (selectedEventId === eventToDelete?.id) {
        setSelectedEventId(null);
      }
      setDeleteConfirmOpen(false);
      setEventToDelete(null);
      toast.success("Ceremony event deleted successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete event");
    },
  });

  const sortedGradeLevels = useMemo(() => {
    return (gradeLevels ?? []).slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [gradeLevels]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((ev) => {
      if (
        searchQuery &&
        !ev.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !ev.venue?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [events, searchQuery]);

  const handleOpenCreate = () => {
    const ceremonyGrade = sortedGradeLevels.find((g) => g.milestoneType === "CEREMONY");
    setEventForm({
      title: ceremonyGrade
        ? `${ceremonyGrade.name} Graduation & Completion Ceremony`
        : "Kindergarten Cap & Gown Graduation",
      type: "GRADUATION",
      gradeLevelId: ceremonyGrade ? ceremonyGrade.id : "",
      academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
      ceremonyDate: "",
      venue: "School Main Auditorium",
      attireNote: "Cap and gown, provided by school",
      program: "1. Processional & National Anthem\n2. Welcome Address by Principal\n3. Student Speech\n4. Conferral of Certificates\n5. Recessional & Commemorative Photos",
    });
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (ev, e) => {
    if (e) e.stopPropagation();
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      type: ev.type || "GRADUATION",
      gradeLevelId: ev.gradeLevelId || "",
      academicYear: ev.academicYear,
      ceremonyDate: ev.ceremonyDate ? ev.ceremonyDate.split("T")[0] : "",
      venue: ev.venue || "",
      attireNote: ev.attireNote || "",
      program: ev.program || "",
    });
    setEditModalOpen(true);
  };

  const handleOpenDelete = (ev, e) => {
    if (e) e.stopPropagation();
    setEventToDelete(ev);
    setDeleteConfirmOpen(true);
  };

  if (loadingEvents && !events) return <PageLoader />;

  return (
    <div className="space-y-6">
      {selectedEventId && selectedEvent ? (
        <CeremonyDetailView
          event={selectedEvent}
          onBack={() => setSelectedEventId(null)}
          onEdit={() => handleOpenEdit(selectedEvent)}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="page-title flex items-center gap-2">
                <Sparkles className="w-7 h-7 text-primary-600" />
                Graduation & Completion Ceremonies
              </h1>
              <p className="page-subtitle">
                Plan graduation events, enroll candidates, issue graduation certificates in batch, and print ceremony programs.
              </p>
            </div>

            <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Ceremony
            </button>
          </div>

          {/* Filter Bar */}
          <div className="card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="input pl-9 text-sm"
                placeholder="Search ceremony title or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <select
                className="input text-sm w-full sm:w-auto"
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
              >
                <option value="">All Grade Levels</option>
                {sortedGradeLevels.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.milestoneType === "CEREMONY" ? "★" : ""}
                  </option>
                ))}
              </select>

              <select
                className="input text-sm w-full sm:w-auto"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All Types</option>
                {CEREMONY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <input
                className="input text-sm w-full sm:w-36 font-mono"
                placeholder="Year (2025/2026)"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              />

              {(searchQuery || filterGrade || filterType || filterYear) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterGrade("");
                    setFilterType("");
                    setFilterYear("");
                  }}
                  className="btn-secondary text-xs"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Ceremony Events Grid */}
          {filteredEvents.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No Ceremonies Found"
              description="Create a graduation or completion ceremony event to start enrolling participating candidates and issuing graduation certificates."
              action={
                <button onClick={handleOpenCreate} className="btn-primary btn-sm">
                  <Plus className="w-4 h-4 mr-1" /> Create Ceremony
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEvents.map((ev) => {
                const count = ev._count?.participants ?? 0;
                const isMilestone = ev.gradeLevel?.milestoneType === "CEREMONY";

                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className="card p-5 hover:shadow-md transition-all cursor-pointer border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="badge-primary font-mono text-xs">
                          {ev.academicYear}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isMilestone && (
                            <span className="badge-purple text-[10px] uppercase font-bold tracking-wider">
                              Ceremony Milestone
                            </span>
                          )}
                          <span className="badge-green text-xs font-semibold">
                            {ev.type}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-primary-600 transition-colors">
                          {ev.title}
                        </h3>
                        {ev.gradeLevel?.name && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Grade: {ev.gradeLevel.name}
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Calendar className="w-3.5 h-3.5 text-primary-500" />
                          <span>
                            {ev.ceremonyDate
                              ? new Date(ev.ceremonyDate).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Date to be announced"}
                          </span>
                        </div>
                        {ev.venue && (
                          <div className="flex items-center gap-1.5 text-gray-500 truncate">
                            <Building className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate">{ev.venue}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <Users className="w-4 h-4 text-primary-600" />
                        <span>{count} {count === 1 ? "Participant" : "Participants"}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleOpenEdit(ev, e)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700"
                          title="Edit Ceremony"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenDelete(ev, e)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600"
                          title="Delete Ceremony"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="p-1.5 text-primary-600 group-hover:translate-x-1 transition-transform">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Ceremony Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Ceremony Event"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              ...eventForm,
              gradeLevelId: eventForm.gradeLevelId || null,
              ceremonyDate: eventForm.ceremonyDate
                ? new Date(eventForm.ceremonyDate).toISOString()
                : null,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Ceremony Title *</label>
            <input
              className="input"
              placeholder="e.g. Kindergarten Graduation 2026"
              value={eventForm.title}
              onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ceremony Type</label>
              <select
                className="input"
                value={eventForm.type}
                onChange={(e) => setEventForm((f) => ({ ...f, type: e.target.value }))}
              >
                {CEREMONY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Academic Year *</label>
              <input
                className="input font-mono"
                value={eventForm.academicYear}
                onChange={(e) => setEventForm((f) => ({ ...f, academicYear: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Target Milestone Grade Level</label>
              <select
                className="input"
                value={eventForm.gradeLevelId}
                onChange={(e) => setEventForm((f) => ({ ...f, gradeLevelId: e.target.value }))}
              >
                <option value="">Whole School / None</option>
                {sortedGradeLevels.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.milestoneType === "CEREMONY" ? "(Milestone: Ceremony)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Ceremony Date</label>
              <input
                className="input text-xs"
                type="date"
                value={eventForm.ceremonyDate}
                onChange={(e) => setEventForm((f) => ({ ...f, ceremonyDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Venue / Location</label>
            <input
              className="input"
              placeholder="e.g. School Main Auditorium"
              value={eventForm.venue}
              onChange={(e) => setEventForm((f) => ({ ...f, venue: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Attire Note</label>
            <input
              className="input text-xs"
              placeholder="e.g. Cap and gown, provided by school"
              value={eventForm.attireNote}
              onChange={(e) => setEventForm((f) => ({ ...f, attireNote: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Order of Program / Agenda</label>
            <textarea
              className="input text-xs font-mono"
              rows={4}
              placeholder="Enter program items (1 per line)..."
              value={eventForm.program}
              onChange={(e) => setEventForm((f) => ({ ...f, program: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Ceremony Event"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Ceremony Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Ceremony Event"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate({
              id: editingEvent.id,
              data: {
                title: eventForm.title,
                type: eventForm.type,
                gradeLevelId: eventForm.gradeLevelId || null,
                academicYear: eventForm.academicYear,
                ceremonyDate: eventForm.ceremonyDate
                  ? new Date(eventForm.ceremonyDate).toISOString()
                  : null,
                venue: eventForm.venue,
                attireNote: eventForm.attireNote,
                program: eventForm.program,
              },
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Ceremony Title *</label>
            <input
              className="input"
              value={eventForm.title}
              onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ceremony Type</label>
              <select
                className="input"
                value={eventForm.type}
                onChange={(e) => setEventForm((f) => ({ ...f, type: e.target.value }))}
              >
                {CEREMONY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Academic Year *</label>
              <input
                className="input font-mono"
                value={eventForm.academicYear}
                onChange={(e) => setEventForm((f) => ({ ...f, academicYear: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Target Milestone Grade</label>
              <select
                className="input"
                value={eventForm.gradeLevelId}
                onChange={(e) => setEventForm((f) => ({ ...f, gradeLevelId: e.target.value }))}
              >
                <option value="">Whole School / None</option>
                {sortedGradeLevels.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Ceremony Date</label>
              <input
                className="input text-xs"
                type="date"
                value={eventForm.ceremonyDate}
                onChange={(e) => setEventForm((f) => ({ ...f, ceremonyDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Venue / Location</label>
            <input
              className="input"
              value={eventForm.venue}
              onChange={(e) => setEventForm((f) => ({ ...f, venue: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Attire Note</label>
            <input
              className="input text-xs"
              value={eventForm.attireNote}
              onChange={(e) => setEventForm((f) => ({ ...f, attireNote: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Order of Program / Agenda</label>
            <textarea
              className="input text-xs font-mono"
              rows={4}
              value={eventForm.program}
              onChange={(e) => setEventForm((f) => ({ ...f, program: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate(eventToDelete.id)}
        title="Delete Ceremony Event"
        message={`Are you sure you want to delete "${eventToDelete?.title}"? Participant enrollments for this ceremony will also be removed.`}
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL & PARTICIPANT MANAGEMENT VIEW FOR A CEREMONY EVENT
// ─────────────────────────────────────────────────────────────────────────────
function CeremonyDetailView({ event, onBack, onEdit }) {
  const qc = useQueryClient();

  // Participant table filters
  const [participantSearch, setParticipantSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [certFilter, setCertFilter] = useState("");

  // Modals
  const [enrollBulkOpen, setEnrollBulkOpen] = useState(false);
  const [issueSummaryOpen, setIssueSummaryOpen] = useState(false);
  const [issueSummaryData, setIssueSummaryData] = useState(null);
  const [printingPdf, setPrintingPdf] = useState(false);

  // Mutations
  const enrollBulkMutation = useMutation({
    mutationFn: (data) =>
      api.post(`/ceremonies/events/${event.id}/participants/bulk`, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ceremony-event", event.id] });
      qc.invalidateQueries({ queryKey: ["ceremony-events"] });
      setEnrollBulkOpen(false);
      toast.success(res.data?.message || "Participants enrolled successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to enroll participants");
    },
  });

  const toggleAttendanceMutation = useMutation({
    mutationFn: ({ participantId, attendanceConfirmed }) =>
      api.patch(`/ceremonies/ceremony-participants/${participantId}`, {
        attendanceConfirmed,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ceremony-event", event.id] });
      toast.success("Attendance status updated");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update attendance");
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId) =>
      api.delete(`/ceremonies/ceremony-participants/${participantId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ceremony-event", event.id] });
      qc.invalidateQueries({ queryKey: ["ceremony-events"] });
      toast.success("Participant removed from ceremony");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to remove participant");
    },
  });

  const issueCertificatesMutation = useMutation({
    mutationFn: () =>
      api.post(`/ceremonies/events/${event.id}/issue-certificates`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ceremony-event", event.id] });
      qc.invalidateQueries({ queryKey: ["certificates"] });
      setIssueSummaryData(res.data.data);
      setIssueSummaryOpen(true);
      toast.success(res.data.message || "Certificates processed");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to issue certificates");
    },
  });

  const handlePrintProgramPdf = async () => {
    try {
      setPrintingPdf(true);
      const res = await api.get(`/ceremonies/events/${event.id}/program-pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      toast.error("Failed to generate ceremony program PDF");
    } finally {
      setPrintingPdf(false);
    }
  };

  const participants = event.participants || [];

  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const student = p.studentProfile;
      const name = [student?.user?.firstName, student?.user?.middleName, student?.user?.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const adm = (student?.admissionNumber || "").toLowerCase();
      const cls = (student?.class?.name || "").toLowerCase();

      if (
        participantSearch &&
        !name.includes(participantSearch.toLowerCase()) &&
        !adm.includes(participantSearch.toLowerCase()) &&
        !cls.includes(participantSearch.toLowerCase())
      ) {
        return false;
      }

      if (attendanceFilter === "CONFIRMED" && !p.attendanceConfirmed) return false;
      if (attendanceFilter === "PENDING" && p.attendanceConfirmed) return false;

      if (certFilter === "ISSUED" && !p.certificateId) return false;
      if (certFilter === "UNISSUED" && p.certificateId) return false;

      return true;
    });
  }, [participants, participantSearch, attendanceFilter, certFilter]);

  const confirmedCount = participants.filter((p) => p.attendanceConfirmed).length;
  const certIssuedCount = participants.filter((p) => !!p.certificateId).length;

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="btn-secondary btn-sm flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Ceremonies
        </button>

        <button onClick={onEdit} className="btn-secondary btn-sm flex items-center gap-1 text-xs">
          <Pencil className="w-3.5 h-3.5" /> Edit Ceremony Details
        </button>
      </div>

      {/* Ceremony Header Card */}
      <div className="card p-6 bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs font-mono">
                {event.academicYear}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
                {event.type}
              </span>
              {event.gradeLevel?.milestoneType === "CEREMONY" && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-amber-950 uppercase tracking-wide">
                  Milestone
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black">{event.title}</h2>
            {event.gradeLevel?.name && (
              <p className="text-xs text-emerald-200 mt-1">
                Target Level: {event.gradeLevel.name}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEnrollBulkOpen(true)}
              className="px-4 py-2 bg-white text-emerald-900 font-bold rounded-xl text-xs hover:bg-emerald-50 transition shadow-xs flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4 text-emerald-700" />
              Add Eligible Participants
            </button>
            <button
              onClick={() => issueCertificatesMutation.mutate()}
              disabled={participants.length === 0 || issueCertificatesMutation.isPending}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition border border-white/20 shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Award className="w-4 h-4" />
              {issueCertificatesMutation.isPending ? "Issuing..." : "Issue Certificates for All"}
            </button>
            <button
              onClick={handlePrintProgramPdf}
              disabled={printingPdf}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition border border-white/20 shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {printingPdf ? "Generating..." : "Print Program (PDF)"}
            </button>
          </div>
        </div>

        {/* Info & Venue Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3">
            <span className="text-emerald-200 font-semibold block mb-0.5">Date & Time</span>
            <p className="font-bold">
              {event.ceremonyDate
                ? new Date(event.ceremonyDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Date to be announced"}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3">
            <span className="text-emerald-200 font-semibold block mb-0.5">Venue</span>
            <p className="font-bold truncate">{event.venue || "School Main Auditorium"}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3">
            <span className="text-emerald-200 font-semibold block mb-0.5">Attendance RSVP</span>
            <p className="font-bold">
              {confirmedCount} / {participants.length} Confirmed
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3">
            <span className="text-emerald-200 font-semibold block mb-0.5">Certificates Issued</span>
            <p className="font-bold text-amber-300">
              {certIssuedCount} / {participants.length} Issued
            </p>
          </div>
        </div>

        {event.attireNote && (
          <p className="text-xs text-emerald-200 italic flex items-center gap-1.5 pt-1">
            <Shirt className="w-3.5 h-3.5 text-emerald-300" />
            Attire: {event.attireNote}
          </p>
        )}
      </div>

      {/* Participant Roster Table */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9 text-xs"
              placeholder="Search participant name, admission #, class..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <select
              className="input text-xs"
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value)}
            >
              <option value="">All Attendance</option>
              <option value="CONFIRMED">Attendance Confirmed</option>
              <option value="PENDING">Pending RSVP</option>
            </select>

            <select
              className="input text-xs"
              value={certFilter}
              onChange={(e) => setCertFilter(e.target.value)}
            >
              <option value="">All Certificates</option>
              <option value="ISSUED">Certificate Issued</option>
              <option value="UNISSUED">Certificate Pending</option>
            </select>
          </div>
        </div>

        {filteredParticipants.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {participants.length === 0 ? (
              <div>
                <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-gray-600">No participants enrolled yet</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  Click "Add Eligible Participants" to enroll graduating students into this ceremony.
                </p>
              </div>
            ) : (
              <p>No participants match the active filters.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Candidate</th>
                  <th>Admission #</th>
                  <th>Class / Section</th>
                  <th>Attendance Confirmed</th>
                  <th>Graduation Certificate</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p, index) => {
                  const student = p.studentProfile;
                  const name = [student?.user?.firstName, student?.user?.middleName, student?.user?.lastName]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                      <td className="text-xs text-gray-400 font-mono">{index + 1}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={student?.user?.avatar}
                            name={name}
                            size="sm"
                          />
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-xs">
                              {name}
                            </p>
                            {student?.user?.gender && (
                              <p className="text-[10px] text-gray-400 capitalize">
                                {student.user.gender.toLowerCase()}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {student?.admissionNumber || "—"}
                      </td>
                      <td className="text-xs text-gray-600 dark:text-gray-300">
                        {student?.class?.name || "—"}
                      </td>
                      <td>
                        <button
                          onClick={() =>
                            toggleAttendanceMutation.mutate({
                              participantId: p.id,
                              attendanceConfirmed: !p.attendanceConfirmed,
                            })
                          }
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                            p.attendanceConfirmed
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 hover:bg-gray-200"
                          }`}
                        >
                          {p.attendanceConfirmed ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Confirmed
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" /> Pending RSVP
                            </>
                          )}
                        </button>
                      </td>
                      <td>
                        {p.certificateId ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" /> Issued
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not issued yet</span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => removeParticipantMutation.mutate(p.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                          title="Remove from Ceremony"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Participant Enrollment Modal */}
      <Modal
        open={enrollBulkOpen}
        onClose={() => setEnrollBulkOpen(false)}
        title="Add Eligible Ceremony Participants"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 text-xs text-emerald-900 dark:text-emerald-300">
            <p className="font-bold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Cohort Enrollment
            </p>
            <p>
              Enrolls all eligible graduating students belonging to{" "}
              <strong>{event.gradeLevel?.name || "the target milestone grade level"}</strong> into this ceremony.
            </p>
          </div>

          <p className="text-xs text-gray-500">
            Already enrolled participants will be kept without duplicate entries.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEnrollBulkOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={enrollBulkMutation.isPending}
              onClick={() => enrollBulkMutation.mutate({})}
            >
              {enrollBulkMutation.isPending ? "Enrolling..." : "Confirm & Enroll All Candidates"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Batch Certificate Issuance Summary Modal */}
      <Modal
        open={issueSummaryOpen}
        onClose={() => setIssueSummaryOpen(false)}
        title="Graduation Certificate Issuance Results"
        size="md"
      >
        {issueSummaryData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 rounded-xl">
                <p className="text-xs text-emerald-700 font-semibold uppercase">Certificates Issued</p>
                <p className="text-2xl font-black text-emerald-600">
                  {issueSummaryData.issuedCount}
                </p>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700 font-semibold uppercase">Blocked / Skipped</p>
                <p className="text-2xl font-black text-amber-600">
                  {issueSummaryData.skippedCount}
                </p>
              </div>
            </div>

            {issueSummaryData.skippedDetails && issueSummaryData.skippedDetails.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Blocked Candidate Reasons:
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 text-xs">
                  {issueSummaryData.skippedDetails.map((item, idx) => (
                    <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-800/60 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white">{item.name}: </span>
                        <span className="text-gray-600 dark:text-gray-300">{item.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIssueSummaryOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
