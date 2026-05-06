"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { listCodes, deleteCode as apiDelete } from "@/lib/api/codes";
import type { AccessCodeRow } from "@/types/database";
import { useUIStore } from "@/store/useUIStore";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";

export function CodeList({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const [codes, setCodes] = useState<AccessCodeRow[] | null>(null);
  const [pendingDeleteCode, setPendingDeleteCode] = useState<string | null>(
    null,
  );
  const showToast = useUIStore((s) => s.showToast);

  const refresh = useCallback(async () => {
    setCodes(await listCodes());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const onDelete = async () => {
    if (!pendingDeleteCode) return;
    await apiDelete(pendingDeleteCode);
    setPendingDeleteCode(null);
    showToast("Kod obrisan");
    refresh();
  };

  return (
    <>
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
            onClick={() =>
              router.push(
                `/admin/users/${encodeURIComponent(c.code)}/dashboard`,
              )
            }
            className="kf-row flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg border-b border-border last:border-b-0 cursor-pointer"
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
              onClick={(e) => {
                e.stopPropagation();
                setPendingDeleteCode(c.code);
              }}
              aria-label="Obriši"
              className="kf-icon-btn text-gray-300 text-lg w-7 h-7 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <ConfirmPopup
        open={pendingDeleteCode !== null}
        question={
          pendingDeleteCode
            ? `Jeste li sigurni da želite obrisati kod ${pendingDeleteCode}?`
            : ""
        }
        onClose={() => setPendingDeleteCode(null)}
        button1={{
          text: "Ne",
          variant: "cancel",
          onClick: () => setPendingDeleteCode(null),
        }}
        button2={{
          text: "Da",
          variant: "orange",
          onClick: onDelete,
        }}
      />
    </>
  );
}
