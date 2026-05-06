"use client";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { listCodes, deleteCode as apiDelete } from "@/lib/api/codes";
import type { AccessCodeRow } from "@/types/database";
import { useUIStore } from "@/store/useUIStore";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";
import { todayISO } from "@/lib/utils/date";

type UserFilter = "active" | "deactivated";

function formatExpireDateHR(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${Number(day)}.${Number(month)}.${year}.`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;

  const rx = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(rx);

  return parts.map((part, idx) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark
        key={`${part}-${idx}`}
        className="px-0.5 rounded bg-orange/20"
        style={{ color: "var(--color-navy)" }}
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    ),
  );
}

export function CodeList({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const [codes, setCodes] = useState<AccessCodeRow[] | null>(null);
  const [filter, setFilter] = useState<UserFilter>("active");
  const [query, setQuery] = useState("");
  const [pendingDeleteCode, setPendingDeleteCode] = useState<string | null>(
    null,
  );
  const showToast = useUIStore((s) => s.showToast);
  const today = todayISO();

  const activeCodes = (codes ?? []).filter((c) => c.exp >= today);
  const deactivatedCodes = (codes ?? []).filter((c) => c.exp < today);
  const filteredCodes = filter === "active" ? activeCodes : deactivatedCodes;
  const q = query.trim().toLowerCase();
  const visibleCodes = !q
    ? filteredCodes
    : filteredCodes.filter((c) => c.code.toLowerCase().includes(q));

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
          Korisnici
        </div>
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          <button
            onClick={() => setFilter("active")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border-[1.5px] ${
              filter === "active"
                ? "border-navy bg-navy text-white"
                : "border-border bg-white"
            }`}
            style={{
              color: filter === "active" ? "#fff" : "var(--color-muted)",
            }}
          >
            Aktivni ({activeCodes.length})
          </button>
          <button
            onClick={() => setFilter("deactivated")}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border-[1.5px] ${
              filter === "deactivated"
                ? "border-navy bg-navy text-white"
                : "border-border bg-white"
            }`}
            style={{
              color: filter === "deactivated" ? "#fff" : "var(--color-muted)",
            }}
          >
            Deaktivirani ({deactivatedCodes.length})
          </button>
        </div>
        <div className="mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Pretraži korisnike po kodu"
            className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold outline-none border-[1.5px] border-border focus:border-orange text-navy"
          />
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
        {codes !== null && filteredCodes.length === 0 && (
          <div
            className="text-[13px] py-2"
            style={{ color: "var(--color-muted)" }}
          >
            {filter === "active"
              ? "Nema aktivnih korisnika."
              : "Nema deaktiviranih korisnika."}
          </div>
        )}
        {codes !== null &&
          filteredCodes.length > 0 &&
          visibleCodes.length === 0 && (
            <div
              className="text-[13px] py-2"
              style={{ color: "var(--color-muted)" }}
            >
              Nema rezultata za "{query}".
            </div>
          )}
        {visibleCodes.map((c) => (
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
                {highlightMatch(c.code, query)}
              </span>
              <div
                className="text-[11px] mt-1"
                style={{ color: "var(--color-muted)" }}
              >
                {c.name} · do {formatExpireDateHR(c.exp)} · {c.goal} kcal
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
