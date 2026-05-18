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
  onSaveWeight,
  onSaveSteps,
}: Props) {
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
        isToday ? "ring-2 ring-orange/60" : ""
      }`}
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
        />
        <Field
          label="Kalorije"
          unit="kcal"
          value={kcal > 0 ? String(kcal) : "—"}
          readOnly
        />
        <Field
          label="Koraci"
          unit=""
          value={stepsStr}
          onChange={setStepsStr}
          onBlur={commitSteps}
          placeholder="—"
          inputMode="numeric"
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
};

function Field({
  label,
  unit,
  value,
  onChange,
  onBlur,
  placeholder,
  inputMode,
  readOnly = false,
}: FieldProps) {
  return (
    <div className="bg-bg rounded-xl px-2.5 py-2">
      <div
        className="text-[10px] font-bold uppercase tracking-wider mb-1"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </div>
      {readOnly ? (
        <div
          className="text-sm font-bold leading-tight"
          style={{ color: "var(--color-navy)" }}
        >
          {value}
          {unit && value !== "—" && (
            <span
              className="ml-1 text-[10px] font-semibold"
              style={{ color: "var(--color-muted)" }}
            >
              {unit}
            </span>
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
  );
}
