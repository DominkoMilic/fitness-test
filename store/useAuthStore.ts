"use client";
import { create } from "zustand";
import type { AccessCodeRow } from "@/types/database";
import {
  loginWithCode as apiLogin,
  updateGoal as apiUpdateGoal,
} from "@/lib/api/codes";

const SAVED_KEY = "kf_saved_code";

type AuthState = {
  user: AccessCodeRow | null;
  hydrated: boolean;
  login: (code: string) => Promise<boolean>;
  autoLogin: () => Promise<void>;
  logout: () => void;
  setGoal: (goal: number) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,
  async login(code) {
    const user = await apiLogin(code);
    if (!user) return false;
    if (typeof window !== "undefined") localStorage.setItem(SAVED_KEY, code);
    set({ user });
    return true;
  },
  async autoLogin() {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(SAVED_KEY);
    if (saved) {
      const user = await apiLogin(saved);
      if (user) set({ user });
    }
    set({ hydrated: true });
  },
  logout() {
    if (typeof window !== "undefined") localStorage.removeItem(SAVED_KEY);
    set({ user: null });
  },
  async setGoal(goal) {
    const u = get().user;
    if (!u) return;
    set({ user: { ...u, goal } });
    await apiUpdateGoal(u.id, goal);
  },
}));
