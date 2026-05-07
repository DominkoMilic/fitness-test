"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { FoodResultItem } from "@/components/search/FoodResultItem";
import { HistoryList, type HistoryListItem } from "@/components/search/HistoryList";
import { BarcodeScanner } from "@/components/search/BarcodeScanner";
import { AddFoodModal } from "@/components/modals/AddFoodModal";
import { useFoods } from "@/hooks/useFoods";
import { useHistory } from "@/hooks/useHistory";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { useDayStore } from "@/store/useDayStore";
import { dateForOffset } from "@/lib/utils/date";
import { insertLog, listLogs } from "@/lib/api/foodLogs";
import { effectiveGrams, macroForGrams } from "@/lib/utils/macros";
import { normalizeForSearch } from "@/lib/utils/normalize";
import { MEAL_KEYS, MEAL_NAMES } from "@/lib/constants/meals";
import type { FoodEntry } from "@/types/app";
import type { MealKey } from "@/types/database";

export default function SearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const rawMeal = params.get("meal");
  const presetMeal = (MEAL_KEYS as readonly string[]).includes(rawMeal ?? "")
    ? (rawMeal as MealKey)
    : undefined;

  useEffect(() => {
    if (!presetMeal) router.replace("/dashboard");
  }, [presetMeal, router]);

  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const { foods, addLocal } = useFoods();
  const user = useAuthStore((s) => s.user);
  const {
    entries,
    push: pushHistory,
    remove: removeHistory,
    clear: clearHistory,
  } = useHistory(user?.id);
  const openModal = useUIStore((s) => s.openModal);
  const showToast = useUIStore((s) => s.showToast);
  const offset = useDayStore((s) => s.offset);

  const filtered = useMemo(() => {
    const norm = normalizeForSearch(q.trim());
    if (!norm) return [];
    return foods
      .filter((f) => normalizeForSearch(f.name).includes(norm))
      .slice(0, 25);
  }, [q, foods]);

  const historyItems = useMemo<HistoryListItem[]>(() => {
    const byId = new Map(foods.map((f) => [Number(f.id), f]));
    return entries
      .map((e) => {
        const food = byId.get(Number(e.foodId));
        return food ? { food, grams: e.grams, pieces: e.pieces } : null;
      })
      .filter((x): x is HistoryListItem => Boolean(x));
  }, [foods, entries]);

  const onAdded = () => {
    if (user?.id) listLogs(user.id, dateForOffset(offset));
  };

  // Search result click → open modal (no preset amount).
  const onPick = (food: FoodEntry) => {
    openModal("addFood", { food, defaultMeal: presetMeal });
  };

  const onScanResult = (food: FoodEntry) => {
    addLocal(food);
    onPick(food);
  };

  // History row click → open modal pre-filled with stored amount.
  const onHistoryEdit = (foodId: number) => {
    const food = foods.find((x) => Number(x.id) === foodId);
    const entry = entries.find((e) => e.foodId === foodId);
    if (!food) return;
    openModal("addFood", {
      food,
      defaultMeal: presetMeal,
      defaultGrams: entry?.grams,
      defaultPieces: entry?.pieces ?? null,
    });
  };

  // History + button → instant insert with stored amount, no modal.
  const onHistoryQuickAdd = async (foodId: number) => {
    if (!user || !presetMeal) return;
    const food = foods.find((x) => Number(x.id) === foodId);
    const entry = entries.find((e) => e.foodId === foodId);
    if (!food || !entry) return;
    const unit: "g" | "kom" = entry.pieces != null ? "kom" : "g";
    const qty = unit === "kom" ? Number(entry.pieces) : entry.grams;
    const grams = effectiveGrams(qty || 0, unit, food, null);
    const macros = macroForGrams(food, grams);
    showToast(`Dodano: ${food.name}`);
    await insertLog({
      user_id: user.id,
      date: dateForOffset(offset),
      meal: presetMeal,
      food_name: food.name,
      grams: Math.round(grams * 10) / 10,
      kcal: macros.kcal,
      p: macros.p,
      u: macros.u,
      m: macros.m,
      pieces: unit === "kom" ? qty : null,
    });
    pushHistory(foodId, entry.grams, entry.pieces);
    onAdded();
  };

  if (!presetMeal) return null;

  return (
    <>
      <div
        className="px-5 pt-4 pb-2 text-base font-extrabold"
        style={{ color: "var(--color-navy)" }}
      >
        Dodaj u: {MEAL_NAMES[presetMeal]}
      </div>
      <SearchBar value={q} onChange={setQ} onScan={() => setScan((v) => !v)} />
      <BarcodeScanner
        open={scan}
        onClose={() => setScan(false)}
        onResult={onScanResult}
      />
      {q ? (
        filtered.length ? (
          <div>
            {filtered.map((f) => (
              <FoodResultItem key={f.id} food={f} onClick={() => onPick(f)} />
            ))}
          </div>
        ) : (
          <div
            className="p-6 text-center text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            Namirnica nije pronađena ({foods.length}).
          </div>
        )
      ) : (
        <HistoryList
          items={historyItems}
          onQuickAdd={onHistoryQuickAdd}
          onEdit={onHistoryEdit}
          onRemove={(id) => removeHistory(id)}
          onClear={() => clearHistory()}
        />
      )}
      <AddFoodModal onAdded={onAdded} />
    </>
  );
}
