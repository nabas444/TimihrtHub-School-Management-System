import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, TrendingUp, AlertTriangle } from "lucide-react";
import api from "../../lib/api";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import StatCard from "../../components/shared/StatCard";
import PageLoader from "../../components/ui/PageLoader";
import { Badge } from "../../components/ui/index";

export default function MyAttendancePage() {
  const { t } = useTranslation();

  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ["my-attendance"],
    queryFn: () => api.get("/attendance/me").then((r) => r.data.data),
  });

  if (myLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t("attendance.overview.title")}</h1>
          <p className="page-subtitle">{t("attendance.overview.subtitle_student")}</p>
        </div>
      </div>

      {myData && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={CalendarCheck}
              label={t("attendance.overview.total_days")}
              value={myData.total}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label={t("attendance.present")}
              value={myData.present}
              color="green"
            />
            <StatCard
              icon={AlertTriangle}
              label={t("attendance.absent")}
              value={myData.absent}
              color="red"
            />
            <StatCard
              icon={CalendarCheck}
              label={t("attendance.overview.rate")}
              value={`${myData.percentage}%`}
              color={myData.percentage >= 75 ? "green" : "red"}
            />
          </div>

          {myData.percentage < 75 && (
            <div className="card card-body bg-red-50 border border-red-200">
              <p className="text-red-700 text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />{" "}
                {t("attendance.overview.below_threshold_warning")}
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold">
                {t("attendance.overview.recent_records")}
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {(myData.recentRecords ?? []).map((r, i) => (
                <div
                  key={i}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <span className="text-sm text-gray-700">
                    {new Date(r.date).toLocaleDateString("en", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    {r.note && (
                      <span className="text-xs text-gray-400">{r.note}</span>
                    )}
                    <Badge
                      variant={
                        r.status === "PRESENT"
                          ? "green"
                          : r.status === "LATE"
                          ? "yellow"
                          : r.status === "EXCUSED"
                          ? "blue"
                          : "red"
                      }
                    >
                      {r.status === "PRESENT"
                        ? t("attendance.present")
                        : r.status === "LATE"
                        ? t("attendance.late")
                        : r.status === "EXCUSED"
                        ? t("attendance.excused")
                        : t("attendance.absent")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
