import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import {
  ProtectedRoute,
  AdminRoute,
  StaffRoute,
  FinanceRoute,
} from "./ProtectedRoute";
import AppLayout from "../components/layout/AppLayout";
import AuthLayout from "../components/layout/AuthLayout";
import PageLoader from "../components/ui/PageLoader";
import { useAuthStore } from "../store/authStore";

const S = ({ children }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

const LoginPage = lazy(() => import("../features/auth/LoginPage"));
const RegisterPage = lazy(() => import("../features/auth/RegisterPage"));
const ForgotPasswordPage = lazy(
  () => import("../features/auth/ForgotPasswordPage"),
);
const ResetPasswordPage = lazy(
  () => import("../features/auth/ResetPasswordPage"),
);
const LandingPage = lazy(() => import("../pages/LandingPage"));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const StudentsPage = lazy(() => import("../features/students/StudentsPage"));
const StudentDetailPage = lazy(
  () => import("../features/students/StudentDetailPage"),
);
const HelpCenterPage = lazy(() => import("../pages/HelpCenterPage"));
const ApiDocsPage = lazy(() => import("../pages/ApiDocsPage"));
const ReleaseNotesPage = lazy(() => import("../pages/ReleaseNotesPage"));
const CommunityPage = lazy(() => import("../pages/CommunityPage"));
const AssignmentsPage = lazy(
  () => import("../features/academics/AssignmentsPage"),
);
const AssignmentDetailPage = lazy(
  () => import("../features/academics/AssignmentDetailPage"),
);
const ExamsPage = lazy(() => import("../features/academics/ExamsPage"));
const SubjectRosterPage = lazy(
  () => import("../features/academics/SubjectRosterPage"),
);
const MasterRosterPage = lazy(
  () => import("../features/academics/MasterRosterPage"),
);
const MyGradesPage = lazy(() => import("../features/academics/MyGradesPage"));
const SubjectsPage = lazy(() => import("../features/academics/SubjectsPage"));
const ClassesPage = lazy(() => import("../features/academics/ClassesPage"));
const StaffDailyAttendancePage = lazy(
  () => import("../features/attendance/StaffDailyAttendancePage"),
);
const StaffAttendanceAnalyticsPage = lazy(
  () => import("../features/attendance/StaffAttendanceAnalyticsPage"),
);
const AttendancePenaltiesPage = lazy(
  () => import("../features/attendance/AttendancePenaltiesPage"),
);
const StudentAttendanceReportsPage = lazy(
  () => import("../features/attendance/StudentAttendanceReportsPage"),
);
const MyAttendancePage = lazy(
  () => import("../features/attendance/MyAttendancePage"),
);
const AttendanceMarkPage = lazy(
  () => import("../features/attendance/AttendanceMarkPage"),
);
const BehaviourPage = lazy(() => import("../features/behaviour/BehaviourPage"));
const TimetablePage = lazy(() => import("../features/timetable/TimetablePage"));
const ChatPage = lazy(() => import("../features/chat/ChatPage"));
const AnnouncementsPage = lazy(
  () => import("../features/announcements/AnnouncementsPage"),
);
const MeetingsPage = lazy(() => import("../features/meetings/MeetingsPage"));
const FeesPage = lazy(() => import("../features/fees/FeesPage"));
const LibraryPage = lazy(() => import("../features/library/LibraryPage"));
const ClubDirectoryPage = lazy(
  () => import("../features/clubs/ClubDirectoryPage"),
);
const MyClubsPage = lazy(() => import("../features/clubs/MyClubsPage"));
const ClubCalendarPage = lazy(
  () => import("../features/clubs/ClubCalendarPage"),
);
const PendingClubApprovalsPage = lazy(
  () => import("../features/clubs/PendingClubApprovalsPage"),
);
const ClubRenewalsPage = lazy(
  () => import("../features/clubs/ClubRenewalsPage"),
);
const ClubDetailPage = lazy(() => import("../features/clubs/ClubDetailPage"));
const FilesPage = lazy(() => import("../features/files/FilesPage"));
const IdCardsPage = lazy(() => import("../features/id-cards/IdCardsPage"));
const ReportCardsPage = lazy(
  () => import("../features/report-cards/ReportCardsPage"),
);
const CertificatesPage = lazy(
  () => import("../features/certificates/CertificatesPage"),
);
const MyCertificatesPage = lazy(
  () => import("../features/certificates/MyCertificatesPage"),
);
const ExternalExamCheckpointsPage = lazy(
  () => import("../features/external-exams/ExternalExamCheckpointsPage"),
);
const MyExternalExamRecordsPage = lazy(
  () => import("../features/external-exams/MyExternalExamRecordsPage"),
);
const CeremonyEventsPage = lazy(
  () => import("../features/ceremonies/CeremonyEventsPage"),
);
const AnnualPlansPage = lazy(
  () => import("../features/annual-plans/AnnualPlansPage"),
);
const AnnualPlanEditorPage = lazy(
  () => import("../features/annual-plans/AnnualPlanEditorPage"),
);
const SupportProgramsPage = lazy(
  () => import("../features/student-support/SupportProgramsPage"),
);
const SupportEnrollmentsPage = lazy(
  () => import("../features/student-support/SupportEnrollmentsPage"),
);
const MyStudentSupportPage = lazy(
  () => import("../features/student-support/MyStudentSupportPage"),
);
const TutorialSessionsPage = lazy(
  () => import("../features/tutorials/TutorialSessionsPage"),
);
const StudentTutorialsPage = lazy(
  () => import("../features/tutorials/StudentTutorialsPage"),
);
const StaffPage = lazy(() => import("../features/staff/StaffPage"));
const ParentsPage = lazy(() => import("../features/parents/ParentsPage"));
const EmployeesPage = lazy(() => import("../features/hr/EmployeesPage"));
const HRDashboardPage = lazy(() => import("../features/hr/HRDashboardPage"));
const RecruitingPage = lazy(() => import("../features/recruiting/RecruitingPage"));
const PublicJobBoardPage = lazy(() => import("../features/recruiting-public/JobBoardPage"));
const JobPostingDetailPage = lazy(() => import("../features/recruiting-public/JobPostingDetailPage"));
const LeavePage = lazy(() => import("../features/staff/LeavePage"));
const PublicApplicationPage = lazy(
  () => import("../features/admissions/PublicApplicationPage"),
);
const AdmissionsPage = lazy(
  () => import("../features/admissions/AdmissionsPage"),
);
const CurriculumPage = lazy(() => import("../features/curriculum/CurriculumPage"));
const PoliciesPage = lazy(() => import("../features/policies/PoliciesPage"));
const PolicyDetailPage = lazy(() => import("../features/policies/PolicyDetailPage"));
const AIInsightsPage = lazy(() => import("../features/ai/AIInsightsPage"));
const ProfilePage = lazy(() => import("../features/settings/ProfilePage"));
const SchoolSettingsPage = lazy(
  () => import("../features/settings/SchoolSettingsPage"),
);
const AuditLogsPage = lazy(
  () => import("../features/audit-logs/AuditLogsPage"),
);
const BillingPage = lazy(() => import("../features/billing/BillingPage"));
const HostelDashboardPage = lazy(() => import("../features/hostel/HostelDashboardPage"));
const HostelApplicationsPage = lazy(() => import("../features/hostel/HostelApplicationsPage"));
const HostelDailyOpsPage = lazy(() => import("../features/hostel/HostelDailyOpsPage"));
const HostelCarePage = lazy(() => import("../features/hostel/HostelCarePage"));
const HostelPortalPage = lazy(() => import("../features/hostel/HostelPortalPage"));
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);
const UnauthorizedPage = lazy(() =>
  import("../pages/NotFoundPage").then((m) => ({
    default: m.UnauthorizedPage,
  })),
);
const ErrorBoundaryPage = lazy(() => import("../pages/ErrorBoundaryPage"));

