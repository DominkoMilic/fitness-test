"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { MEAL_OPTIONS } from "@/lib/constants/meals";
import { createFavorite } from "@/lib/api/favorites";
import type { FoodLogRow, MealKey } from "@/types/database";

type Payload = { meal: MealKey; items: FoodLogRow[] };

export function SaveFavModal({ onSaved }: { onSaved?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState("");
  const [meal, setMeal] = useState<MealKey>("dorucak");

  useEffect(() => {
    if (modal === "saveFav" && payload) {
      setName("");
      setMeal(payload.meal);
    }
  }, [modal, payload]);

  if (modal !== "saveFav" || !payload || !user) return null;

  const items = payload.items.map((i) => ({
    name: i.food_name,
    grams: Number(i.grams),
    kcal: Number(i.kcal),
    p: Number(i.p),
    u: Number(i.u),
    m: Number(i.m),
    pieces: i.pieces ? Number(i.pieces) : null,
  }));
  const totals = items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      p: a.p + i.p,
      u: a.u + i.u,
      m: a.m + i.m,
    }),
    { kcal: 0, p: 0, u: 0, m: 0 },
  );

  const onConfirm = async () => {
    if (!name.trim()) {
      showToast("Unesi naziv obroka");
      return;
    }
    await createFavorite({
      user_id: user.id,
      name: name.trim(),
      meal,
      items,
      total_kcal: totals.kcal,
      total_p: totals.p,
      total_u: totals.u,
      total_m: totals.m,
    });
    closeModal();
    showToast(`Spremljeno: ${name}`);
    onSaved?.();
  };

  return (
    <Modal open onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        Spremi omiljeni obrok
      </div>
      <div className="text-[13px] mb-5" style={{ color: "var(--color-muted)" }}>
        Sprema sve namirnice iz odabranog obroka
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
        placeholder="npr. Moj doručak"
        className="mb-3"
      />
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Iz kojeg obroka?
      </div>
      <Dropdown
        value={meal}
        onChange={setMeal}
        options={MEAL_OPTIONS}
        variant="input"
        fullWidth
        wrapperClassName="mb-3"
        ariaLabel="Obrok"
      />
      <div
        className="bg-bg rounded-xl px-3 py-2.5 mb-4 text-xs"
        style={{ color: "var(--color-muted)" }}
      >
        {items.map((i, idx) => (
          <div key={idx} className="flex justify-between py-0.5">
            <span>{i.name}</span>
            <span
              className="font-semibold"
              style={{ color: "var(--color-navy)" }}
            >
              {Math.round(i.kcal)} kcal
            </span>
          </div>
        ))}
      </div>
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
            Spremi ♥
          </button>
        </div>
      </div>
    </Modal>
  );
}
