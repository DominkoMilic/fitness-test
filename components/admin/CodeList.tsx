"use client";
import { useEffect, useState, useCallback } from "react";
import { listCodes, deleteCode as apiDelete } from "@/lib/api/codes";
import type { AccessCodeRow } from "@/types/database";
import { useUIStore } from "@/store/useUIStore";

export function CodeList({ refreshKey }: { refreshKey: number }) {
  const [codes, setCodes] = useState<AccessCodeRow[] | null>(null);
  const showToast = useUIStore((s) => s.showToast);

  const refresh = useCallback(async () => {
    setCodes(await listCodes());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const onDelete = async (code: string) => {
    if (!confirm(`Obriši kod ${code}?`)) return;
    await apiDelete(code);
    showToast("Kod obrisan");
    refresh();
  };

  return (
    <div className="kf-card bg-white rounded-2xl border border-border p-5">
      <div
        className="text-sm font-extrabold mb-4"
        style={{ color: "var(--color-navy)" }}
      >
        Aktivni kodovi
      </div>
      {codes === null && (
        <div
          className="text-[13px] py-2"
          style={{ color: "var(--color-muted)" }}
        >
          Učitavam...
        </div>
      )}
      {codes?.length === 0 && (
        <div
          className="text-[13px] py-2"
          style={{ color: "var(--color-muted)" }}
        >
          Nema kodova.
        </div>
      )}
      {codes?.map((c) => (
        <div
          key={c.code}
          className="kf-row flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg border-b border-border last:border-b-0"
        >
          <div>
            <span
              className="bg-indigo-50 rounded px-2 py-1 font-extrabold font-mono text-[13px]"
              style={{ color: "var(--color-navy)" }}
            >
              {c.code}
            </span>
            <div
              className="text-[11px] mt-1"
              style={{ color: "var(--color-muted)" }}
            >
              {c.name} · do {c.exp} · {c.goal} kcal
            </div>
          </div>
          <button
            onClick={() => onDelete(c.code)}
            aria-label="Obriši"
            className="kf-icon-btn text-gray-300 text-lg w-7 h-7 flex items-center justify-center"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
