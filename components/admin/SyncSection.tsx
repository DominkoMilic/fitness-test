"use client";
import { useEffect, useState } from "react";
import { useUIStore } from "@/store/useUIStore";
import { fetchSheetSyncPlan } from "@/lib/api/sheetSync";

function formatTs(ts: string): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SyncSection() {
  const openModal = useUIStore((s) => s.openModal);
  const setLoading = useUIStore((s) => s.setLoading);
  const showToast = useUIStore((s) => s.showToast);
  const [last, setLast] = useState<string>("—");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ts = localStorage.getItem("kf_last_sync");
    setLast(ts ? formatTs(ts) : "—");
  }, []);

  const onPreview = async () => {
    setLoading(true);
    try {
      const plan = await fetchSheetSyncPlan();
      openModal("syncPreview", { plan });
    } catch (e) {
      showToast(`Greška: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kf-card bg-white rounded-2xl border border-border p-5 mb-4">
      <div
        className="text-sm font-extrabold mb-4"
        style={{ color: "var(--color-navy)" }}
      >
        🔄 Sync namirnice iz Sheeta
      </div>
      <div
        className="text-[13px] mb-2.5"
        style={{ color: "var(--color-muted)" }}
      >
        Zadnji sync: {last}
      </div>
      <button
        onClick={onPreview}
        className="w-full py-3 rounded-xl bg-linear-to-br from-orange to-orange-dark text-white font-bold text-sm"
      >
        Pokreni sync
      </button>
    </div>
  );
}
