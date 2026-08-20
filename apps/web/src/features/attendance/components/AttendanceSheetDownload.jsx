import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import api from "../../../lib/api";
import { downloadFile } from "../../../lib/downloadFile";
import { useTranslation } from "../../../lib/i18n/I18nProvider";
import toast from "react-hot-toast";

export default function AttendanceSheetDownload() {
  const { t } = useTranslation();
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [downloading, setDownloading] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/academics/classes").then((r) => r.data.data),
  });

  const handleDownload = async () => {
    if (!classId) {
      toast.error(t("attendance.overview.sheet_select_class_first"));
      return;
    }
    setDownloading(true);
    try {
      await downloadFile(
        `/attendance/class/${classId}/sheet?startDate=${startDate}&endDate=${endDate}`,
        `attendance-sheet-${startDate}-to-${endDate}.pdf`,
      );
    } catch {
      toast.error(t("attendance.overview.sheet_download_error"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card p-5 bg-white border border-gray-200 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          {t("attendance.class_label")}
        </label>
        <select
          className="input text-xs"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">{t("attendance.overview.sheet_select_class_option")}</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          {t("attendance.overview.start_date_label")}
        </label>
        <input
          type="date"
          className="input text-xs"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          {t("attendance.overview.end_date_label")}
        </label>
        <input
          type="date"
          className="input text-xs"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      <button
        onClick={handleDownload}
        disabled={downloading || !classId}
        className="btn-primary text-xs inline-flex items-center gap-1.5"
      >
        <Download className="w-4 h-4" />
        {downloading
          ? t("attendance.overview.preparing")
          : t("attendance.overview.download_sheet_button")}
      </button>
    </div>
  );
}
