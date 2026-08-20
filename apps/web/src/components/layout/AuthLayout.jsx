import { Link, Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { GraduationCap } from "lucide-react";
import logoImg from "../../assets/logo.png";

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <img
              src={logoImg}
              alt="TimhirtHub"
              className="h-20 sm:h-24 w-auto mx-auto mb-3 object-contain"
            />
            <p className="text-gray-500 text-sm mt-1">
              School Management Platform
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
