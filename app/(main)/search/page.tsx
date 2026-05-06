"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { FoodResultItem } from "@/components/search/FoodResultItem";
import { HistoryList } from "@/components/search/HistoryList";
import { BarcodeScanner } from "@/components/search/BarcodeScanner";
import { AddFoodModal } from "@/components/modals/AddFoodModal";
import { useFoods } from "@/hooks/useFoods";
import { useHistory } from "@/hooks/useHistory";
import { useAuthStore } from "@/store/useAuthStore";
import { useUIStore } from "@/store/useUIStore";
import { useDayStore } from "@/store/useDayStore";
import { dateForOffset } from "@/lib/utils/date";
import { listLogs } from "@/lib/api/foodLogs";
import { normalizeForSearch } from "@/lib/utils/normalize";
import type { FoodEntry } from "@/types/app";
import type { MealKey } from "@/types/database";

export default function SearchPage() {
  const params = useSearchParams();
  const presetMeal = (params.get("meal") as MealKey | null) ?? undefined;
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const { foods, addLocal } = useFoods();
  const user = useAuthStore((s) => s.user);
  const { history, add: pushHistory } = useHistory(user?.code);
  const openModal = useUIStore((s) => s.openModal);

  const filtered = useMemo(() => {
    const norm = normalizeForSearch(q.trim());
    if (!norm) return [];
    return foods.filter((f) => normalizeForSearch(f.name).includes(norm)).slice(0, 25);
  }, [q, foods]);

  const onPick = (food: FoodEntry) => {
    pushHistory(food);
    openModal("addFood", { food, defaultMeal: presetMeal });
  };

  const onScanResult = (food: FoodEntry) => {
    addLocal(food);
    onPick(food);
  };

  // Trigger refresh of dashboard after add — invalidate logs for current day.
  const offset = useDayStore((s) => s.offset);
  const onAdded = () => {
    if (user?.code) listLogs(user.code, dateForOffset(offset));
  };

  return (
    <>
      <SearchBar value={q} onChange={setQ} onScan={() => setScan((v) => !v)} />
      <BarcodeScanner open={scan} onClose={() => setScan(false)} onResult={onScanResult} />
      {q ? (
        filtered.length ? (
          <div>
            {filtered.map((f) => (
              <FoodResultItem key={f.id} food={f} onClick={() => onPick(f)} />
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-sm" style={{ color: "var(--color-muted)" }}>
            Namirnica nije pronađena ({foods.length}).
          </div>
        )
      ) : (
        <HistoryList items={history} onAdd={(id) => {
          const f = foods.find((x) => Number(x.id) === id) || history.find((x) => Number(x.id) === id);
          if (f) onPick(f as FoodEntry);
        }} />
      )}
      <AddFoodModal onAdded={onAdded} />
    </>
  );
}
