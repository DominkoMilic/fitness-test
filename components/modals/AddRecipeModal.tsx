"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useDayStore } from "@/store/useDayStore";
import { MEAL_NAMES, MEAL_OPTIONS } from "@/lib/constants/meals";
import { dateForOffset } from "@/lib/utils/date";
import { insertLogs } from "@/lib/api/foodLogs";
import type { RecipeRow, MealKey } from "@/types/database";

type Payload = { recipe: RecipeRow };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function AddRecipeModal({ onAdded }: { onAdded?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const offset = useDayStore((s) => s.offset);
  const [target, setTarget] = useState<MealKey>("dorucak");

  useEffect(() => {
    if (modal === "addRecipe" && payload) {
      setTarget(payload.recipe.meal);
    }
  }, [modal, payload]);

  if (modal !== "addRecipe" || !payload || !user) return null;
  const recipe = payload.recipe;
  const people = Math.max(1, Number(recipe.people) || 1);
  const totalKcal = recipe.items.reduce((s, i) => s + i.kcal, 0);
  const perKcal = totalKcal / people;

  const onConfirm = async () => {
    closeModal();
    showToast(
      `Dodana 1 porcija u ${MEAL_NAMES[target]} (${Math.round(perKcal)} kcal)`,
    );
    const ds = dateForOffset(offset);
    const ratio = 1 / people;
    await insertLogs(
      recipe.items.map((it) => ({
        user_id: user.id,
        date: ds,
        meal: target,
        food_name: it.name,
        grams: round1(it.grams * ratio),
        kcal: round1(it.kcal * ratio),
        p: round1(it.p * ratio),
        u: round1(it.u * ratio),
        m: round1(it.m * ratio),
        pieces: it.pieces == null ? null : round1(it.pieces * ratio),
      })),
    );
    onAdded?.();
  };

  return (
    <Modal open onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        {recipe.name}
      </div>
      <div className="text-[13px] mb-4" style={{ color: "var(--color-muted)" }}>
        {recipe.items.length} namirnica · {Math.round(totalKcal)} kcal ukupno ·{" "}
        za {people} {people === 1 ? "porciju" : "porcije"} ·{" "}
        <span style={{ color: "var(--color-orange)", fontWeight: 700 }}>
          {Math.round(perKcal)} kcal po porciji
        </span>
      </div>

      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        U koji obrok?
      </div>
      <Dropdown
        value={target}
        onChange={setTarget}
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
            Dodaj u dnevnik
          </button>
        </div>
      </div>
    </Modal>
  );
}
