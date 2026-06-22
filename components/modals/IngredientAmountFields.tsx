"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import {
  effectiveGrams,
  formatExtraUnitAmount,
  getPieceInfo,
  isExtraUnit,
  macroForGrams,
  type AmountUnit,
} from "@/lib/utils/macros";
import { EXTRA_UNIT_FORMS, EXTRA_UNIT_G } from "@/lib/constants/extraUnits";
import type { DropdownOption } from "@/components/ui/Dropdown";
import type { FoodEntry } from "@/types/app";
import type { FavoriteItem } from "@/types/database";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Recipe/favourite ingredient row as held in modal state. Extends the stored
 * shape with the per-gram scaling rates and the user's chosen unit/qty so the
 * choice survives a re-open. `unit`/`qty` mirror what AddFoodModal does for a
 * single diary entry.
 */
export type RecipeEditItem = {
  name: string;
  grams: number;
  kcal: number;
  p: number;
  u: number;
  m: number;
  pieces: number | null;
  unit: AmountUnit;
  qty: number;
  rKcal: number;
  rP: number;
  rU: number;
  rM: number;
  pieceG: number | null;
};

/** Units a food supports: grams always, komad if it has a piece weight,
 *  šalica/žlice when the food flags them. Mirrors AddFoodModal. */
export function unitsForFood(food: FoodEntry): AmountUnit[] {
  const units: AmountUnit[] = ["g"];
  if (getPieceInfo(food)) units.push("kom");
  if (food.has_cup) units.push("salica");
  if (food.has_spoons) units.push("jusna_zlica", "cajna_zlica");
  return units;
}

function defaultQtyForUnit(unit: AmountUnit): number {
  return unit === "g" ? 100 : 1;
}

function unitButtonLabel(unit: AmountUnit): string {
  if (unit === "g") return "Grami (g)";
  if (unit === "kom") return "Komadi (kom)";
  const g = EXTRA_UNIT_G[unit];
  const f = EXTRA_UNIT_FORMS[unit];
  return `${f.singular[0].toUpperCase()}${f.singular.slice(1)} (${g}g)`;
}

/** Short label for an item row, e.g. "g", "kom", "šalica / čaša". */
export function unitShortLabel(unit: AmountUnit): string {
  if (unit === "g") return "g";
  if (unit === "kom") return "kom";
  return EXTRA_UNIT_FORMS[unit].singular;
}

/** Quantity shown in an item row, expressed in the item's chosen unit. */
export function itemDisplayQty(it: RecipeEditItem): number {
  return it.unit === "g" ? it.grams : it.qty;
}

/** Full label for a unit, used in the per-row unit dropdown. */
export function unitOptionLabel(unit: AmountUnit): string {
  if (unit === "g") return "Grami (g)";
  if (unit === "kom") return "Komadi (kom)";
  return EXTRA_UNIT_FORMS[unit].singular;
}

export function unitDropdownOptions(
  units: AmountUnit[],
): DropdownOption<AmountUnit>[] {
  return units.map((u) => ({ value: u, label: unitOptionLabel(u) }));
}

/** Convert grams back into a quantity expressed in `unit`. */
function gramsToUnitQty(
  grams: number,
  unit: AmountUnit,
  pieceG: number | null,
): number {
  if (unit === "kom") return pieceG ? round1(grams / pieceG) : round1(grams);
  if (isExtraUnit(unit)) return round1(grams / EXTRA_UNIT_G[unit]);
  return round1(grams);
}

/** Units a stored item may be switched between. Prefers the live food row;
 *  falls back to grams + the current unit (+ komad if the item has a piece). */
export function unitsForItem(
  it: RecipeEditItem,
  foods: FoodEntry[],
): AmountUnit[] {
  const food = foods.find((f) => f.name === it.name);
  if (food) return unitsForFood(food);
  const set: AmountUnit[] = ["g", it.unit];
  if (it.pieces != null || it.pieceG) set.push("kom");
  return Array.from(new Set(set));
}

/** Switch an item's unit while keeping its gram amount (and thus macros)
 *  constant — only the displayed quantity/unit changes. */
export function changeItemUnit(
  it: RecipeEditItem,
  unit: AmountUnit,
  foods: FoodEntry[],
): RecipeEditItem {
  const food = foods.find((f) => f.name === it.name);
  const pieceG = getPieceInfo(food)?.g ?? food?.piece_g ?? it.pieceG;
  const qty = gramsToUnitQty(it.grams, unit, pieceG);
  return { ...it, unit, qty, pieces: unit === "kom" ? qty : null, pieceG };
}

/** Build a fresh item from a food + chosen unit/qty. */
export function buildEditItem(
  food: FoodEntry,
  unit: AmountUnit,
  qty: number,
): RecipeEditItem {
  const pieceG = getPieceInfo(food)?.g ?? food.piece_g ?? null;
  const grams = effectiveGrams(qty, unit, food, pieceG);
  const m = macroForGrams(food, grams);
  return {
    name: food.name,
    grams,
    kcal: m.kcal,
    p: m.p,
    u: m.u,
    m: m.m,
    pieces: unit === "kom" ? qty : null,
    unit,
    qty,
    rKcal: food.kcal / 100,
    rP: food.p / 100,
    rU: food.u / 100,
    rM: food.m / 100,
    pieceG,
  };
}

