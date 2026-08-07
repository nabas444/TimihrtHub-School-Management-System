import { Link, Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { GraduationCap } from "lucide-react";

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">TimhirtHub</h1>
            <p className="text-gray-500 text-sm mt-1">
              TimhirtHub — School Management Platform
            </p>
          </Link>
        </div>

        {/* Auth card */}
        <div className="card shadow-xl border-0">
          <div className="card-body">
            <Outlet />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} TimhirtHub. All rights reserved.
        </p>
      </div>
    </div>
  );
}
