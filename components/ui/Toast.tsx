"use client";
import { useUIStore } from "@/store/useUIStore";

export function Toast() {
  const toast = useUIStore((s) => s.toast);
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-3xl text-[13px] font-semibold shadow-lg whitespace-nowrap text-white pointer-events-none transition-opacity duration-200`}
      style={{
        background: "var(--color-navy)",
        bottom: "calc(90px + env(safe-area-inset-bottom))",
        opacity: toast ? 1 : 0,
      }}
    >
      {toast}
    </div>
  );
}
