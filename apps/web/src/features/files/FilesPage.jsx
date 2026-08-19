import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Trash2, Download, Image, File } from "lucide-react";
import api from "../../lib/api";
import { downloadFile } from "../../lib/downloadFile";
import { Badge, EmptyState, Pagination } from "../../components/ui/index";
import PageLoader from "../../components/ui/PageLoader";
import { useAuthStore } from "../../store/authStore";
import { format } from "date-fns";
import toast from "react-hot-toast";
import clsx from "clsx";

const FILE_ICON = (mime) => {
  if (mime?.startsWith("image/"))
    return { icon: Image, color: "text-green-500 bg-green-50" };
  if (mime?.includes("pdf"))
    return { icon: FileText, color: "text-red-500 bg-red-50" };
  return { icon: File, color: "text-blue-500 bg-blue-50" };
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function FilesPage() {
  const { user, isAdmin, isTeacher } = useAuthStore();
  const qc = useQueryClient();
  const isStaff = isAdmin() || isTeacher();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["files", page, category],
    queryFn: () =>
      api
        .get(
          `/files?page=${page}&limit=20${category ? `&category=${category}` : ""}`,
        )
        .then((r) => r.data),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/files/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] });
      toast.success("File deleted");
    },
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category || "RESOURCE");
      await api.post("/files/upload", formData);
      qc.invalidateQueries({ queryKey: ["files"] });
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const files = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Files & Resources</h1>
          <p className="page-subtitle">{meta.total ?? 0} files</p>
        </div>
        <>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            className="btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4" />{" "}
            {uploading ? "Uploading…" : "Upload File"}
          </button>
        </>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["", "SYLLABUS", "RESOURCE", "REPORT", "OTHER"].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={clsx(
              "btn-sm",
              category === c ? "btn-primary" : "btn-secondary",
            )}
          >
            {c || "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Category</th>
                <th>Size</th>
                <th>Uploaded by</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={FileText}
                      title="No files uploaded"
                      description={
                        isStaff
                          ? "Upload your first file"
                          : "No resources available yet"
                      }
                    />
                  </td>
                </tr>
              )}
              {files.map((f) => {
                const { icon: Icon, color } = FILE_ICON(f.mimeType);
                return (
                  <tr key={f.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                            color,
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-gray-900 max-w-xs truncate">
                          {f.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge variant="gray">{f.category ?? "OTHER"}</Badge>
                    </td>
                    <td className="text-sm text-gray-500">
                      {formatSize(f.size)}
                    </td>
                    <td className="text-sm text-gray-500">
                      {f.uploadedBy?.firstName} {f.uploadedBy?.lastName}
                    </td>
                    <td className="text-sm text-gray-400">
                      {format(new Date(f.createdAt), "dd MMM yyyy")}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            toast.promise(
                              downloadFile(`/files/${f.id}/download`, f.name),
                              {
                                loading: `Downloading ${f.name}…`,
                                success: "Download completed!",
                                error: (err) =>
                                  err.response?.data?.message ||
                                  "Could not download file.",
                              },
                            );
                          }}
                          className="btn-ghost btn-icon text-gray-400 hover:text-primary-600"
                          title={`Download ${f.name}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {(isStaff || f.uploadedBy?.id === user?.id) && (
                          <button
                            onClick={() => deleteMutation.mutate(f.id)}
                            className="btn-ghost btn-icon text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-6 pb-4">
            <Pagination
              page={page}
              totalPages={meta.totalPages ?? 1}
              onChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
