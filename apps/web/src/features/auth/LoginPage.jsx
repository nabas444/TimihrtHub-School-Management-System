import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuthStore } from "../../store/authStore";
import { useTranslation } from "../../lib/i18n/I18nProvider";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login, loginWithGoogle, isLoading } = useAuthStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? "/dashboard";

  const [form, setForm] = useState({
    email: location.state?.email ?? "",
    password: "",
    schoolSlug: location.state?.schoolSlug ?? "",
  });
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(
      form.email,
      form.password,
      form.schoolSlug || undefined,
    );
    if (result.success) {
      toast.success(t("auth.welcome_toast") || "Welcome back!");
      navigate(from, { replace: true });
    } else {
      toast.error(result.message);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      toast.error("Google authentication failed. No token received.");
      return;
    }
    const result = await loginWithGoogle(credentialResponse.credential);
    if (result.success) {
      toast.success(t("auth.welcome_toast") || "Welcome back!");
      navigate(from, { replace: true });
    } else {
      if (
        result.message &&
        result.message.toLowerCase().includes("admin accounts must sign in")
      ) {
        toast.error("Admin accounts must use the email and password form below.");
      } else {
        toast.error(result.message);
      }
    }
  };

  const handleGoogleError = () => {
    toast.error("Google Sign-In failed or was cancelled");
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">
        {t("auth.welcome_back")}
      </h2>
      <p className="text-sm text-gray-500 mb-6">{t("auth.sign_in_subtitle")}</p>

      {/* Google Sign-In */}
      <div className="mb-4">
        <div className="flex justify-center w-full">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap={false}
            shape="rectangular"
            theme="outline"
            size="large"
            width="320"
            text="signin_with"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-400 font-semibold tracking-wider">
            {t("auth.or") || "Or sign in with email"}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{t("auth.email_label")}</label>
          <input
            className="input"
            type="email"
            placeholder="you@school.edu"
            value={form.email}
            onChange={set("email")}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="label">{t("auth.password_label")}</label>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPwd ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              required
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPwd ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="label">{t("auth.school_label")}</label>
          <input
            className="input"
            type="text"
            placeholder={t("auth.school_placeholder")}
            value={form.schoolSlug}
            onChange={set("schoolSlug")}
          />
        </div>

        <div className="flex items-center justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-primary-600 hover:underline"
          >
            {t("auth.forgot_password")}
          </Link>
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="animate-pulse">{t("auth.signing_in")}</span>
          ) : (
            <>
              <LogIn className="w-4 h-4" /> {t("auth.sign_in_button")}
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t("auth.new_school_prompt")}{" "}
        <Link
          to="/register"
          className="text-primary-600 font-medium hover:underline"
        >
          {t("auth.register_here")}
        </Link>
      </p>
    </div>
  );
}
