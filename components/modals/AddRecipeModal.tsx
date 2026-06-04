"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
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
  const [portionsStr, setPortionsStr] = useState<string>("1");
  const [lastRecipeId, setLastRecipeId] = useState<number | null>(null);

  // Reset transient fields when the modal opens for a new recipe. Mirrors the
  // NewRecipeModal pattern (render-phase init, not a useEffect cascade).
  if (modal === "addRecipe" && payload && lastRecipeId !== payload.recipe.id) {
    setLastRecipeId(payload.recipe.id);
    setTarget(payload.recipe.meal);
    setPortionsStr("1");
  } else if (modal !== "addRecipe" && lastRecipeId !== null) {
    setLastRecipeId(null);
  }

  if (modal !== "addRecipe" || !payload || !user) return null;
  const recipe = payload.recipe;
  const people = Math.max(1, Number(recipe.people) || 1);
  const totalKcal = recipe.items.reduce((s, i) => s + i.kcal, 0);
  const perKcal = totalKcal / people;

  const portionsParsed = parseFloat(portionsStr.replace(",", "."));
  const portionsFinite = Number.isFinite(portionsParsed);
  const portionsEmpty = portionsStr.trim() === "";
  const portionsZero = !portionsEmpty && portionsFinite && portionsParsed <= 0;
  const portionsOver =
    !portionsEmpty && portionsFinite && portionsParsed > people;
  const portionsValid =
    portionsFinite && portionsParsed > 0 && portionsParsed <= people;

  const previewKcal = portionsValid ? perKcal * portionsParsed : 0;

  const onConfirm = async () => {
    if (portionsEmpty) {
      showToast("Unesi broj porcija");
      return;
    }
    if (portionsZero) {
      showToast("Broj porcija mora biti veći od 0");
      return;
    }
    if (portionsOver) {
      showToast(`Maksimalni broj porcija je ${people}`);
      return;
    }
    if (!portionsValid) return;
    const portions = portionsParsed;
    closeModal();
    showToast(
      `Dodano ${portions} ${portions === 1 ? "porcija" : "porcije"} u ${MEAL_NAMES[target]} (${Math.round(perKcal * portions)} kcal)`,
    );
    const ds = dateForOffset(offset);
    const ratio = portions / people;
    // Tag every row of this added portion with one shared group id so the
    // dashboard collapses them into a single recipe card. crypto.randomUUID is
    // available in all browsers this PWA targets.
    const groupId = crypto.randomUUID();
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
        group_id: groupId,
        group_name: recipe.name,
        group_portions: portions,
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

      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Koliko ste porcija pojeli?
      </div>
      <Input
        type="text"
        inputMode="decimal"
        value={portionsStr}
        onChange={(e) => setPortionsStr(e.target.value)}
        onFocus={(e) => {
          const input = e.currentTarget;
          setTimeout(() => input.select(), 0);
        }}
        placeholder="npr. 1"
        className={
          portionsEmpty || portionsZero || portionsOver ? "mb-1" : "mb-2"
        }
      />

      {portionsEmpty && (
        <div
          className="mb-4 px-3 py-1.5 rounded-full inline-flex text-[11px] font-bold border"
          style={{
            color: "var(--color-orange)",
            background: "rgba(255,138,0,0.08)",
            borderColor: "rgba(255,138,0,0.35)",
          }}
        >
          Unesi broj porcija
        </div>
      )}
      {portionsZero && (
        <div
          className="mb-4 px-3 py-1.5 rounded-full inline-flex text-[11px] font-bold border"
          style={{
            color: "var(--color-orange)",
            background: "rgba(255,138,0,0.08)",
            borderColor: "rgba(255,138,0,0.35)",
          }}
        >
          Broj porcija mora biti veći od 0
        </div>
      )}
      {portionsOver && (
        <div
          className="mb-4 px-3 py-1.5 rounded-full inline-flex text-[11px] font-bold border"
          style={{
            color: "var(--color-orange)",
            background: "rgba(255,138,0,0.08)",
            borderColor: "rgba(255,138,0,0.35)",
          }}
        >
          Maksimalni broj porcija je {people}
        </div>
      )}
      {portionsValid && (
        <div
          className="mb-4 text-[12px] px-1"
          style={{ color: "var(--color-muted)" }}
        >
          Tvoj unos:{" "}
          <span style={{ color: "var(--color-orange)", fontWeight: 700 }}>
            {Math.round(previewKcal)} kcal
          </span>
        </div>
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
            disabled={!portionsValid}
            className="flex-2 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold disabled:opacity-60"
          >
            Dodaj u dnevnik
          </button>
        </div>
      </div>
    </Modal>
  );
}