/** Recompute an item when the user edits its quantity inline. */
export function reconcileItemQty(
  it: RecipeEditItem,
  newQty: number,
): RecipeEditItem {
  const qty = Math.max(0, newQty);
  const grams = effectiveGrams(qty, it.unit, null, it.pieceG);
  return {
    ...it,
    qty,
    grams,
    kcal: grams * it.rKcal,
    p: grams * it.rP,
    u: grams * it.rU,
    m: grams * it.rM,
    pieces: it.unit === "kom" ? qty : null,
  };
}

/** Reconstruct a modal item from a stored recipe/favourite item.
 *  Legacy rows (no `unit`) infer komad from `pieces`, else grams. */
export function fromStoredItem(it: FavoriteItem): RecipeEditItem {
  const g = Number(it.grams) || 1;
  const pcs = it.pieces ? Number(it.pieces) : null;
  const storedUnit = (it as FavoriteItem & { unit?: AmountUnit }).unit;
  const storedQty = (it as FavoriteItem & { qty?: number }).qty;
  const unit: AmountUnit = storedUnit ?? (pcs ? "kom" : "g");
  const pieceG = pcs ? g / pcs : null;
  let qty: number;
  if (storedQty != null) qty = storedQty;
  else if (unit === "kom") qty = pcs ?? g;
  else if (isExtraUnit(unit)) qty = g / EXTRA_UNIT_G[unit];
  else qty = g;
  return {
    name: it.name,
    grams: g,
    kcal: Number(it.kcal),
    p: Number(it.p),
    u: Number(it.u),
    m: Number(it.m),
    pieces: pcs,
    unit,
    qty,
    rKcal: Number(it.kcal) / g,
    rP: Number(it.p) / g,
    rU: Number(it.u) / g,
    rM: Number(it.m) / g,
    pieceG,
  };
}

/** Strip modal-only fields before persisting to the JSONB items column. */
export function toStoredItem(it: RecipeEditItem): FavoriteItem & {
  unit: AmountUnit;
  qty: number;
} {
  return {
    name: it.name,
    grams: round1(it.grams),
    kcal: round1(it.kcal),
    p: round1(it.p),
    u: round1(it.u),
    m: round1(it.m),
    pieces: it.pieces,
    unit: it.unit,
    qty: round1(it.qty),
  };
}

/**
 * The "set quantity + unit for the selected food" sub-panel, shared by the
 * recipe and favourite create/edit modals. Owns its own unit/qty state and
 * emits a finished {@link RecipeEditItem} via `onAdd`.
 */
export function IngredientAddPanel({
  food,
  onAdd,
  onCancel,
}: {
  food: FoodEntry;
  onAdd: (item: RecipeEditItem) => void;
  onCancel: () => void;
}) {
  const units = unitsForFood(food);
  const [unit, setUnit] = useState<AmountUnit>("g");
  const [qtyStr, setQtyStr] = useState("100");

  const qty = parseFloat(qtyStr) || 0;
  const pieceG = getPieceInfo(food)?.g ?? food.piece_g ?? null;
  const grams = effectiveGrams(qty, unit, food, pieceG);
  const macros = macroForGrams(food, grams);

  const onUnitChange = (u: AmountUnit) => {
    setUnit(u);
    setQtyStr(String(defaultQtyForUnit(u)));
  };

  const confirm = () => {
    if (!qty || qty <= 0 || grams <= 0) return;
    onAdd(buildEditItem(food, unit, qty));
  };

  return (
    <>
      {units.length > 1 && (
        <div
          className="grid grid-cols-2 gap-1.5 mt-2 mb-2 bg-white rounded-xl p-1 border border-border"
          style={{ gridAutoRows: "minmax(2.5rem, auto)" }}
        >
          {units.map((u) => (
            <button
              key={u}
              onClick={() => onUnitChange(u)}
              className={`flex items-center justify-center text-center px-2 rounded-lg text-[12px] font-semibold leading-tight ${unit === u ? "bg-bg shadow" : ""}`}
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
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5 mt-2"
        style={{ color: "var(--color-muted)" }}
      >
        {unit === "g"
          ? "Količina (g)"
          : unit === "kom"
            ? "Broj komada"
            : "Količina"}
      </div>
      <Input
        type="number"
        inputMode="decimal"
        value={qtyStr}
        onChange={(e) => setQtyStr(e.target.value)}
        onFocus={(e) => {
          const input = e.currentTarget;
          setTimeout(() => input.select(), 0);
        }}
        className="mb-2"
      />
      <div className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
        {isExtraUnit(unit) && qty > 0
          ? `${formatExtraUnitAmount(qty, unit)} ≈ ${Math.round(grams)} g · `
          : ""}
        {Math.round(macros.kcal)} kcal
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          Odustani
        </button>
        <button
          onClick={confirm}
          className="flex-2 py-2 rounded-xl bg-orange text-white text-xs font-bold"
        >
          + Dodaj
        </button>
      </div>
    </>
  );
}
