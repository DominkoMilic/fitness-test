"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Input";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useDayStore } from "@/store/useDayStore";
import { MEAL_KEYS, MEAL_NAMES } from "@/lib/constants/meals";
import { dateForOffset } from "@/lib/utils/date";
import { insertLogs } from "@/lib/api/foodLogs";
import type { FavoriteRow, MealKey } from "@/types/database";

type Payload = { fav: FavoriteRow };

export function AddFavModal({ onAdded }: { onAdded?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const offset = useDayStore((s) => s.offset);
  const [target, setTarget] = useState<MealKey>("dorucak");

  useEffect(() => {
    if (modal === "addFav" && payload) setTarget(payload.fav.meal);
  }, [modal, payload]);

  if (modal !== "addFav" || !payload || !user) return null;
  const fav = payload.fav;
  const totalKcal = fav.items.reduce((s, i) => s + i.kcal, 0);

  const onConfirm = async () => {
    closeModal();
    showToast(`Dodano ${fav.items.length} namirnica u ${MEAL_NAMES[target]}`);
    const ds = dateForOffset(offset);
    await insertLogs(
      fav.items.map((it) => ({
        user_id: user.id,
        date: ds,
        meal: target,
        food_name: it.name,
        grams: it.grams,
        kcal: it.kcal,
        p: it.p,
        u: it.u,
        m: it.m,
        pieces: it.pieces ?? null,
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
        {fav.name}
      </div>
      <div className="text-[13px] mb-5" style={{ color: "var(--color-muted)" }}>
        {fav.items.length} namirnica · {Math.round(totalKcal)} kcal
      </div>
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        U koji obrok?
      </div>
      <Select
        value={target}
        onChange={(e) => setTarget(e.target.value as MealKey)}
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
          className="flex-1 py-3.5 rounded-xl border-[1.5px] border-border bg-[var(--color-bg)] text-[15px] font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          Odustani
        </button>
        <button
          onClick={onConfirm}
          className="flex-[2] py-3.5 rounded-xl bg-gradient-to-br from-[#1b3255] to-[#162844] text-white text-[15px] font-bold"
        >
          Dodaj u dnevnik
        </button>
      </div>
    </Modal>
  );
}
