"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useDayStore } from "@/store/useDayStore";
import { dateForOffset } from "@/lib/utils/date";
import {
  effectiveGrams,
  getPieceInfo,
  macroForGrams,
} from "@/lib/utils/macros";
import { MEAL_KEYS, MEAL_NAMES } from "@/lib/constants/meals";
import { insertLog } from "@/lib/api/foodLogs";
import type { FoodEntry } from "@/types/app";
import type { MealKey } from "@/types/database";

type Payload = { food: FoodEntry; defaultMeal?: MealKey };

export function AddFoodModal({ onAdded }: { onAdded?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const offset = useDayStore((s) => s.offset);

  const [unit, setUnit] = useState<"g" | "kom">("g");
  const [qty, setQty] = useState<number>(100);
  const [meal, setMeal] = useState<MealKey>("dorucak");

  useEffect(() => {
    if (modal === "addFood" && payload) {
      setUnit("g");
      setQty(100);
      setMeal(payload.defaultMeal ?? "dorucak");
    }
  }, [modal, payload]);

  if (modal !== "addFood" || !payload) return null;
  const food = payload.food;
  const piece = getPieceInfo(food);
  const grams = effectiveGrams(qty || 0, unit, food, null);
  const macros = macroForGrams(food, grams);

  const onUnitChange = (u: "g" | "kom") => {
    setUnit(u);
    setQty(u === "kom" ? 1 : 100);
  };

  const onConfirm = async () => {
    if (!user) return;
    closeModal();
    showToast(`Dodano: ${food.name}`);
    await insertLog({
      user_id: user.id,
      date: dateForOffset(offset),
      meal,
      food_name: food.name,
      grams: Math.round(grams * 10) / 10,
      kcal: macros.kcal,
      p: macros.p,
      u: macros.u,
      m: macros.m,
      pieces: unit === "kom" ? qty : null,
    });
    onAdded?.();
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
      {piece && (
        <div className="flex bg-bg rounded-xl p-1 mb-4">
          {(["g", "kom"] as const).map((u) => (
            <button
              key={u}
              onClick={() => onUnitChange(u)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-semibold ${unit === u ? "bg-white shadow" : ""}`}
              style={{
                color: unit === u ? "var(--color-navy)" : "var(--color-muted)",
              }}
            >
              {u === "g" ? "Grami (g)" : "Komadi (kom)"}
            </button>
          ))}
        </div>
      )}
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        {unit === "kom" ? "Broj komada" : "Količina (g)"}
      </div>
      <Input
        type="number"
        inputMode="decimal"
        value={qty}
        onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
        onFocus={(e) => {
          const input = e.currentTarget;
          setTimeout(() => input.select(), 0);
        }}
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
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Obrok
      </div>
      <Select
        value={meal}
        onChange={(e) => setMeal(e.target.value as MealKey)}
        className="mb-4"
      >
        {MEAL_KEYS.map((k) => (
          <option key={k} value={k}>
            {MEAL_NAMES[k]}
          </option>
        ))}
      </Select>
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
