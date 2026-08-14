import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen, Search } from "lucide-react";
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

export default function LibraryPage() {
  const { isAdmin, isTeacher, isStudent } = useAuthStore();
  const qc = useQueryClient();
  const isStaff = isAdmin() || isTeacher();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedBookToDelete, setSelectedBookToDelete] = useState(null);
  const [form, setForm] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "General",
    copies: 1,
  });
  const [issueForm, setIssueForm] = useState({
    studentProfileId: "",
    dueDate: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["library", page, search],
    queryFn: () =>
      api
        .get(`/library?page=${page}&limit=15&search=${search}`)
        .then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: myBooks } = useQuery({
    queryKey: ["my-books"],
    queryFn: () => api.get("/library/my").then((r) => r.data.data),
    enabled: isStudent(),
  });

  const { data: students } = useQuery({
    queryKey: ["students-simple"],
    queryFn: () =>
      api.get("/users?role=STUDENT&limit=200").then((r) => r.data.data),
    enabled: isStaff,
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post("/library", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Book added");
      setAddOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/library/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Book deleted");
      setDeleteOpen(false);
      setSelectedBookToDelete(null);
    },
  });

  const issueMutation = useMutation({
    mutationFn: ({ bookId, ...d }) => api.post(`/library/${bookId}/issue`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Book issued");
      setIssueOpen(null);
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const books = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="page-subtitle">{meta.total ?? 0} books in catalogue</p>
        </div>
        {isStaff && (
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" /> Add Book
          </button>
        )}
      </div>

      {/* My borrowed books */}
      {!isStaff && myBooks?.filter((b) => !b.returnedAt).length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">📚 My Borrowed Books</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {myBooks
              .filter((b) => !b.returnedAt)
              .map((issue) => (
                <div
                  key={issue.id}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {issue.book?.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {issue.book?.author}
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

      {/* Search */}
      <div className="w-full max-w-sm">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search books…"
        />
      </div>

      {/* Book grid */}
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {books.length === 0 && (
            <EmptyState icon={BookOpen} title="No books found" />
          )}
          {books.map((b) => (
            <div key={b.id} className="card p-4 flex flex-col">
              <div className="w-full h-32 bg-gradient-to-br from-primary-100 to-indigo-100 rounded-xl flex items-center justify-center mb-3">
                <BookOpen className="w-12 h-12 text-primary-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                  {b.title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{b.author}</p>
                <p className="text-xs text-gray-400 mt-0.5">{b.category}</p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 gap-2">
                <Badge variant={b.available > 0 ? "green" : "red"}>
                  {b.available > 0 ? `${b.available} available` : "All issued"}
                </Badge>
                <div className="flex items-center gap-2">
                  {isStaff && b.available > 0 && (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => {
                        setIssueOpen(b);
                        setIssueForm({ studentProfileId: "", dueDate: "" });
                      }}
                    >
                      Issue
                    </button>
                  )}
                  {isStaff && b.available === b.copies && (
                    <button
                      className="btn-ghost btn-sm text-red-600"
                      onClick={() => {
                        setSelectedBookToDelete(b);
                        setDeleteOpen(true);
                      }}
                    >
                      Delete
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

      {/* Add book modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Book"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  copies: parseInt(form.copies),
                })
              }
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Adding…" : "Add Book"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={set("title")}
              required
            />
          </div>
          <div>
            <label className="label">Author *</label>
            <input
              className="input"
              value={form.author}
              onChange={set("author")}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ISBN</label>
              <input
                className="input"
                value={form.isbn}
                onChange={set("isbn")}
              />
            </div>
            <div>
              <label className="label">Category</label>
              <input
                className="input"
                value={form.category}
                onChange={set("category")}
              />
            </div>
          </div>
          <div>
            <label className="label">Number of Copies</label>
            <input
              className="input"
              type="number"
              min="1"
              value={form.copies}
              onChange={set("copies")}
            />
          </div>
        </div>
      </Modal>

      {/* Issue book modal */}
      <Modal
        open={!!issueOpen}
        onClose={() => setIssueOpen(null)}
        title={`Issue: ${issueOpen?.title}`}
        size="sm"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setIssueOpen(null)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() =>
                issueMutation.mutate({
                  bookId: issueOpen?.id,
                  studentProfileId: issueForm.studentProfileId,
                  dueDate: new Date(issueForm.dueDate).toISOString(),
                })
              }
              disabled={issueMutation.isPending}
            >
              {issueMutation.isPending ? "Issuing…" : "Issue Book"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Student *</label>
            <select
              className="input"
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
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Due Date *</label>
            <input
              className="input"
              type="date"
              value={issueForm.dueDate}
              onChange={(e) =>
                setIssueForm((f) => ({ ...f, dueDate: e.target.value }))
              }
              required
            />
          </div>
        </div>
      </Modal>

      {/* Delete book modal */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Book"
        size="sm"
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-danger"
              onClick={() => deleteMutation.mutate(selectedBookToDelete?.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to delete{" "}
          <strong>{selectedBookToDelete?.title}</strong>?
        </p>
        <p className="text-sm text-gray-500 mt-3">
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
