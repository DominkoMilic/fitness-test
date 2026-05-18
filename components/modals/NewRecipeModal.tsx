"use client";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { MEAL_OPTIONS } from "@/lib/constants/meals";
import { createRecipe } from "@/lib/api/recipes";
import { useFoods } from "@/hooks/useFoods";
import { macroForGrams } from "@/lib/utils/macros";
import type { MealKey } from "@/types/database";
import type { FoodEntry } from "@/types/app";

type EditItem = {
  name: string;
  grams: number;
  kcal: number;
  p: number;
  u: number;
  m: number;
  pieces: number | null;
  rKcal: number;
  rP: number;
  rU: number;
  rM: number;
  pieceG: number | null;
};

export function NewRecipeModal({ onCreated }: { onCreated?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const { foods } = useFoods();

  const [name, setName] = useState("");
  const [meal, setMeal] = useState<MealKey>("dorucak");
  const [peopleStr, setPeopleStr] = useState<string>("1");
  const [items, setItems] = useState<EditItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addFood, setAddFood] = useState<FoodEntry | null>(null);
  const [addQtyStr, setAddQtyStr] = useState("100");
  const [lastModal, setLastModal] = useState<typeof modal>(null);

  if (modal === "newRecipe" && lastModal !== "newRecipe") {
    setLastModal("newRecipe");
    setName("");
    setMeal("dorucak");
    setPeopleStr("1");
    setItems([]);
    setShowAdd(false);
    setAddSearch("");
    setAddFood(null);
    setAddQtyStr("100");
  } else if (modal !== "newRecipe" && lastModal === "newRecipe") {
    setLastModal(modal);
  }

  const searchResults = useMemo(() => {
    if (!addSearch.trim() || addFood) return [];
    const q = addSearch.toLowerCase();
    return foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [addSearch, addFood, foods]);

  if (modal !== "newRecipe") return null;

  const updateGrams = (idx: number, val: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const g = Math.max(0, val);
        return {
          ...it,
          grams: g,
          kcal: g * it.rKcal,
          p: g * it.rP,
          u: g * it.rU,
          m: g * it.rM,
          pieces: null,
        };
      }),
    );
  };

  const updatePieces = (idx: number, val: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const pcs = Math.max(0, val);
        const g = pcs * (it.pieceG ?? 1);
        return {
          ...it,
          grams: g,
          kcal: g * it.rKcal,
          p: g * it.rP,
          u: g * it.rU,
          m: g * it.rM,
          pieces: pcs,
        };
      }),
    );
  };

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const selectFood = (food: FoodEntry) => {
    setAddFood(food);
    setAddSearch(food.name);
    setAddQtyStr("100");
  };

  const confirmAdd = () => {
    if (!addFood) return;
    const addQty = parseFloat(addQtyStr) || 0;
    if (!addQty || addQty <= 0) {
      showToast("Količina mora biti veća od 0");
      return;
    }
    const m = macroForGrams(addFood, addQty);
    setItems((prev) => [
      ...prev,
      {
        name: addFood.name,
        grams: addQty,
        kcal: m.kcal,
        p: m.p,
        u: m.u,
        m: m.m,
        pieces: null,
        rKcal: addFood.kcal / 100,
        rP: addFood.p / 100,
        rU: addFood.u / 100,
        rM: addFood.m / 100,
        pieceG: addFood.piece_g ?? null,
      },
    ]);
    setShowAdd(false);
    setAddSearch("");
    setAddFood(null);
    setAddQtyStr("100");
  };

  const onConfirm = async () => {
    if (!user) return;
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
      showToast("Unesi broj osoba (najmanje 1)");
      return;
    }
    if (items.some((it) => (it.pieces ?? it.grams) <= 0 || it.grams <= 0)) {
      showToast("Količina svake namirnice mora biti veća od 0");
      return;
    }
    setSaving(true);
    const outItems = items.map((it) => ({
      name: it.name,
      grams: Math.round(it.grams * 10) / 10,
      kcal: Math.round(it.kcal * 10) / 10,
      p: Math.round(it.p * 10) / 10,
      u: Math.round(it.u * 10) / 10,
      m: Math.round(it.m * 10) / 10,
      pieces: it.pieces,
    }));
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
      await createRecipe({
        user_id: user.id,
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
      showToast("Recept kreiran");
      onCreated?.();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Greška pri spremanju";
      showToast(message);
      console.error("NewRecipe save error", error);
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
        Novi recept
      </div>
      <div className="text-[13px] mb-4" style={{ color: "var(--color-muted)" }}>
        {items.length} namirnica · {Math.round(totalKcal)} kcal ukupno ·{" "}
        {Math.round(perKcal)} kcal po osobi
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
        Broj osoba
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
          Unesi barem 1 osobu
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
                  const v = it.pieces !== null ? it.pieces : it.grams;
                  return v === 0 ? "" : v;
                })()}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (it.pieces !== null) updatePieces(idx, val);
                  else updateGrams(idx, val);
                }}
                className="w-20 text-center text-sm font-bold border border-border rounded-lg px-2 py-1.5 bg-white outline-none focus:border-blue-400"
                style={{ color: "var(--color-navy)" }}
              />
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                {it.pieces !== null ? "kom" : "g"} · {Math.round(it.kcal)} kcal
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
            <>
              <div
                className="text-[11px] font-bold uppercase tracking-wider mb-1.5 mt-2"
                style={{ color: "var(--color-muted)" }}
              >
                Količina (g)
              </div>
              <Input
                type="number"
                inputMode="decimal"
                value={addQtyStr}
                onChange={(e) => setAddQtyStr(e.target.value)}
                className="mb-2"
              />
              <div
                className="text-xs mb-2"
                style={{ color: "var(--color-muted)" }}
              >
                {Math.round(macroForGrams(addFood, parseFloat(addQtyStr) || 0).kcal)} kcal
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAdd(false);
                    setAddFood(null);
                    setAddSearch("");
                  }}
                  className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold"
                  style={{ color: "var(--color-muted)" }}
                >
                  Odustani
                </button>
                <button
                  onClick={confirmAdd}
                  className="flex-2 py-2 rounded-xl bg-orange text-white text-xs font-bold"
                >
                  + Dodaj
                </button>
              </div>
            </>
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
        <button
          onClick={() => setShowAdd(true)}
          className="w-full mb-3 py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          + Dodaj namirnicu
        </button>
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
