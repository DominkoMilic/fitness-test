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

  if (!hydrated || !user) return null;

  return (
    <>
      <Header />
      <main style={{ paddingBottom: "calc(120px + env(safe-area-inset-bottom))" }}>{children}</main>
      <BottomNav />
      <GoalModal />
    </>
  );
}
