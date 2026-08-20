import { useQuery } from "@tanstack/react-query";
import {
  HeartHandshake,
  Award,
  Utensils,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import api from "../../lib/api";
import { Badge, EmptyState, PageLoader } from "../../components/ui/index";
import clsx from "clsx";

export default function MyStudentSupportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-student-support"],
    queryFn: async () => {
      const res = await api.get("/student-support/my-support");
      return res.data?.data?.enrollments || [];
    },
  });

  const enrollments = data || [];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 bg-primary-100 dark:bg-primary-950/60 rounded-xl text-primary-600 dark:text-primary-400">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Student Support & Scholarships
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Active financial aid, scholarship programs, and meal assistance benefits
            </p>
          </div>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No active support programs"
          description="You are currently not enrolled in any scholarship or financial aid programs."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {enrollments.map((item) => {
            const program = item.supportProgram;
            const student = item.studentProfile;
            const studentUser = student?.user;
            const studentName = studentUser
              ? `${studentUser.firstName} ${studentUser.lastName}`
              : "Student";

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary-50 dark:bg-primary-950/50 rounded-xl text-primary-600 dark:text-primary-400">
                        {program.type === "SCHOLARSHIP" && (
                          <Award className="w-6 h-6" />
                        )}
                        {program.type === "FINANCIAL_AID" && (
                          <DollarSign className="w-6 h-6" />
                        )}
                        {program.type === "MEAL_SUPPORT" && (
                          <Utensils className="w-6 h-6" />
                        )}
                        {program.type === "OTHER" && (
                          <HeartHandshake className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                          {program.type.replace("_", " ")}
                        </span>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-snug">
                          {program.name}
                        </h3>
                      </div>
                    </div>

                    <Badge
                      variant={item.status === "ACTIVE" ? "success" : "default"}
                    >
                      {item.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                    {program.description || "Active student support enrollment."}
                  </p>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium uppercase">
                        Beneficiary
                      </span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {studentName}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-medium uppercase">
                        Tuition Waiver
                      </span>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {program.waiverPercent !== null &&
                        program.waiverPercent !== undefined
                          ? `${program.waiverPercent}% Waived`
                          : "None"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Enrolled: {new Date(item.startDate).toLocaleDateString()}
                    </span>
                  </div>
                  {program.academicYear && (
                    <span>Year: {program.academicYear}</span>
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
