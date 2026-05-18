"use client";
import { useRouter } from "next/navigation";
import type { UserActivityRow } from "@/types/database";
import { FlameIcon, WarningTriangle } from "./codeListIcons";
import {
  ROW_STYLE,
  SCROLL_KEY,
  formatExpireDateHR,
} from "./codeListUtils";
import { highlightMatch } from "@/lib/utils/highlight";

type Props = {
  row: UserActivityRow;
  query: string;
  onDelete: (code: string) => void;
};

export function CodeRow({ row, query, onDelete }: Props) {
  const router = useRouter();
  const style = ROW_STYLE[row.activity_status];
  const showWarning =
    row.activity_status === "yellow" || row.activity_status === "red";

  return (
    <div
      onClick={() => {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        }
        router.push(`/admin/users/${encodeURIComponent(row.code)}/dashboard`);
      }}
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
            {row.code}
          </span>
          <div
            className="text-[11px] mt-1"
            style={{ color: "var(--color-muted)" }}
          >
            {highlightMatch(row.name, query)} · do {formatExpireDateHR(row.exp)} · {row.goal} kcal
            {row.inactivity_days != null && row.inactivity_days >= 2 && (
              <span className={`ml-1 font-semibold ${style.icon}`}>
                · {row.inactivity_days}d neaktivnosti
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span
          className="inline-flex items-center gap-0.5 text-[12px] font-bold"
          style={{ color: "var(--color-orange)" }}
          title={`Niz: ${row.current_streak} dan${row.current_streak === 1 ? "" : "a"}`}
        >
          <FlameIcon />
          {row.current_streak}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(row.code);
          }}
          aria-label="Obriši"
          className="kf-icon-btn text-gray-300 text-lg w-7 h-7 flex items-center justify-center"
        >
          ×
        </button>
      </div>
    </div>
  );
}
