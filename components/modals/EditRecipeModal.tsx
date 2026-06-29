"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { BarcodeScanner } from "@/components/search/BarcodeScanner";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { MEAL_OPTIONS } from "@/lib/constants/meals";
import { updateRecipe } from "@/lib/api/recipes";
import { useFoods } from "@/hooks/useFoods";
import { useFoodSearch } from "@/hooks/useFoodSearch";
import type { RecipeRow, MealKey } from "@/types/database";
import type { FoodEntry } from "@/types/app";
import {
  changeItemUnit,
  fromStoredItem,
  IngredientAddPanel,
  itemDisplayQty,
  reconcileItemQty,
  toStoredItem,
  unitDropdownOptions,
  unitsForItem,
  type RecipeEditItem,
} from "./IngredientAmountFields";
import type { AmountUnit } from "@/lib/utils/macros";

type Payload = { recipe: RecipeRow };

export function EditRecipeModal({ onSaved }: { onSaved?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const { foods } = useFoods();

  const [name, setName] = useState("");
  const [meal, setMeal] = useState<MealKey>("dorucak");
  const [peopleStr, setPeopleStr] = useState<string>("1");
  const [items, setItems] = useState<RecipeEditItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addFood, setAddFood] = useState<FoodEntry | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [lastPayload, setLastPayload] = useState<Payload | null>(null);

  // Initialise form from payload on open. Render-phase guard (like
  // AddFoodModal) instead of an effect, to avoid cascading-render warnings.
  if (modal === "editRecipe" && payload && lastPayload !== payload) {
    setLastPayload(payload);
    const r = payload.recipe;
    setName(r.name);
    setMeal(r.meal);
    setPeopleStr(String(Math.max(1, Number(r.people) || 1)));
    setItems(r.items.map(fromStoredItem));
    setShowAdd(false);
    setAddSearch("");
    setAddFood(null);
    setScanOpen(false);
  } else if (modal !== "editRecipe" && lastPayload) {
    setLastPayload(null);
  }

  // Fuzzy, diacritic-tolerant search (same engine as the /search page).
  const { results: searchResults } = useFoodSearch(
    foods,
    addFood ? "" : addSearch,
    { limit: 8, minLength: 2 },
  );

  if (modal !== "editRecipe" || !payload) return null;

  const updateQty = (idx: number, val: number) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? reconcileItemQty(it, val) : it)),
    );
  };

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const selectFood = (food: FoodEntry) => {
    setAddFood(food);
    setAddSearch(food.name);
  };

  const resetAdd = () => {
    setShowAdd(false);
    setAddSearch("");
    setAddFood(null);
  };

  const onItemAdded = (item: RecipeEditItem) => {
    setItems((prev) => [...prev, item]);
    resetAdd();
  };

  // Scanned food flows into the same add path as a searched one.
  const onScanned = (food: FoodEntry) => {
    selectFood(food);
    setShowAdd(true);
    setScanOpen(false);
  };

  const changeUnit = (idx: number, unit: AmountUnit) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? changeItemUnit(it, unit, foods) : it)),
    );
  };

  const onConfirm = async () => {
    if (!name.trim()) {
      showToast("Unesi naziv recepta");
      return;
    }
    if (items.length === 0) {
      showToast("Recept mora imati barem jednu namirnicu");
      return;
    }
    const people = parseInt(peopleStr, 10);
    if (!Number.isFinite(people) || people < 1) {
      showToast("Unesi broj porcija (najmanje 1)");
      return;
    }
    if (items.some((it) => (it.pieces ?? it.grams) <= 0 || it.grams <= 0)) {
      showToast("Količina svake namirnice mora biti veća od 0");
      return;
    }
    setSaving(true);
    const outItems = items.map(toStoredItem);
    const totals = outItems.reduce(
      (a, i) => ({
        kcal: a.kcal + i.kcal,
        p: a.p + i.p,
        u: a.u + i.u,
        m: a.m + i.m,
      }),
      { kcal: 0, p: 0, u: 0, m: 0 },
    );
    try {
      await updateRecipe(payload.recipe.id, user?.id, {
        name: name.trim(),
        meal,
        people,
        items: outItems,
        total_kcal: totals.kcal,
        total_p: totals.p,
        total_u: totals.u,
        total_m: totals.m,
      });
      closeModal();
      showToast("Recept ažuriran");
      onSaved?.();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Greška pri spremanju";
      showToast(message);
      console.error("EditRecipe save error", error);
    } finally {
      setSaving(false);
    }
  };

  const totalKcal = items.reduce((s, it) => s + it.kcal, 0);
  const peopleParsed = parseInt(peopleStr, 10);
  const perKcal =
    totalKcal /
    (Number.isFinite(peopleParsed) && peopleParsed > 0 ? peopleParsed : 1);

  return (
    <Modal open onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        Uredi recept
      </div>
      <div className="text-[13px] mb-4" style={{ color: "var(--color-muted)" }}>
        {items.length} namirnica · {Math.round(totalKcal)} kcal ukupno ·{" "}
        {Math.round(perKcal)} kcal po porciji
      </div>

      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Naziv
      </div>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Naziv recepta"
        className="mb-3"
      />

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

      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Broj porcija
      </div>
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        value={peopleStr}
        onChange={(e) => setPeopleStr(e.target.value)}
        onFocus={(e) => {
          const input = e.currentTarget;
          setTimeout(() => input.select(), 0);
        }}
        placeholder="npr. 4"
        className={peopleStr.trim() === "" ? "mb-1" : "mb-4"}
      />
      {peopleStr.trim() === "" && (
        <div
          className="mb-4 px-3 py-1.5 rounded-full inline-flex text-[11px] font-bold border"
          style={{
            color: "var(--color-orange)",
            background: "rgba(255,138,0,0.08)",
            borderColor: "rgba(255,138,0,0.35)",
          }}
        >
          Unesi barem 1 porciju
        </div>
      )}

      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-2"
        style={{ color: "var(--color-muted)" }}
      >
        Namirnice
      </div>
      <div className="space-y-2 mb-3 max-h-56 overflow-y-auto pr-0.5">
        {items.map((it, idx) => (
          <div key={idx} className="bg-bg rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-xs font-semibold leading-snug flex-1 mr-2"
                style={{ color: "var(--color-navy)" }}
              >
                {it.name}
              </span>
              <button
                onClick={() => removeItem(idx)}
                className="text-gray-300 text-base leading-none w-5 h-5 flex items-center justify-center hover:text-red-400 shrink-0"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={(() => {
                  const v = itemDisplayQty(it);
                  return v === 0 ? "" : v;
                })()}
                onChange={(e) => updateQty(idx, parseFloat(e.target.value) || 0)}
                onFocus={(e) => {
                  const input = e.currentTarget;
                  setTimeout(() => input.select(), 0);
                }}
                className="w-20 text-center text-sm font-bold border border-border rounded-lg px-2 py-1.5 bg-white outline-none focus:border-blue-400"
                style={{ color: "var(--color-navy)" }}
              />
              {(() => {
                const units = unitsForItem(it, foods);
                return units.length > 1 ? (
                  <Dropdown
                    value={it.unit}
                    onChange={(u) => changeUnit(idx, u)}
                    options={unitDropdownOptions(units)}
                    variant="pill"
                    align="left"
                    ariaLabel="Mjerna jedinica"
                  />
                ) : (
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-muted)" }}
                  >
                    g
                  </span>
                );
              })()}
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                · {Math.round(it.kcal)} kcal
              </span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div
            className="text-xs text-center py-3"
            style={{ color: "var(--color-muted)" }}
          >
            Nema namirnica. Dodaj barem jednu.
          </div>
        )}
      </div>

      {showAdd ? (
        <div className="bg-bg rounded-xl px-3 py-2.5 mb-3 border border-dashed border-border">
          <div
            className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--color-muted)" }}
          >
            Pretraži namirnicu
          </div>
          <Input
            value={addSearch}
            onChange={(e) => {
              setAddSearch(e.target.value);
              setAddFood(null);
            }}
            placeholder="npr. piletina, skuta…"
            className="mb-1"
          />
          {searchResults.length > 0 && (
            <div className="bg-white rounded-xl border border-border mb-2 max-h-36 overflow-y-auto">
              {searchResults.map((f) => (
                <button
                  key={f.id}
                  onClick={() => selectFood(f)}
                  className="w-full text-left px-3 py-2 text-xs border-b border-border last:border-b-0 hover:bg-blue-50"
                  style={{ color: "var(--color-navy)" }}
                >
                  {f.name}
                  <span
                    className="ml-1.5 font-normal"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {f.kcal} kcal/100g
                  </span>
                </button>
              ))}
            </div>
          )}
          {addFood && (
            <IngredientAddPanel
              food={addFood}
              onAdd={onItemAdded}
              onCancel={resetAdd}
            />
          )}
          {!addFood && (
            <button
              onClick={() => setShowAdd(false)}
              className="text-[11px] underline mt-1"
              style={{ color: "var(--color-muted)" }}
            >
              Zatvori
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setShowAdd(true)}
            className="flex-1 py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold"
            style={{ color: "var(--color-muted)" }}
          >
            + Dodaj namirnicu
          </button>
          <button
            onClick={() => setScanOpen(true)}
            className="flex-1 py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold"
            style={{ color: "var(--color-muted)" }}
          >
            Skeniraj barkod
          </button>
        </div>
      )}

      <Modal open={scanOpen} onClose={() => setScanOpen(false)}>
        <div
          className="text-base font-extrabold mb-3"
          style={{ color: "var(--color-navy)" }}
        >
          Skeniraj barkod
        </div>
        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onResult={onScanned}
        />
      </Modal>

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
            disabled={saving}
            className="flex-2 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold disabled:opacity-60"
          >
            Spremi
          </button>
        </div>
      </div>
    </Modal>
  );
}
