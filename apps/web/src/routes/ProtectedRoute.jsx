import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

// Role-specific route guards
export const AdminRoute = ({ children }) => (
  <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}>{children}</ProtectedRoute>
);
export const TeacherRoute = ({ children }) => (
  <ProtectedRoute roles={["TEACHER", "ADMIN", "SUPER_ADMIN"]}>
    {children}
  </ProtectedRoute>
);
export const StudentRoute = ({ children }) => (
  <ProtectedRoute roles={["STUDENT"]}>{children}</ProtectedRoute>
);
export const ParentRoute = ({ children }) => (
  <ProtectedRoute roles={["PARENT"]}>{children}</ProtectedRoute>
);
export const FinanceRoute = ({ children }) => (
  <ProtectedRoute roles={["FINANCE", "ADMIN", "SUPER_ADMIN"]}>
    {children}
  </ProtectedRoute>
);
export const StaffRoute = ({ children }) => (
  <ProtectedRoute roles={["TEACHER", "ADMIN", "SUPER_ADMIN"]}>
    {children}
  </ProtectedRoute>
);
