"use client";
import { create } from "zustand";
import type { AccessCodeRow } from "@/types/database";
import { updateGoal as apiUpdateGoal } from "@/lib/api/codes";

// Legacy localStorage key from pre-cookie-session days. Read once during
// migration to upgrade existing users to the httpOnly cookie transparently,
// then cleared.
const LEGACY_SAVED_KEY = "kf_saved_code";

type AuthState = {
  user: AccessCodeRow | null;
  hydrated: boolean;
  login: (code: string) => Promise<boolean>;
  autoLogin: () => Promise<void>;
  logout: () => Promise<void>;
  setGoal: (goal: number) => Promise<void>;
};

async function fetchMe(): Promise<AccessCodeRow | null> {
  try {
    const res = await fetch("/api/auth/me", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { user: AccessCodeRow };
    return body.user;
  } catch {
    return null;
  }
}

async function postLogin(code: string): Promise<AccessCodeRow | null> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { user: AccessCodeRow };
    return body.user;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,
  async login(code) {
    const user = await postLogin(code);
    if (!user) return false;
    set({ user });
    // Clear legacy localStorage on successful new-style login.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LEGACY_SAVED_KEY);
      } catch {
        /* ignore */
      }
    }
    return true;
  },
  async autoLogin() {
    // 1) Try existing cookie session.
    let user = await fetchMe();

    // 2) Migration bridge — if no cookie but legacy localStorage code is
    //    present, exchange it for a cookie session silently.
    if (!user && typeof window !== "undefined") {
      let savedCode: string | null = null;
      try {
        savedCode = window.localStorage.getItem(LEGACY_SAVED_KEY);
      } catch {
        /* ignore */
      }
      if (savedCode) {
        user = await postLogin(savedCode);
        try {
          // Either way, drop the legacy key: on success it's no longer
          // needed; on failure it's stale and would loop.
          window.localStorage.removeItem(LEGACY_SAVED_KEY);
        } catch {
          /* ignore */
        }
      }
    }

    set({ user, hydrated: true });
  },
  async logout() {
    // Flip UI state immediately so the redirect/route guard reacts without
    // waiting for the cookie-clear round-trip.
    set({ user: null });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LEGACY_SAVED_KEY);
      } catch {
        /* ignore */
      }
    }
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      /* ignore */
    }
  },
  async setGoal(goal) {
    const u = get().user;
    if (!u) return;
    set({ user: { ...u, goal } });
    await apiUpdateGoal(u.id, goal);
  },
}));
