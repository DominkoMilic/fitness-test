"use client";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { deleteCode as apiDelete } from "@/lib/api/codes";
import { listUserActivity } from "@/lib/api/userActivity";
import type { ActivityStatus, UserActivityRow } from "@/types/database";
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

const ROW_STYLE: Record<ActivityStatus, { row: string; icon: string }> = {
  active: { row: "", icon: "" },
  yellow: {
    row: "bg-amber-50 border-amber-200 hover:bg-amber-100 active:bg-amber-200",
    icon: "text-amber-600",
  },
  red: {
    row: "bg-rose-50 border-rose-200 hover:bg-rose-100 active:bg-rose-200",
    icon: "text-rose-600",
  },
};

function WarningTriangle({ className = "" }: { className?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.5L1.5 21.5h21L12 2.5zM11 10h2v5h-2v-5zm0 7h2v2h-2v-2z"
      />
    </svg>
  );
}

function FlameIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73S7.32 7.53 7.32 5.47l.03-.36C5.35 7.5 4 10.79 4 14.34a8 8 0 0 0 16 0c0-4.34-2.09-8.21-5.05-10.93l-1.45-2.74z" />
    </svg>
  );
}

export function CodeList({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const [codes, setCodes] = useState<UserActivityRow[] | null>(null);
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
    setCodes(await listUserActivity());
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
        {visibleCodes.map((c) => {
          const style = ROW_STYLE[c.activity_status];
          const showWarning =
            c.activity_status === "yellow" || c.activity_status === "red";
          return (
            <div
              key={c.code}
              onClick={() =>
                router.push(
                  `/admin/users/${encodeURIComponent(c.code)}/dashboard`,
                )
              }
              className={`kf-row flex items-center justify-between gap-2 py-2.5 px-2 -mx-2 rounded-lg border last:mb-0 mb-1 cursor-pointer ${
                style.row || "border-transparent border-b-border"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {showWarning && (
                  <WarningTriangle className={`shrink-0 ${style.icon}`} />
                )}
                <div className="min-w-0">
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
                    {c.inactivity_days != null && c.inactivity_days >= 2 && (
                      <span className={`ml-1 font-semibold ${style.icon}`}>
                        · {c.inactivity_days}d neaktivnosti
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="inline-flex items-center gap-0.5 text-[12px] font-bold"
                  style={{ color: "var(--color-orange)" }}
                  title={`Niz: ${c.current_streak} dan${c.current_streak === 1 ? "" : "a"}`}
                >
                  <FlameIcon />
                  {c.current_streak}
                </span>
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
            </div>
          );
        })}
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
