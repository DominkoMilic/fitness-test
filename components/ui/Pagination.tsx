"use client";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
};

const BTN_BASE =
  "w-8 h-8 rounded-full flex items-center justify-center border-[1.5px] text-[12px] font-bold transition-colors disabled:opacity-35 disabled:cursor-not-allowed border-border bg-white hover:border-orange/60 hover:text-orange";

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: Props) {
  const isFirst = page <= 1;
  const isLast = page >= totalPages;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
      <div
        className="text-[11px] font-semibold"
        style={{ color: "var(--color-muted)" }}
      >
        {start}–{end} od {total}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(1)}
          disabled={isFirst}
          aria-label="Prva stranica"
          className={BTN_BASE}
          style={{ color: "var(--color-navy)" }}
        >
          «
        </button>
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={isFirst}
          aria-label="Prethodna stranica"
          className={BTN_BASE}
          style={{ color: "var(--color-navy)" }}
        >
          ‹
        </button>
        <span
          className="px-2 text-[11px] font-bold tabular-nums"
          style={{ color: "var(--color-navy)" }}
        >
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={isLast}
          aria-label="Sljedeća stranica"
          className={BTN_BASE}
          style={{ color: "var(--color-navy)" }}
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => onChange(totalPages)}
          disabled={isLast}
          aria-label="Zadnja stranica"
          className={BTN_BASE}
          style={{ color: "var(--color-navy)" }}
        >
          »
        </button>
      </div>
    </div>
  );
}
