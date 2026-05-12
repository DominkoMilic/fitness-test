"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useDayStore } from "@/store/useDayStore";
import { dateForOffset } from "@/lib/utils/date";
import {
  effectiveGrams,
  formatExtraUnitAmount,
  getPieceInfo,
  isExtraUnit,
  macroForGrams,
  type AmountUnit,
} from "@/lib/utils/macros";
import {
  EXTRA_UNITS_ORDERED,
  EXTRA_UNIT_FORMS,
  EXTRA_UNIT_G,
} from "@/lib/constants/extraUnits";
import { croatianPlural } from "@/lib/utils/croatianPlural";
import { MEAL_NAMES, MEAL_OPTIONS } from "@/lib/constants/meals";
import { insertLog } from "@/lib/api/foodLogs";
import { pushSearchHistory } from "@/lib/api/searchHistory";
import type { FoodEntry } from "@/types/app";
import type { MealKey } from "@/types/database";

type Payload = {
  food: FoodEntry;
  defaultMeal?: MealKey;
  defaultGrams?: number;
  defaultPieces?: number | null;
};

function defaultQtyForUnit(unit: AmountUnit): number {
  if (unit === "g") return 100;
  return 1;
}

function qtyLabelForUnit(unit: AmountUnit, qty: number): string {
  if (unit === "g") return "Količina (g)";
  if (unit === "kom") return "Broj komada";
  const f = EXTRA_UNIT_FORMS[unit];
  // Header reads "Broj <gen-plural>". For 0/empty input the generic plural
  // form reads naturally.
  const noun = croatianPlural(qty || 0, f.singular, f.paucal, f.plural);
  return `Broj · ${noun}`;
}

