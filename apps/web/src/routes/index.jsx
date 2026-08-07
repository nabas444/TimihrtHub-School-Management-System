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
const AssignmentsPage = lazy(
  () => import("../features/academics/AssignmentsPage"),
);
const AssignmentDetailPage = lazy(
  () => import("../features/academics/AssignmentDetailPage"),
);
const ExamsPage = lazy(() => import("../features/academics/ExamsPage"));
const GradesPage = lazy(() => import("../features/academics/GradesPage"));
const SubjectsPage = lazy(() => import("../features/academics/SubjectsPage"));
const ClassesPage = lazy(() => import("../features/academics/ClassesPage"));
const AttendancePage = lazy(
  () => import("../features/attendance/AttendancePage"),
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
const FilesPage = lazy(() => import("../features/files/FilesPage"));
const StaffPage = lazy(() => import("../features/staff/StaffPage"));
const LeavePage = lazy(() => import("../features/staff/LeavePage"));
const AIInsightsPage = lazy(() => import("../features/ai/AIInsightsPage"));
const ProfilePage = lazy(() => import("../features/settings/ProfilePage"));
const SchoolSettingsPage = lazy(
  () => import("../features/settings/SchoolSettingsPage"),
);
const BillingPage = lazy(() => import("../features/billing/BillingPage"));
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);
const UnauthorizedPage = lazy(() =>
  import("../pages/NotFoundPage").then((m) => ({
    default: m.UnauthorizedPage,
  })),
);

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
        element: (
          <S>
            <GradesPage />
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
        element: (
          <S>
            <AttendancePage />
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
        path: "/fees",
        element: (
          <S>
            <FeesPage />
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
        path: "/files",
        element: (
          <S>
            <FilesPage />
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
