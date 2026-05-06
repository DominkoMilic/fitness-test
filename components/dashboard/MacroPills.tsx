"use client";
import type { DailyTotals } from "@/types/app";

export function MacroPills({ totals }: { totals: DailyTotals }) {
  return (
    <div className="flex gap-2 w-full">
      <Pill name="Proteini" val={totals.p} />
      <Pill name="Ugljikohidrati" val={totals.u} />
      <Pill name="Masti" val={totals.m} />
    </div>
  );
}

function Pill({ name, val }: { name: string; val: number }) {
  return (
    <div className="flex-1 rounded-xl px-2 py-2.5 text-center border border-white/10 bg-white/10">
      <div className="text-white text-[15px] font-extrabold">{Math.round(val)}g</div>
      <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{name}</div>
    </div>
  );
}
