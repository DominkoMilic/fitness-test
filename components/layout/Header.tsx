"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { useDayStore } from "@/store/useDayStore";
import { dayLabels } from "@/lib/utils/date";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";
import { PrivacyFooter } from "@/components/legal/PrivacyFooter";

export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const openModal = useUIStore((s) => s.openModal);
  const offset = useDayStore((s) => s.offset);
  const { headerDate } = dayLabels(offset);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onLogoutConfirm = () => {
    setConfirmOpen(false);
    logout();
  };

  return (
    <>
      <header
        className="sticky top-0 z-10 px-5 pt-4 pb-1 shadow-md"
        style={{
          background: "linear-gradient(135deg,#1b3255 0%,#162844 100%)",
          paddingTop: "max(1rem, env(safe-area-inset-top))",
        }}
      >
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            aria-label="Otvori Danas"
            className="flex items-center gap-2.5 rounded-lg -mx-1 px-1 py-0.5 hover:bg-white/5 active:bg-white/10"
          >
            <div className="w-10 h-10 rounded-md overflow-hidden bg-white/10 flex items-center justify-center">
              <Image
                src="/icon-512.png"
                alt="Krešimir Fit"
                width={42}
                height={42}
                className="object-contain"
              />
            </div>
            <div>
              <div className="text-white text-[15px] font-extrabold">
                Krešimir Fit{" "}
                <span className="text-[10px] opacity-50 font-normal">v1.0</span>
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {headerDate}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openModal("goal")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-white text-xs font-bold border border-white/20 bg-white/10"
            >
              <svg
                width={12}
                height={12}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle cx={12} cy={12} r={10} />
                <path d="M12 8v4l3 3" />
              </svg>
              {user?.goal ?? 1500} kcal
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              className="px-2.5 py-1 rounded-lg text-[11px] border border-white/10 bg-white/10"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Odjava
            </button>
          </div>
        </div>
        <PrivacyFooter
          className="py-0! mt-1"
          style={{ color: "rgba(255,255,255,0.65)" }}
          showSettings
        />
      </header>
      <ConfirmPopup
        open={confirmOpen}
        question="Jeste li sigurni da se želite odjaviti?"
        onClose={() => setConfirmOpen(false)}
        button1={{
          text: "Ne",
          variant: "cancel",
          onClick: () => setConfirmOpen(false),
        }}
        button2={{
          text: "Da",
          variant: "orange",
          onClick: onLogoutConfirm,
        }}
      />
    </>
  );
}
