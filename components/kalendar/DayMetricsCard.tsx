"use client";
import { useEffect, useState } from "react";
import { WEEKDAY_SHORT_HR, formatDayShortHR } from "@/lib/utils/week";

type Props = {
  date: Date;
  iso: string;
  weightKg: number | null;
  steps: number | null;
  kcal: number;
  isToday: boolean;
  saving: boolean;
  /** Future day — visually dimmed + non-editable. */
  disabled?: boolean;
  /** Non-editable but rendered in full color (e.g. admin view). */
  readOnly?: boolean;
  onSaveWeight: (value: number | null) => Promise<void> | void;
  onSaveSteps: (value: number | null) => Promise<void> | void;
};

function fmtNumber(n: number | null): string {
  if (n == null) return "";
  return String(n);
}

export function DayMetricsCard({
  date,
  weightKg,
  steps,
  kcal,
  isToday,
  saving,
  disabled = false,
  readOnly = false,
  onSaveWeight,
  onSaveSteps,
}: Props) {
  const locked = disabled || readOnly;
  const [weightStr, setWeightStr] = useState(fmtNumber(weightKg));
  const [stepsStr, setStepsStr] = useState(fmtNumber(steps));

  useEffect(() => {
    setWeightStr(fmtNumber(weightKg));
  }, [weightKg]);
  useEffect(() => {
    setStepsStr(fmtNumber(steps));
  }, [steps]);

  const dayIdx = (date.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
  const dayLabel = WEEKDAY_SHORT_HR[dayIdx];

  const commitWeight = () => {
    const trimmed = weightStr.trim().replace(",", ".");
    if (trimmed === "") {
      if (weightKg !== null) void onSaveWeight(null);
      return;
    }
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n) || n < 0) {
      setWeightStr(fmtNumber(weightKg));
      return;
    }
    const rounded = Math.round(n * 10) / 10;
    if (rounded === weightKg) return;
    void onSaveWeight(rounded);
  };

  const commitSteps = () => {
    const trimmed = stepsStr.trim();
    if (trimmed === "") {
      if (steps !== null) void onSaveSteps(null);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 0) {
      setStepsStr(fmtNumber(steps));
      return;
    }
    if (n === steps) return;
    void onSaveSteps(n);
  };

  return (
    <div
      className={`kf-card mx-3 mb-2.5 bg-white rounded-2xl shadow-sm overflow-hidden ${
        disabled ? "opacity-50" : ""
      }`}
      style={
        isToday
          ? {
              // Inline box-shadow keeps the orange outline regardless of
              // hover/focus styles applied by the global `kf-card` rules.
              boxShadow:
                "inset 0 0 0 2px var(--color-orange), 0 1px 2px rgba(0,0,0,0.04)",
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-extrabold"
            style={{ color: "var(--color-navy)" }}
          >
            {dayLabel}
          </span>
          <span
            className="text-[12px] font-semibold"
            style={{ color: "var(--color-muted)" }}
          >
            {formatDayShortHR(date)}
          </span>
          {isToday && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: "rgba(255,138,0,0.12)",
                color: "var(--color-orange)",
              }}
            >
              Danas
            </span>
          )}
        </div>
        {saving && (
          <span
            className="text-[10px] font-semibold"
            style={{ color: "var(--color-muted)" }}
          >
            Spremam…
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <Field
          label="Težina"
          unit="kg"
          value={weightStr}
          onChange={setWeightStr}
          onBlur={commitWeight}
          placeholder="—"
          inputMode="decimal"
          readOnly={locked}
        />
        <Field
          label="Kalorije"
          unit="kcal"
          value={kcal > 0 ? String(kcal) : "—"}
          readOnly
          auto
          hint="iz dnevnika"
        />
        <Field
          label="Koraci"
          unit=""
          value={stepsStr}
          onChange={setStepsStr}
          onBlur={commitSteps}
          placeholder="—"
          inputMode="numeric"
          readOnly={locked}
        />
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  unit: string;
  value: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
  readOnly?: boolean;
  /** Show lock icon + tooltip — for fields user can't edit (auto-computed). */
  auto?: boolean;
  /** Tiny helper line under the value, e.g. "iz dnevnika". */
  hint?: string;
};

function LockIcon() {
  return (
    <svg
      width={9}
      height={9}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x={5} y={11} width={14} height={10} rx={2} />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
  onBlur,
  placeholder,
  inputMode,
  readOnly = false,
  auto = false,
  hint,
}: FieldProps) {
  const tooltip = auto
    ? hint
      ? `Automatski (${hint})`
      : "Automatski"
    : undefined;
  return (
    <div
      className="bg-bg rounded-xl px-2.5 py-2 flex flex-col h-full"
      title={tooltip}
      style={auto ? { cursor: "help" } : undefined}
    >
      <div
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1"
        style={{ color: "var(--color-muted)" }}
      >
        <span>{label}</span>
        {auto && (
          <span
            className="inline-flex items-center"
            style={{ color: "var(--color-muted)" }}
            aria-label="Automatski"
          >
            <LockIcon />
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center">
        {readOnly ? (
          <div
            className="text-sm font-bold leading-tight"
            style={{ color: "var(--color-navy)" }}
          >
            {value === "" ? "—" : value}
            {unit && value !== "—" && value !== "" && (
              <span
                className="ml-1 text-[10px] font-semibold"
                style={{ color: "var(--color-muted)" }}
              >
                {unit}
              </span>
            )}
            {hint && (
              <div
                className="text-[9.5px] font-semibold mt-0.5 italic"
                style={{ color: "var(--color-muted)" }}
              >
                {hint}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode={inputMode}
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange?.(e.target.value)}
              onBlur={onBlur}
              onFocus={(e) => {
                const el = e.currentTarget;
                setTimeout(() => el.select(), 0);
              }}
              className="w-full bg-transparent text-sm font-bold outline-none"
              style={{ color: "var(--color-navy)" }}
            />
            {unit && (
              <span
                className="text-[10px] font-semibold shrink-0"
                style={{ color: "var(--color-muted)" }}
              >
                {unit}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
