import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { Avatar } from "../../components/ui/index";
import toast from "react-hot-toast";
import { Save, Lock, MessageSquare, Upload } from "lucide-react";

export default function ProfilePage() {
  const { user, updateUser, isParent } = useAuthStore();
  const qc = useQueryClient();
  const avatarRef = useRef(null);
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
  });
  const [smsOptIn, setSmsOptIn] = useState(user?.smsOptIn ?? false);
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (d) => api.patch("/users/me", d),
    onSuccess: (res) => {
      updateUser(res.data.data);
      toast.success("Profile updated");
    },
  });

  const smsMutation = useMutation({
    mutationFn: (next) => api.patch("/users/me", { smsOptIn: next }),
    onSuccess: (res) => {
      updateUser(res.data.data);
      toast.success(
        res.data.data.smsOptIn ? "SMS alerts enabled" : "SMS alerts disabled",
      );
    },
    onError: () => setSmsOptIn((v) => !v), // revert the optimistic toggle on failure
  });

  const handleSmsToggle = () => {
    const next = !smsOptIn;
    setSmsOptIn(next);
    smsMutation.mutate(next);
  };

  const avatarMutation = useMutation({
    mutationFn: (avatarUrl) => api.patch("/users/me", { avatar: avatarUrl }),
    onSuccess: (res) => {
      updateUser(res.data.data);
      toast.success(
        res.data.data.avatar
          ? "Profile photo updated"
          : "Profile photo removed",
      );
    },
    onError: (err) => {
      toast.error(err.response?.data?.message ?? "Photo update failed");
    },
  });

  const pwdMutation = useMutation({
    mutationFn: (d) => api.post("/auth/password/change", d),
    onSuccess: () => {
      toast.success("Password changed");
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setPwd = (k) => (e) =>
    setPwdForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      e.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "PROFILE_PHOTO");
      const uploadRes = await api.post("/files/upload", formData);
      const avatarUrl = uploadRes.data.data.url;
      await avatarMutation.mutateAsync(avatarUrl);
      qc.invalidateQueries({ queryKey: ["users", "me"] });
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Upload failed");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleChangePwd = () => {
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    pwdMutation.mutate({
      currentPassword: pwdForm.currentPassword,
      newPassword: pwdForm.newPassword,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Profile Settings</h1>
        <p className="page-subtitle">Manage your personal information</p>
      </div>

      {/* Avatar + basic info */}
      <div className="card p-6">
        <div className="grid gap-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                name={`${user?.firstName} ${user?.lastName}`}
                src={user?.avatar}
                size="xl"
              />
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <p className="text-xs text-primary-600 font-medium capitalize mt-0.5">
                  {user?.role?.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 gap-2">
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                className="btn-secondary btn-sm"
                onClick={() => avatarRef.current?.click()}
                disabled={uploadingAvatar || avatarMutation.isLoading}
              >
                <Upload className="w-4 h-4" />{" "}
                {uploadingAvatar || avatarMutation.isLoading
                  ? "Uploading…"
                  : "Upload Photo"}
              </button>
              {user?.avatar && (
                <button
                  className="btn-outline btn-sm text-red-600 border-red-200 hover:border-red-300"
                  onClick={() => avatarMutation.mutate(null)}
                  disabled={avatarMutation.isLoading}
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input
                className="input"
                value={form.firstName}
                onChange={set("firstName")}
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                className="input"
                value={form.lastName}
                onChange={set("lastName")}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Phone Number</label>
              <input
                className="input"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+251..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <input
                className="input"
                value={form.address}
                onChange={set("address")}
              />
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending}
          >
            <Save className="w-4 h-4" />{" "}
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Phase 5: SMS alerts — parent accounts only, off by default */}
      {isParent() && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> SMS Alerts
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Get attendance and fee-due alerts by SMS as well as in-app, in case
            you're not using the app that day.
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={smsOptIn}
              onChange={handleSmsToggle}
              disabled={smsMutation.isPending}
            />
            <span className="text-sm text-gray-700">
              {smsOptIn ? "SMS alerts are on" : "SMS alerts are off"}
            </span>
          </label>
          {!user?.phone && smsOptIn && (
            <p className="text-xs text-amber-600 mt-2">
              Add a phone number above so alerts have somewhere to go.
            </p>
          )}
        </div>
      )}

      {/* Change password */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Change Password
        </h3>
        <div className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              className="input"
              type="password"
              value={pwdForm.currentPassword}
              onChange={setPwd("currentPassword")}
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              className="input"
              type="password"
              value={pwdForm.newPassword}
              onChange={setPwd("newPassword")}
              minLength={8}
            />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              className="input"
              type="password"
              value={pwdForm.confirmPassword}
              onChange={setPwd("confirmPassword")}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleChangePwd}
            disabled={
              pwdMutation.isPending ||
              !pwdForm.currentPassword ||
              !pwdForm.newPassword
            }
          >
            <Lock className="w-4 h-4" />{" "}
            {pwdMutation.isPending ? "Saving…" : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
