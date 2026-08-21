import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Calendar,
  Building,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  ExternalLink,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState } from "../../components/ui/index";
import PageLoader from "../../components/ui/PageLoader";

const REGISTRATION_STATUS_CONFIG = {
  NOT_REGISTERED: { label: "Not Registered", variant: "gray" },
  REGISTERED: { label: "Registered", variant: "blue" },
  SAT: { label: "Sat for Exam", variant: "purple" },
  ABSENT: { label: "Absent", variant: "red" },
  RESULT_PENDING: { label: "Result Pending", variant: "yellow" },
  RESULT_RECORDED: { label: "Result Recorded", variant: "green" },
};

export default function MyExternalExamRecordsPage() {
  const { data: records, isLoading } = useQuery({
    queryKey: ["my-external-exam-records"],
    queryFn: () => api.get("/external-exams/records/mine").then((r) => r.data.data),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Award className="w-7 h-7 text-primary-600" />
          My External & National Exam Records
        </h1>
        <p className="page-subtitle">
          View official ministry exam registrations, candidate numbers, exam centers, and published results.
        </p>
      </div>

      {!records || records.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No External Exam Records"
          description="You currently have no external/national examination records on file."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {records.map((record) => {
            const cp = record.checkpoint;
            const stConfig =
              REGISTRATION_STATUS_CONFIG[record.status] ||
              REGISTRATION_STATUS_CONFIG.NOT_REGISTERED;
            const student = record.studentProfile;
            const studentName = [
              student?.user?.firstName,
              student?.user?.middleName,
              student?.user?.lastName,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={record.id}
                className="card p-6 border border-gray-200 dark:border-gray-800 space-y-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="badge-primary font-mono text-xs">
                    {cp?.academicYear}
                  </span>
                  <Badge variant={stConfig.variant}>{stConfig.label}</Badge>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                    {cp?.name}
                  </h3>
                  {cp?.administeringBody && (
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Building className="w-3.5 h-3.5" />
                      {cp.administeringBody}
                    </p>
                  )}
                  {studentName && (
                    <p className="text-xs text-primary-700 dark:text-primary-400 font-semibold mt-1">
                      Student: {studentName} ({student?.admissionNumber || "—"})
                    </p>
                  )}
                </div>

                {/* Candidate Info Box */}
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Official Candidate # / Reg:</span>
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                      {record.registrationNumber || "To be assigned"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Exam Center:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {record.examCenter || "To be announced"}
                    </span>
                  </div>

                  {cp?.examWindowStart && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Exam Window:</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {new Date(cp.examWindowStart).toLocaleDateString()}
                        {cp.examWindowEnd && ` – ${new Date(cp.examWindowEnd).toLocaleDateString()}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Results Section */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    {record.status === "RESULT_RECORDED" ? (
                      <div className="flex items-center gap-2">
                        {record.score !== null && (
                          <span className="text-base font-black text-gray-900 dark:text-white font-mono">
                            {record.score}
                            {record.grade && (
                              <span className="ml-1.5 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 font-bold rounded-md">
                                {record.grade}
                              </span>
                            )}
                          </span>
                        )}
                        {record.isPassing === true ? (
                          <span className="badge-green inline-flex items-center gap-1 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Official Pass
                          </span>
                        ) : record.isPassing === false ? (
                          <span className="badge-red inline-flex items-center gap-1 text-xs">
                            <XCircle className="w-3.5 h-3.5" /> Did Not Pass
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Official result pending publication
                      </span>
                    )}
                  </div>

                  {record.resultDocumentUrl && (
                    <a
                      href={record.resultDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary btn-sm text-xs flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5 text-primary-600" />
                      Result Slip
                      <ExternalLink className="w-3 h-3 ml-0.5 text-gray-400" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