function AttendanceRedirect() {
  const { user } = useAuthStore();
  if (user?.role === "ADMIN") return <Navigate to="/attendance/staff-daily" replace />;
  if (user?.role === "TEACHER") return <Navigate to="/attendance/mark" replace />;
  return <Navigate to="/attendance/my" replace />;
}

function GradesRedirect() {
  const { user } = useAuthStore();
  if (user?.role === "ADMIN" || user?.role === "TEACHER") {
    return <Navigate to="/grades/roster" replace />;
  }
  return <Navigate to="/grades/mine" replace />;
}

function TutorialsRedirect() {
  const { user } = useAuthStore();
  if (user?.role === "ADMIN" || user?.role === "TEACHER") {
    return <TutorialSessionsPage />;
  }
  return <StudentTutorialsPage />;
}

function RootLanding() {
  return <LandingPage />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <S>
        <RootLanding />
      </S>
    ),
  },
  {
    path: "/help",
    element: (
      <S>
        <HelpCenterPage />
      </S>
    ),
  },
  {
    path: "/docs/api",
    element: (
      <S>
        <ApiDocsPage />
      </S>
    ),
  },
  {
    path: "/release-notes",
    element: (
      <S>
        <ReleaseNotesPage />
      </S>
    ),
  },
  {
    path: "/community",
    element: (
      <S>
        <CommunityPage />
      </S>
    ),
  },
  {
    path: "/jobs/public",
    element: (
      <S>
        <PublicJobBoardPage />
      </S>
    ),
  },
  {
    path: "/jobs/public/:schoolSlug",
    element: (
      <S>
        <PublicJobBoardPage />
      </S>
    ),
  },
  {
    path: "/careers/:schoolSlug",
    element: (
      <S>
        <PublicJobBoardPage />
      </S>
    ),
  },
  {
    path: "/careers/:schoolSlug/:postingSlug",
    element: (
      <S>
        <JobPostingDetailPage />
      </S>
    ),
  },
  {
    path: "/apply/:schoolSlug",
    element: (
      <S>
        <PublicApplicationPage />
      </S>
    ),
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/login",
        element: (
          <S>
            <LoginPage />
          </S>
        ),
      },
      {
        path: "/register",
        element: (
          <S>
            <RegisterPage />
          </S>
        ),
      },
      {
        path: "/forgot-password",
        element: (
          <S>
            <ForgotPasswordPage />
          </S>
        ),
      },
      {
        path: "/reset-password",
        element: (
          <S>
            <ResetPasswordPage />
          </S>
        ),
      },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: (
      <S>
        <ErrorBoundaryPage />
      </S>
    ),
    children: [
      {
        path: "/dashboard",
        element: (
          <S>
            <DashboardPage />
          </S>
        ),
      },
      {
        path: "/students",
        element: (
          <S>
            <StaffRoute>
              <StudentsPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/students/:id",
        element: (
          <S>
            <StudentDetailPage />
          </S>
        ),
      },
      {
        path: "/assignments",
        element: (
          <S>
            <AssignmentsPage />
          </S>
        ),
      },
      {
        path: "/assignments/:id",
        element: (
          <S>
            <AssignmentDetailPage />
          </S>
        ),
      },
      {
        path: "/exams",
        element: (
          <S>
            <ExamsPage />
          </S>
        ),
      },
      {
        path: "/grades",
        element: <GradesRedirect />,
      },
      {
        path: "/grades/roster",
        element: (
          <S>
            <StaffRoute>
              <SubjectRosterPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/grades/master",
        element: (
          <S>
            <StaffRoute>
              <MasterRosterPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/grades/mine",
        element: (
          <S>
            <MyGradesPage />
          </S>
        ),
      },
      {
        path: "/subjects",
        element: (
          <S>
            <StaffRoute>
              <SubjectsPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/classes",
        element: (
          <S>
            <StaffRoute>
              <ClassesPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/attendance",
        element: <AttendanceRedirect />,
      },
      {
        path: "/attendance/staff-daily",
        element: (
          <S>
            <AdminRoute>
              <StaffDailyAttendancePage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/attendance/staff-analytics",
        element: (
          <S>
            <AdminRoute>
              <StaffAttendanceAnalyticsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/attendance/penalties",
        element: (
          <S>
            <AdminRoute>
              <AttendancePenaltiesPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/attendance/student-reports",
        element: (
          <S>
            <StaffRoute>
              <StudentAttendanceReportsPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/attendance/mark",
        element: (
          <S>
            <StaffRoute>
              <AttendanceMarkPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/attendance/my",
        element: (
          <S>
            <MyAttendancePage />
          </S>
        ),
      },
      {
        path: "/behaviour",
        element: (
          <S>
            <BehaviourPage />
          </S>
        ),
      },
      {
        path: "/timetable",
        element: (
          <S>
            <TimetablePage />
          </S>
        ),
      },
      {
        path: "/chat",
        element: (
          <S>
            <ChatPage />
          </S>
        ),
      },
      {
        path: "/chat/:roomId",
        element: (
          <S>
            <ChatPage />
          </S>
        ),
      },
      {
        path: "/announcements",
        element: (
          <S>
            <AnnouncementsPage />
          </S>
        ),
      },
      {
        path: "/meetings",
        element: (
          <S>
            <MeetingsPage />
          </S>
        ),
      },
      {
        path: "/admissions",
        element: (
          <S>
            <AdminRoute>
              <AdmissionsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/fees",
        element: (
          <S>
            <FeesPage />
          </S>
        ),
      },
      {
        path: "/hostel",
        element: (
          <S>
            <StaffRoute>
              <HostelDashboardPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/hostel/applications",
        element: (
          <S>
            <StaffRoute>
              <HostelApplicationsPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/hostel/daily-ops",
        element: (
          <S>
            <StaffRoute>
              <HostelDailyOpsPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/hostel/care",
        element: (
          <S>
            <StaffRoute>
              <HostelCarePage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/hostel/my-room",
        element: (
          <S>
            <HostelPortalPage />
          </S>
        ),
      },
      {
        path: "/library",
        element: (
          <S>
            <LibraryPage />
          </S>
        ),
      },
      {
        path: "/clubs",
        element: <Navigate to="/clubs/directory" replace />,
      },
      {
        path: "/clubs/directory",
        element: (
          <S>
            <ClubDirectoryPage />
          </S>
        ),
      },
      {
        path: "/clubs/mine",
        element: (
          <S>
            <MyClubsPage />
          </S>
        ),
      },
      {
        path: "/clubs/calendar",
        element: (
          <S>
            <ClubCalendarPage />
          </S>
        ),
      },
      {
        path: "/clubs/pending",
        element: (
          <S>
            <AdminRoute>
              <PendingClubApprovalsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/clubs/renewals",
        element: (
          <S>
            <AdminRoute>
              <ClubRenewalsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/clubs/:id",
        element: (
          <S>
            <ClubDetailPage />
          </S>
        ),
      },
      {
        path: "/files",
        element: (
          <S>
            <FilesPage />
          </S>
        ),
      },
      {
        path: "/id-cards",
        element: (
          <S>
            <AdminRoute>
              <IdCardsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/report-cards",
        element: (
          <S>
            <StaffRoute>
              <ReportCardsPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/certificates",
        element: (
          <S>
            <StaffRoute>
              <CertificatesPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/certificates/mine",
        element: (
          <S>
            <MyCertificatesPage />
          </S>
        ),
      },
      {
        path: "/external-exams",
        element: (
          <S>
            <StaffRoute>
              <ExternalExamCheckpointsPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/external-exams/mine",
        element: (
          <S>
            <MyExternalExamRecordsPage />
          </S>
        ),
      },
      {
        path: "/ceremonies",
        element: (
          <S>
            <StaffRoute>
              <CeremonyEventsPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/annual-plans",
        element: (
          <S>
            <StaffRoute>
              <AnnualPlansPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/annual-plans/:id",
        element: (
          <S>
            <StaffRoute>
              <AnnualPlanEditorPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/curriculum",
        element: (
          <S>
            <StaffRoute>
              <CurriculumPage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/policies",
        element: (
          <S>
            <PoliciesPage />
          </S>
        ),
      },
      {
        path: "/policies/:id",
        element: (
          <S>
            <PolicyDetailPage />
          </S>
        ),
      },
      {
        path: "/policies/my-acknowledgments",
        element: (
          <S>
            <PoliciesPage />
          </S>
        ),
      },
      {
        path: "/student-support",
        element: (
          <S>
            <AdminRoute>
              <SupportProgramsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/student-support/enrollments",
        element: (
          <S>
            <AdminRoute>
              <SupportEnrollmentsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/student-support/my-support",
        element: (
          <S>
            <MyStudentSupportPage />
          </S>
        ),
      },
      {
        path: "/tutorials",
        element: (
          <S>
            <TutorialsRedirect />
          </S>
        ),
      },
      {
        path: "/parents",
        element: (
          <S>
            <AdminRoute>
              <ParentsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/employees",
        element: (
          <S>
            <AdminRoute>
              <EmployeesPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/hr-dashboard",
        element: (
          <S>
            <AdminRoute>
              <HRDashboardPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/recruiting",
        element: (
          <S>
            <AdminRoute>
              <RecruitingPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/staff",
        element: (
          <S>
            <AdminRoute>
              <StaffPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/staff/leave",
        element: (
          <S>
            <StaffRoute>
              <LeavePage />
            </StaffRoute>
          </S>
        ),
      },
      {
        path: "/ai",
        element: (
          <S>
            <AIInsightsPage />
          </S>
        ),
      },
      {
        path: "/settings/profile",
        element: (
          <S>
            <ProfilePage />
          </S>
        ),
      },
      {
        path: "/settings/school",
        element: (
          <S>
            <AdminRoute>
              <SchoolSettingsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/settings/audit-logs",
        element: (
          <S>
            <AdminRoute>
              <AuditLogsPage />
            </AdminRoute>
          </S>
        ),
      },
      {
        path: "/settings/billing",
        element: (
          <S>
            <FinanceRoute>
              <BillingPage />
            </FinanceRoute>
          </S>
        ),
      },
    ],
  },
  {
    path: "/unauthorized",
    element: (
      <S>
        <UnauthorizedPage />
      </S>
    ),
  },
  {
    path: "*",
    element: (
      <S>
        <NotFoundPage />
      </S>
    ),
  },
]);
