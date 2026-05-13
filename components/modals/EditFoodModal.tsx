"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { useUIStore } from "@/store/useUIStore";
import { effectiveGrams, macroForGrams } from "@/lib/utils/macros";
import { MEAL_OPTIONS } from "@/lib/constants/meals";
import { updateLog } from "@/lib/api/foodLogs";
import type { FoodLogRow, MealKey } from "@/types/database";

type Payload = { log: FoodLogRow };

export function EditFoodModal({ onSaved }: { onSaved?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);

  const [unit, setUnit] = useState<"g" | "kom">("g");
  const [qtyStr, setQtyStr] = useState<string>("");
  const [meal, setMeal] = useState<MealKey>("dorucak");

  useEffect(() => {
    if (modal === "editFood" && payload?.log) {
      const l = payload.log;
      setUnit(l.pieces ? "kom" : "g");
      setQtyStr(String(l.pieces ?? Number(l.grams)));
      setMeal(l.meal);
    }
  }, [modal, payload]);

  if (modal !== "editFood" || !payload) return null;
  const log = payload.log;
  const factor100 = Number(log.grams) > 0 ? 100 / Number(log.grams) : 1;
  const food = {
    id: `_edit_${log.id}`,
    name: log.food_name,
    kcal: Number(log.kcal) * factor100,
    p: Number(log.p) * factor100,
    u: Number(log.u) * factor100,
    m: Number(log.m) * factor100,
  };
  const editPieceG = log.pieces ? Number(log.grams) / Number(log.pieces) : null;
  const qty = parseFloat(qtyStr) || 0;
  const grams = effectiveGrams(qty, unit, food, editPieceG);
  const macros = macroForGrams(food, grams);

  const onConfirm = async () => {
    if (!qty || qty <= 0 || grams <= 0) {
      showToast("Količina mora biti veća od 0");
      return;
    }
    closeModal();
    showToast("Spremljeno");
    await updateLog(log.id, {
      meal,
      grams: Math.round(grams * 10) / 10,
      kcal: macros.kcal,
      p: macros.p,
      u: macros.u,
      m: macros.m,
      pieces: unit === "kom" ? qty : null,
    });
    onSaved?.();
  };

  return (
    <Modal open onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        {log.food_name}
      </div>
      <div className="text-[13px] mb-5" style={{ color: "var(--color-muted)" }}>
        100g = {Math.round(food.kcal)} kcal
      </div>
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        {unit === "kom" ? "Broj komada" : "Količina (g)"}
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
        className="mb-3"
      />
      {unit === "kom" && editPieceG && (
        <div
          className="text-xs text-center mb-3"
          style={{ color: "var(--color-muted)" }}
        >
          1 kom ≈ {Math.round(editPieceG * 10) / 10}g
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
      <Dropdown
        value={meal}
        onChange={setMeal}
        options={MEAL_OPTIONS}
        variant="input"
        fullWidth
        wrapperClassName="mb-4"
        ariaLabel="Obrok"
      />
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
            Spremi
          </button>
        </div>
      </div>
    </Modal>
  );
}