export function AddFoodModal({ onAdded }: { onAdded?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const offset = useDayStore((s) => s.offset);

  const [unit, setUnit] = useState<AmountUnit>("g");
  const [qty, setQty] = useState<number>(100);
  const [meal, setMeal] = useState<MealKey>("dorucak");
  const [lastPayload, setLastPayload] = useState<Payload | null>(null);

  if (modal === "addFood" && payload && lastPayload !== payload) {
    setLastPayload(payload);
    const initUnit: AmountUnit =
      payload.defaultPieces != null && payload.defaultPieces > 0 ? "kom" : "g";
    const initQty =
      initUnit === "kom"
        ? Number(payload.defaultPieces)
        : (payload.defaultGrams ?? 100);
    setUnit(initUnit);
    setQty(initQty);
    setMeal(payload.defaultMeal ?? "dorucak");
  } else if (modal !== "addFood" && lastPayload) {
    setLastPayload(null);
  }

  if (modal !== "addFood" || !payload) return null;
  const food = payload.food;
  const piece = getPieceInfo(food);
  const showExtras = Boolean(food.has_extra_units);
  const grams = effectiveGrams(qty || 0, unit, food, null);
  const macros = macroForGrams(food, grams);

  // Build available unit list dynamically.
  const units: AmountUnit[] = ["g"];
  if (piece) units.push("kom");
  if (showExtras) units.push(...EXTRA_UNITS_ORDERED);

  const onUnitChange = (u: AmountUnit) => {
    setUnit(u);
    setQty(defaultQtyForUnit(u));
  };

  const onConfirm = async () => {
    if (!user) return;
    if (!qty || qty <= 0 || grams <= 0) {
      showToast("Količina mora biti veća od 0");
      return;
    }
    closeModal();
    showToast(`${food.name} dodano u: ${MEAL_NAMES[meal]}`);
    const finalGrams = Math.round(grams * 10) / 10;
    const finalPieces = unit === "kom" ? qty : null;
    await insertLog({
      user_id: user.id,
      date: dateForOffset(offset),
      meal,
      food_name: food.name,
      grams: finalGrams,
      kcal: macros.kcal,
      p: macros.p,
      u: macros.u,
      m: macros.m,
      pieces: finalPieces,
    });
    const numericId = Number(food.id);
    if (Number.isFinite(numericId)) {
      pushSearchHistory(user.id, numericId, finalGrams, finalPieces).catch(
        () => {},
      );
    }
    onAdded?.();
  };

  const unitButtonLabel = (u: AmountUnit): string => {
    if (u === "g") return "Grami (g)";
    if (u === "kom") return "Komadi (kom)";
    const g = EXTRA_UNIT_G[u];
    const f = EXTRA_UNIT_FORMS[u];
    return `${f.singular[0].toUpperCase()}${f.singular.slice(1)} (${g}g)`;
  };

  return (
    <Modal open onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        {food.name}
      </div>
      <div className="text-[13px] mb-5" style={{ color: "var(--color-muted)" }}>
        100g = {food.kcal} kcal
      </div>
      {units.length > 1 && (
        <div className="grid gap-1.5 mb-4 bg-bg rounded-xl p-1"
          style={{
            gridTemplateColumns: `repeat(${Math.min(units.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {units.map((u) => (
            <button
              key={u}
              onClick={() => onUnitChange(u)}
              className={`py-2 rounded-lg text-[12px] font-semibold ${unit === u ? "bg-white shadow" : ""}`}
              style={{
                color: unit === u ? "var(--color-navy)" : "var(--color-muted)",
              }}
            >
              {unitButtonLabel(u)}
            </button>
          ))}
        </div>
      )}
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        {qtyLabelForUnit(unit, qty)}
      </div>
      <Input
        type="number"
        inputMode="decimal"
        autoFocus={
          payload.defaultGrams != null || payload.defaultPieces != null
        }
        ref={(el) => {
          if (
            el &&
            (payload.defaultGrams != null || payload.defaultPieces != null)
          ) {
            requestAnimationFrame(() => el.focus());
          }
        }}
        value={qty === 0 ? "" : qty}
        onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
        className="mb-3"
      />
      {unit === "kom" && piece && (
        <div
          className="text-xs text-center mb-3"
          style={{ color: "var(--color-muted)" }}
        >
          {piece.label}
        </div>
      )}
      {isExtraUnit(unit) && qty > 0 && (
        <div
          className="text-xs text-center mb-3"
          style={{ color: "var(--color-muted)" }}
        >
          {formatExtraUnitAmount(qty, unit)} ≈ {Math.round(grams)} g
        </div>
      )}
      <div className="flex justify-between items-center bg-linear-to-br from-blue-50 to-indigo-100 rounded-xl px-3.5 py-3 mb-4">
        <span
          className="text-[13px] font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          Ukupno kalorija
        </span>
        <span
          className="text-[22px] font-extrabold"
          style={{ color: "var(--color-navy)" }}
        >
          {Math.round(macros.kcal)}
        </span>
      </div>
      <div className="flex gap-2 mb-4">
        <MacroBox name="Proteini" v={macros.p} />
        <MacroBox name="Ugljik." v={macros.u} />
        <MacroBox name="Masti" v={macros.m} />
      </div>
      {payload.defaultMeal ? (
        <div
          className="mb-4 px-3.5 py-2.5 rounded-xl bg-bg text-[13px] font-semibold flex items-center justify-between"
          style={{ color: "var(--color-navy)" }}
        >
          <span style={{ color: "var(--color-muted)" }}>Obrok</span>
          <span>{MEAL_NAMES[payload.defaultMeal]}</span>
        </div>
      ) : (
        <>
          <div
            className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--color-muted)" }}
          >
            Obrok
          </div>
          <Dropdown
            value={meal}
            onChange={setMeal}
            options={MEAL_OPTIONS}
            variant="input"
            fullWidth
            wrapperClassName="mb-4"
            ariaLabel="Obrok"
          />
        </>
      )}
      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.25rem+env(safe-area-inset-bottom))] bg-white border-t border-border/70">
        <div className="flex gap-2.5">
          <button
            onClick={closeModal}
            className="flex-1 py-3.5 rounded-xl border-[1.5px] border-border bg-bg text-[15px] font-semibold"
            style={{ color: "var(--color-muted)" }}
          >
            Odustani
          </button>
          <button
            onClick={onConfirm}
            className="flex-2 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold"
          >
            Dodaj
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MacroBox({ name, v }: { name: string; v: number }) {
  return (
    <div className="flex-1 bg-bg rounded-xl py-2 text-center border border-border">
      <div
        className="text-[15px] font-extrabold"
        style={{ color: "var(--color-navy)" }}
      >
        {Math.round(v)}g
      </div>
      <div
        className="text-[10px] font-semibold mt-0.5"
        style={{ color: "var(--color-muted)" }}
      >
        {name}
      </div>
    </div>
  );
}
