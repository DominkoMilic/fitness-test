"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuthStore } from "@/store/useAuthStore";
import { GoalModal } from "@/components/modals/GoalModal";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const autoLogin = useAuthStore((s) => s.autoLogin);

  useEffect(() => { if (!hydrated) autoLogin(); }, [hydrated, autoLogin]);
  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  // Re-validate the cookie session whenever the tab regains focus/visibility,
  // so an admin-cancelled or expired code logs the user out without a manual
  // refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => {
      if (document.visibilityState === "visible") autoLogin();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [autoLogin]);

  if (!hydrated || !user) return null;

  return (
    <>
      <Header />
      <main style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}>{children}</main>
      <BottomNav />
      <GoalModal />
    </>
  );
}
