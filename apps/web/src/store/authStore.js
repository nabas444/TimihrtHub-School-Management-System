import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { queryClient } from "../lib/queryClient";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password, schoolSlug) => {
        set({ isLoading: true });
        try {
          const res = await api.post("/auth/login", {
            email,
            password,
            schoolSlug,
          });
          const { accessToken, refreshToken, user } = res.data.data;
          localStorage.setItem("accessToken", accessToken);
          if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
          connectSocket(accessToken);
          set({ user, accessToken, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return {
            success: false,
            message: err.response?.data?.message ?? "Login failed",
          };
        }
      },

      loginWithGoogle: async (credential) => {
        set({ isLoading: true });
        try {
          const res = await api.post("/auth/google", { credential });
          const { accessToken, refreshToken, user } = res.data.data;
          localStorage.setItem("accessToken", accessToken);
          if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
          connectSocket(accessToken);
          set({ user, accessToken, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return {
            success: false,
            message: err.response?.data?.message ?? "Google login failed",
          };
        }
      },

      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch {}
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        disconnectSocket();
        queryClient.clear();
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      updateUser: (updates) =>
        set((state) => ({ user: { ...state.user, ...updates } })),

      refreshUser: async () => {
        try {
          const res = await api.get("/users/me");
          set({ user: res.data.data });
        } catch {}
      },

      // Role helpers
      isAdmin: () => ["ADMIN", "SUPER_ADMIN"].includes(get().user?.role),
      isTeacher: () => get().user?.role === "TEACHER",
      isStudent: () => get().user?.role === "STUDENT",
      isParent: () => get().user?.role === "PARENT",
      isFinance: () => get().user?.role === "FINANCE",
    }),
    {
      name: "timhirthub-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
