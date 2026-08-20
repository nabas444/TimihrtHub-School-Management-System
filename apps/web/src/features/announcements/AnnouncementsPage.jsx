import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pin,
  Trash2,
  Megaphone,
  AlertCircle,
  Clock,
  Calendar,
  Layers,
  Paperclip,
  Search,
  Filter,
  Check,
  X,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState, Pagination, Avatar } from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import { useAuthStore } from "../../store/authStore";
import { format } from "date-fns";
import toast from "react-hot-toast";
import clsx from "clsx";

const TARGET_BADGE = {
  ALL: "blue",
  STUDENTS: "green",
  TEACHERS: "purple",
  PARENTS: "amber",
  CLASS: "primary",
};

export default function AnnouncementsPage() {
  const { user, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const canPost = isAdmin() || isTeacher();

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [targetFilter, setTargetFilter] = useState("ALL");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    target: "ALL",
    priority: "NORMAL",
    gradeLevelId: "",
    classIds: [],
    isPinned: false,
    publishedAt: "",
    expiresAt: "",
    attachmentInput: "",
    attachments: [],
  });

  // ── 1. Fetch Classes & Grade Levels for Cascading Selector ────────────────
  const { data: gradeLevelsData } = useQuery({
    queryKey: ["grade-levels-list"],
    queryFn: () => api.get("/academics/grade-levels").then((r) => r.data.data),
    enabled: canPost,
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes-list"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
    enabled: canPost,
  });

  const gradeLevels = gradeLevelsData || [];
  const classes = classesData || [];

  // Filter classes by chosen grade level in modal
  const availableClasses = form.gradeLevelId
    ? classes.filter((c) => c.gradeLevelId === form.gradeLevelId)
    : classes;

  // ── 2. Fetch Announcements ───────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["announcements", page, priorityFilter, targetFilter, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (priorityFilter !== "ALL") params.append("priority", priorityFilter);
      if (targetFilter !== "ALL") params.append("target", targetFilter);
      if (searchQuery) params.append("search", searchQuery);
      return api.get(`/announcements?${params.toString()}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  // ── 3. Mutations ─────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d) => {
      const payload = {
        title: d.title,
        content: d.content,
        target: d.target,
        priority: d.priority,
        gradeLevelId: d.gradeLevelId || undefined,
        classIds: d.classIds.length > 0 ? d.classIds : undefined,
        classId: d.classIds.length > 0 ? d.classIds[0] : undefined,
        isPinned: d.isPinned,
        attachments: d.attachments,
        publishedAt: d.publishedAt ? new Date(d.publishedAt).toISOString() : undefined,
        expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : undefined,
      };
      return api.post("/announcements", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement posted successfully");
      setAddOpen(false);
      setForm({
        title: "",
        content: "",
        target: "ALL",
        priority: "NORMAL",
        gradeLevelId: "",
        classIds: [],
        isPinned: false,
        publishedAt: "",
        expiresAt: "",
        attachmentInput: "",
        attachments: [],
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to post announcement");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Announcement deleted");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete");
    },
  });

  const pinMutation = useMutation({
    mutationFn: (id) => api.patch(`/announcements/${id}/pin`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success(res.data?.data?.isPinned ? "Announcement pinned" : "Announcement unpinned");
    },
    onError: () => toast.error("Failed to update pin state"),
  });

  // ── Helper handlers ──
  const toggleClassSelect = (clsId) => {
    setForm((f) => {
      const exists = f.classIds.includes(clsId);
      return {
        ...f,
        classIds: exists
          ? f.classIds.filter((id) => id !== clsId)
          : [...f.classIds, clsId],
      };
    });
  };

  const handleAddAttachment = () => {
    if (!form.attachmentInput.trim()) return;
    setForm((f) => ({
      ...f,
      attachments: [...f.attachments, f.attachmentInput.trim()],
      attachmentInput: "",
    }));
  };

  const handleRemoveAttachment = (index) => {
    setForm((f) => ({
      ...f,
      attachments: f.attachments.filter((_, i) => i !== index),
    }));
  };

  const announcements = data?.data ?? [];
  const meta = data?.meta ?? {};

  const getPriorityBadge = (priority) => {
    if (priority === "URGENT") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 animate-pulse">
          <AlertCircle className="w-3 h-3" /> URGENT
        </span>
      );
    }
    if (priority === "IMPORTANT") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> IMPORTANT
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Header ── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary-600" />
            Announcements & Notices
          </h1>
          <p className="page-subtitle">
            School-wide updates, grade-level directives, and class-specific notices.
          </p>
        </div>

        {canPost && (
          <button
            className="btn-primary inline-flex items-center gap-2 shadow-sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-4 h-4" /> Post Announcement
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search announcements…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 w-full text-xs"
            />
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="input w-full text-xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="NORMAL">Normal</option>
              <option value="IMPORTANT">Important</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div>
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className="input w-full text-xs"
            >
              <option value="ALL">All Audiences</option>
              <option value="STUDENTS">Students</option>
              <option value="TEACHERS">Teachers</option>
              <option value="PARENTS">Parents</option>
              <option value="CLASS">Class Specific</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Announcements Feed ── */}
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          {announcements.length === 0 && (
            <EmptyState
              icon={Megaphone}
              title="No announcements found"
              description="No notices match your current filters."
              action={
                canPost && (
                  <button
                    className="btn-primary mt-4 inline-flex items-center gap-2"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus className="w-4 h-4" /> Post Announcement
                  </button>
                )
              }
            />
          )}

          {announcements.map((a) => {
            const authorName = [
              a.author?.firstName,
              a.author?.middleName,
              a.author?.lastName,
            ]
              .filter(Boolean)
              .join(" ");

            const isUrgent = a.priority === "URGENT";
            const isImportant = a.priority === "IMPORTANT";

            return (
              <div
                key={a.id}
                className={clsx(
                  "card p-5 transition-shadow hover:shadow-md relative overflow-hidden",
                  a.isPinned && "border-l-4 border-l-amber-500",
                  isUrgent && "border-l-4 border-l-red-500 bg-red-50/20 dark:bg-red-950/10",
                  isImportant && !a.isPinned && "border-l-4 border-l-amber-400",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Badges Bar */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.isPinned && (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          <Pin className="w-3 h-3 text-amber-600" /> Pinned
                        </span>
                      )}

                      {getPriorityBadge(a.priority)}

                      <Badge variant={TARGET_BADGE[a.target] ?? "gray"}>
                        {a.target === "CLASS"
                          ? `Class: ${a.class?.name || (Array.isArray(a.classIds) && a.classIds.length > 0 ? `${a.classIds.length} Classes` : "Specific")}`
                          : a.target}
                      </Badge>

                      {a.gradeLevel && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {a.gradeLevel.name}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-base leading-snug">
                      {a.title}
                    </h3>

                    {/* Content */}
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {a.content}
                    </p>

                    {/* Attachments Chips */}
                    {Array.isArray(a.attachments) && a.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {a.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 transition-colors"
                          >
                            <Paperclip className="w-3 h-3" />
                            Attachment {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Metadata line */}
                    <div className="flex items-center gap-2 pt-2 text-xs text-gray-400 flex-wrap">
                      <span>Posted by <strong>{authorName || "Faculty"}</strong></span>
                      <span>·</span>
                      <span>{a.publishedAt ? format(new Date(a.publishedAt), "dd MMM yyyy, HH:mm") : "Just now"}</span>
                      {a.expiresAt && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 dark:text-amber-400">
                            Expires {format(new Date(a.expiresAt), "dd MMM yyyy")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions (Pin toggle, Delete) */}
                  {canPost && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => pinMutation.mutate(a.id)}
                        className={clsx(
                          "p-1.5 rounded-lg transition-colors",
                          a.isPinned
                            ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                            : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700",
                        )}
                        title={a.isPinned ? "Unpin Announcement" : "Pin Announcement"}
                      >
                        <Pin className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm("Delete this announcement?")) {
                            deleteMutation.mutate(a.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <Pagination page={page} totalPages={meta.totalPages ?? 1} onChange={setPage} />
        </div>
      )}

      {/* ── CREATE ANNOUNCEMENT MODAL ── */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Post New Announcement"
        size="lg"
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              className="input w-full font-medium"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. End of Term Examination Schedule & Class Guidelines"
              required
            />
          </div>

          {/* Message Content */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Message Content *
            </label>
            <textarea
              className="input min-h-28 resize-none w-full text-xs"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Write the full announcement text here…"
              required
            />
          </div>

          {/* Priority & Audience Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Priority Level
              </label>
              <select
                className="input w-full"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">Important (Amber Highlight)</option>
                <option value="URGENT">Urgent (Red Alert Badge)</option>
              </select>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Target Audience
              </label>
              <select
                className="input w-full"
                value={form.target}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    target: e.target.value,
                    classIds: e.target.value === "CLASS" ? f.classIds : [],
                  }))
                }
              >
                <option value="ALL">Entire School (All Roles)</option>
                <option value="STUDENTS">All Students</option>
                <option value="TEACHERS">All Teachers & Faculty</option>
                <option value="PARENTS">All Parents / Guardians</option>
                <option value="CLASS">Specific Class(es) / Grade</option>
              </select>
            </div>
          </div>

          {/* Cascading Grade Level & Multi-Class Picker */}
          {form.target === "CLASS" && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Filter by Grade Level:
                </label>
                <select
                  value={form.gradeLevelId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      gradeLevelId: e.target.value,
                    }))
                  }
                  className="input w-full text-xs"
                >
                  <option value="">-- All Grade Levels --</option>
                  {gradeLevels.map((gl) => (
                    <option key={gl.id} value={gl.id}>
                      {gl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Select Target Class(es) ({form.classIds.length} selected):
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  {availableClasses.length === 0 ? (
                    <p className="text-xs text-gray-400">No classes found.</p>
                  ) : (
                    availableClasses.map((cls) => {
                      const isSelected = form.classIds.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => toggleClassSelect(cls.id)}
                          className={clsx(
                            "px-3 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5",
                            isSelected
                              ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 hover:border-primary-400",
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {cls.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scheduling & Expiration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Schedule Publish Time (Optional)
              </label>
              <input
                type="datetime-local"
                className="input w-full text-xs"
                value={form.publishedAt}
                onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Auto-Expire Date (Optional)
              </label>
              <input
                type="date"
                className="input w-full text-xs"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Attachments (Document URL or Link)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/handout.pdf"
                className="input flex-1 text-xs"
                value={form.attachmentInput}
                onChange={(e) => setForm((f) => ({ ...f, attachmentInput: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAttachment();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddAttachment}
                disabled={!form.attachmentInput.trim()}
                className="btn-secondary text-xs"
              >
                Add
              </button>
            </div>

            {form.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.attachments.map((att, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    <Paperclip className="w-3 h-3 text-gray-400" />
                    <span className="max-w-[200px] truncate">{att}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pin Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
              className="rounded"
            />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Pin this announcement to the top of the feed
            </span>
          </label>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.title.trim() || !form.content.trim()}
            >
              {createMutation.isPending ? "Posting…" : "Post Announcement"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
