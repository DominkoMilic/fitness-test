"use client";
import { addDays, formatDayLongHR } from "@/lib/utils/week";

type Props = {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
};

export function WeekNav({ weekStart, onPrev, onNext, onToday }: Props) {
  const weekEnd = addDays(weekStart, 6);
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const sameMonth = sameYear && weekStart.getMonth() === weekEnd.getMonth();

  let label: string;
  if (sameMonth) {
    label = `${weekStart.getDate()}. – ${formatDayLongHR(weekEnd)}`;
  } else if (sameYear) {
    label = `${weekStart.getDate()}.${weekStart.getMonth() + 1}. – ${formatDayLongHR(weekEnd)}`;
  } else {
    label = `${formatDayLongHR(weekStart)} – ${formatDayLongHR(weekEnd)}`;
  }

  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-2 gap-2">
      <button
        onClick={onPrev}
        aria-label="Prethodni tjedan"
        className="kf-icon-btn w-9 h-9 inline-flex items-center justify-center rounded-full border border-border bg-white"
        style={{ color: "var(--color-navy)" }}
      >
        <svg
          width={16}
          height={16}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="flex flex-col items-center min-w-0">
        <div
          className="text-[15px] font-extrabold truncate"
          style={{ color: "var(--color-navy)" }}
        >
          {label}
        </div>
        <button
          onClick={onToday}
          className="text-[11px] font-bold underline mt-0.5"
          style={{ color: "var(--color-orange)" }}
        >
          Današnji tjedan
        </button>
      </div>
      <button
        onClick={onNext}
        aria-label="Sljedeći tjedan"
        className="kf-icon-btn w-9 h-9 inline-flex items-center justify-center rounded-full border border-border bg-white"
        style={{ color: "var(--color-navy)" }}
      >
        <svg
          width={16}
          height={16}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
