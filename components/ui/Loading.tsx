"use client";
import { useUIStore } from "@/store/useUIStore";

export function LoadingOverlay() {
  const loading = useUIStore((s) => s.loading);
  if (!loading) return null;
  return (
    <div
      className="fixed inset-0 z-300 flex flex-col items-center justify-center gap-5"
      style={{
        background:
          "linear-gradient(160deg, rgba(27,50,85,0.9) 0%, rgba(14,30,54,0.9) 100%)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-white/15" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-white spin" />
        <div
          className="w-4 h-4 rounded-full"
          style={{ background: "var(--color-orange)" }}
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="text-white text-sm font-extrabold tracking-wide">
          Krešimir Fit
        </div>
        <div className="text-white/75 text-[12px] font-semibold">
          Učitavam...
        </div>
      </div>
    </div>
  );
}
