import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  BookOpen,
  Search,
  Tag,
  Download,
  ExternalLink,
  Layers,
  Edit,
  Trash2,
  Barcode,
  Sparkles,
  Filter,
  X,
  FileText,
  DollarSign,
  Bookmark,
} from "lucide-react";
import api from "../../lib/api";
import {
  Badge,
  EmptyState,
  SearchInput,
  Pagination,
} from "../../components/ui/index";
import Modal from "../../components/ui/Modal";
import PageLoader from "../../components/ui/PageLoader";
import { useAuthStore } from "../../store/authStore";
import toast from "react-hot-toast";
import clsx from "clsx";

const INITIAL_FORM = {
  title: "",
  author: "",
  isbn: "",
  edition: "",
  language: "English",
  description: "",
  category: "General",
  tags: [],
  publisher: "",
  year: new Date().getFullYear(),
  copies: 1,
  condition: "Good",
  acquisitionSource: "Purchase",
  price: "",
  digitalCopyUrl: "",
  barcodeNumber: "",
  coverUrl: "",
  location: "",
};

export default function LibraryPage() {
  const { isAdmin, isTeacher, isStudent } = useAuthStore();
  const qc = useQueryClient();
  const isStaff = isAdmin() || isTeacher();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedTag, setSelectedTag] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState("basic"); // 'basic' | 'classification' | 'inventory' | 'digital'
  const [tagInput, setTagInput] = useState("");

  const [issueOpen, setIssueOpen] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedBookToDelete, setSelectedBookToDelete] = useState(null);

  const [form, setForm] = useState(INITIAL_FORM);
  const [issueForm, setIssueForm] = useState({
    studentProfileId: "",
    dueDate: "",
  });

  // ── 1. Fetch Books ───────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["library", page, search, selectedCategory, selectedTag],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "16" });
      if (search) params.append("search", search);
      if (selectedCategory !== "ALL") params.append("category", selectedCategory);
      if (selectedTag) params.append("tag", selectedTag);

      return api.get(`/library?${params.toString()}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  // ── 2. Fetch My Borrowed Books (Student) ─────────────────────────────────
  const { data: myBooks } = useQuery({
    queryKey: ["my-books"],
    queryFn: () => api.get("/library/my").then((r) => r.data.data),
    enabled: isStudent(),
  });

  // ── 3. Fetch Students for Issue Dropdown ─────────────────────────────────
  const { data: students } = useQuery({
    queryKey: ["students-simple"],
    queryFn: () =>
      api.get("/users?role=STUDENT&limit=200").then((r) => r.data.data),
    enabled: isStaff,
  });

  // ── 4. Save / Update Mutation ────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const formatted = {
        ...payload,
        year: payload.year ? parseInt(payload.year) : undefined,
        copies: parseInt(payload.copies) || 1,
        price: payload.price ? parseFloat(payload.price) : undefined,
      };
      if (editingBook) {
        return api.put(`/library/${editingBook.id}`, formatted);
      }
      return api.post("/library", formatted);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success(editingBook ? "Book updated" : "Book added to catalog");
      setModalOpen(false);
      setEditingBook(null);
      setForm(INITIAL_FORM);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to save book");
    },
  });

  // ── 5. Delete Mutation ───────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/library/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Book deleted");
      setDeleteOpen(false);
      setSelectedBookToDelete(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete book");
    },
  });

  // ── 6. Issue Mutation ────────────────────────────────────────────────────
  const issueMutation = useMutation({
    mutationFn: ({ bookId, ...d }) => api.post(`/library/${bookId}/issue`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Book issued successfully");
      setIssueOpen(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to issue book");
    },
  });

  // ── Tag Helpers ──
  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    if (!form.tags.includes(tagInput.trim())) {
      setForm((f) => ({ ...f, tags: [...f.tags, tagInput.trim()] }));
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleOpenEdit = (book) => {
    setEditingBook(book);
    setForm({
      title: book.title || "",
      author: book.author || "",
      isbn: book.isbn || "",
      edition: book.edition || "",
      language: book.language || "English",
      description: book.description || "",
      category: book.category || "General",
      tags: Array.isArray(book.tags) ? book.tags : [],
      publisher: book.publisher || "",
      year: book.year || new Date().getFullYear(),
      copies: book.copies || 1,
      condition: book.condition || "Good",
      acquisitionSource: book.acquisitionSource || "Purchase",
      price: book.price != null ? String(book.price) : "",
      digitalCopyUrl: book.digitalCopyUrl || "",
      barcodeNumber: book.barcodeNumber || "",
      coverUrl: book.coverUrl || "",
      location: book.location || "",
    });
    setActiveModalTab("basic");
    setModalOpen(true);
  };

  const books = data?.data ?? [];
  const meta = data?.meta ?? {};

  // Collect all unique tags for filter pills
  const allTags = Array.from(
    new Set(books.flatMap((b) => (Array.isArray(b.tags) ? b.tags : []))),
  );

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary-600" />
            Library & Resource Center
          </h1>
          <p className="page-subtitle">
            {meta.total ?? 0} titles catalogued · Advanced tagging, digital copies, and barcode inventory.
          </p>
        </div>

        {isStaff && (
          <button
            className="btn-primary inline-flex items-center gap-2 shadow-sm"
            onClick={() => {
              setEditingBook(null);
              setForm(INITIAL_FORM);
              setActiveModalTab("basic");
              setModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add Book to Catalog
          </button>
        )}
      </div>

      {/* ── My borrowed books (Student banner) ── */}
      {!isStaff && myBooks?.filter((b) => !b.returnedAt).length > 0 && (
        <div className="card p-5 border-l-4 border-l-primary-600">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-primary-600" />
            My Active Borrowed Books
          </h3>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {myBooks
              .filter((b) => !b.returnedAt)
              .map((issue) => (
                <div
                  key={issue.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {issue.book?.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {issue.book?.author} · {issue.book?.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      Due: {new Date(issue.dueDate).toLocaleDateString()}
                    </p>
                    {new Date(issue.dueDate) < new Date() && (
                      <Badge variant="red">Overdue</Badge>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Filter & Search Toolbar ── */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, author, ISBN, barcode…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-9 w-full text-xs"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="input w-full text-xs"
            >
              <option value="ALL">All Categories</option>
              <option value="General">General</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Natural Science">Natural Science</option>
              <option value="Social Science">Social Science</option>
              <option value="Languages & Literature">Languages & Literature</option>
              <option value="History & Geography">History & Geography</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Reference & Dictionaries">Reference & Dictionaries</option>
            </select>
          </div>

          {/* Tag Filter */}
          <div>
            <select
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                setPage(1);
              }}
              className="input w-full text-xs"
            >
              <option value="">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  Tag: #{tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Tag Filter Pills */}
        {selectedTag && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-500 font-medium">Active filter:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 text-primary-800 dark:bg-primary-900/60 dark:text-primary-300">
              #{selectedTag}
              <button
                type="button"
                onClick={() => setSelectedTag("")}
                className="hover:text-red-500 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ── Book Grid ── */}
      {isLoading ? (
        <PageLoader />
      ) : books.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={BookOpen}
            title="No books found"
            description="Try adjusting your search keywords, category, or tag filter."
            action={
              isStaff && (
                <button
                  onClick={() => {
                    setEditingBook(null);
                    setForm(INITIAL_FORM);
                    setModalOpen(true);
                  }}
                  className="btn-primary mt-4 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add New Book
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {books.map((b) => (
            <div
              key={b.id}
              className="card p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="space-y-2.5">
                {/* Book Cover / Banner */}
                <div className="w-full h-36 bg-gradient-to-br from-primary-900 to-indigo-950 rounded-xl flex items-center justify-center relative overflow-hidden text-white p-3 text-center">
                  {b.coverUrl ? (
                    <img
                      src={b.coverUrl}
                      alt={b.title}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="space-y-1">
                      <BookOpen className="w-8 h-8 mx-auto text-primary-300 opacity-80" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary-200 line-clamp-1">
                        {b.category}
                      </p>
                    </div>
                  )}

                  {/* Digital Badge */}
                  {b.digitalCopyUrl && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500 text-white shadow-xs">
                      E-BOOK
                    </span>
                  )}
                </div>

                {/* Info */}
                <div>
                  <h3 className="font-extrabold text-gray-900 dark:text-white text-sm line-clamp-2 leading-snug">
                    {b.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    by <strong>{b.author}</strong>
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 flex-wrap">
                    {b.edition && <span>{b.edition}</span>}
                    {b.edition && <span>·</span>}
                    {b.language && <span>{b.language}</span>}
                    {b.year && <span>· {b.year}</span>}
                  </div>
                </div>

                {/* Barcode & Shelf */}
                {(b.barcodeNumber || b.location) && (
                  <div className="text-[11px] text-gray-500 flex items-center gap-2">
                    {b.barcodeNumber && (
                      <span className="inline-flex items-center gap-1">
                        <Barcode className="w-3 h-3 text-gray-400" />
                        {b.barcodeNumber}
                      </span>
                    )}
                    {b.location && <span>Shelf: {b.location}</span>}
                  </div>
                )}

                {/* Tags */}
                {Array.isArray(b.tags) && b.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {b.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTag(t)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={b.available > 0 ? "green" : "red"}>
                    {b.available > 0
                      ? `${b.available} of ${b.copies} available`
                      : "All copies issued"}
                  </Badge>

                  {b.condition && (
                    <span className="text-[10px] font-semibold text-gray-400">
                      {b.condition}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 pt-1">
                  <div className="flex items-center gap-1">
                    {/* Digital copy link */}
                    {b.digitalCopyUrl && (
                      <a
                        href={b.digitalCopyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 transition-colors"
                        title="Open Digital E-Book"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Edit Book (Staff) */}
                    {isStaff && (
                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 transition-colors"
                        title="Edit Book Details"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Book (Staff) */}
                    {isStaff && b.available === b.copies && (
                      <button
                        onClick={() => {
                          setSelectedBookToDelete(b);
                          setDeleteOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                        title="Delete Title"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Issue Button */}
                  {isStaff && b.available > 0 && (
                    <button
                      className="btn-primary py-1 px-2.5 text-xs inline-flex items-center gap-1"
                      onClick={() => {
                        setIssueOpen(b);
                        setIssueForm({ studentProfileId: "", dueDate: "" });
                      }}
                    >
                      Issue Book
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={meta.totalPages ?? 1}
        onChange={setPage}
      />

      {/* ── ADD / EDIT BOOK MODAL (Grouped Tabs) ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBook ? `Edit Book: ${editingBook.title}` : "Add Book to Catalog"}
        size="lg"
      >
        <div className="space-y-4">
          {/* Modal Tabs Header */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 gap-2">
            {[
              { id: "basic", label: "Basic Info" },
              { id: "classification", label: "Classification & Tags" },
              { id: "inventory", label: "Inventory & Source" },
              { id: "digital", label: "Digital & Cover" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveModalTab(tab.id)}
                className={clsx(
                  "px-3 py-2 text-xs font-bold border-b-2 transition-colors",
                  activeModalTab === tab.id
                    ? "border-primary-600 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-900",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Basic Info */}
          {activeModalTab === "basic" && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Book Title *
                </label>
                <input
                  className="input w-full font-medium"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Ethiopian History & Heritage: Grade 10"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Author(s) *
                  </label>
                  <input
                    className="input w-full"
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    placeholder="e.g. Dr. Berhanu Gebre"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Category *
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="General">General</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Natural Science">Natural Science</option>
                    <option value="Social Science">Social Science</option>
                    <option value="Languages & Literature">Languages & Literature</option>
                    <option value="History & Geography">History & Geography</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Reference & Dictionaries">Reference & Dictionaries</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Publisher
                  </label>
                  <input
                    className="input w-full text-xs"
                    value={form.publisher}
                    onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                    placeholder="e.g. Oxford / MoE"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Publication Year
                  </label>
                  <input
                    type="number"
                    className="input w-full text-xs"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Language
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                  >
                    <option value="English">English</option>
                    <option value="Amharic">Amharic</option>
                    <option value="Afaan Oromo">Afaan Oromo</option>
                    <option value="Tigrinya">Tigrinya</option>
                    <option value="French">French</option>
                    <option value="Arabic">Arabic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Edition
                </label>
                <input
                  className="input w-full text-xs"
                  value={form.edition}
                  onChange={(e) => setForm({ ...form, edition: e.target.value })}
                  placeholder="e.g. 3rd Revised Edition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Description & Abstract
                </label>
                <textarea
                  rows={2}
                  className="input w-full text-xs"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief synopsis, curriculum topics covered, or target grade…"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Classification & Tags */}
          {activeModalTab === "classification" && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    ISBN Number
                  </label>
                  <input
                    className="input w-full text-xs"
                    value={form.isbn}
                    onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                    placeholder="e.g. 978-0-123456-47-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Barcode / Asset ID
                  </label>
                  <input
                    className="input w-full text-xs"
                    value={form.barcodeNumber}
                    onChange={(e) => setForm({ ...form, barcodeNumber: e.target.value })}
                    placeholder="e.g. LIB-2024-00892"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Physical Shelf / Location
                </label>
                <input
                  className="input w-full text-xs"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Shelf B4 - Science Section"
                />
              </div>

              {/* Tags Manager */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Tags & Keywords
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add tag (e.g. Grade 10, STEM, Textbook)…"
                    className="input flex-1 text-xs"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="btn-secondary text-xs"
                  >
                    Add Tag
                  </button>
                </div>

                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-primary-50 text-primary-700 border border-primary-200"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Inventory & Procurement */}
          {activeModalTab === "inventory" && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Number of Copies *
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input w-full text-xs"
                    value={form.copies}
                    onChange={(e) => setForm({ ...form, copies: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Physical Condition
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  >
                    <option value="New">New / Mint</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair / Worn</option>
                    <option value="Damaged">Needs Repair / Binding</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Acquisition Source
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={form.acquisitionSource}
                    onChange={(e) =>
                      setForm({ ...form, acquisitionSource: e.target.value })
                    }
                  >
                    <option value="Purchase">School Direct Purchase</option>
                    <option value="Ministry">Ministry of Education Grant</option>
                    <option value="Donation">Alumni / Parent Donation</option>
                    <option value="NGO">NGO / Educational Partner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Unit Price / Valuation (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 450.00"
                    className="input w-full text-xs"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Digital & Cover */}
          {activeModalTab === "digital" && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Digital Copy / E-Book URL (PDF or Reader Link)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/books/grade-10-math.pdf"
                  className="input w-full text-xs"
                  value={form.digitalCopyUrl}
                  onChange={(e) =>
                    setForm({ ...form, digitalCopyUrl: e.target.value })
                  }
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Students and teachers can download or read this digital copy online.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/covers/math10.jpg"
                  className="input w-full text-xs"
                  value={form.coverUrl}
                  onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.title.trim() || !form.author.trim()}
            >
              {saveMutation.isPending
                ? "Saving…"
                : editingBook
                  ? "Update Book"
                  : "Save to Catalog"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── ISSUE BOOK MODAL ── */}
      <Modal
        isOpen={!!issueOpen}
        onClose={() => setIssueOpen(null)}
        title={`Issue Book: ${issueOpen?.title}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Select Student *
            </label>
            <select
              className="input w-full text-xs"
              value={issueForm.studentProfileId}
              onChange={(e) =>
                setIssueForm((f) => ({
                  ...f,
                  studentProfileId: e.target.value,
                }))
              }
              required
            >
              <option value="">— Select student —</option>
              {(students ?? []).map((s) => (
                <option key={s.studentProfile?.id} value={s.studentProfile?.id}>
                  {s.firstName} {s.lastName} ({s.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Due Date *
            </label>
            <input
              className="input w-full text-xs"
              type="date"
              value={issueForm.dueDate}
              onChange={(e) =>
                setIssueForm((f) => ({ ...f, dueDate: e.target.value }))
              }
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIssueOpen(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                issueMutation.mutate({
                  bookId: issueOpen?.id,
                  studentProfileId: issueForm.studentProfileId,
                  dueDate: new Date(issueForm.dueDate).toISOString(),
                })
              }
              disabled={
                issueMutation.isPending ||
                !issueForm.studentProfileId ||
                !issueForm.dueDate
              }
            >
              {issueMutation.isPending ? "Issuing…" : "Issue Book"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── DELETE BOOK MODAL ── */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Book from Catalog"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to delete{" "}
            <strong>{selectedBookToDelete?.title}</strong>?
          </p>
          <p className="text-xs text-gray-500">
            This will remove the title from the library inventory catalog.
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => deleteMutation.mutate(selectedBookToDelete?.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
