"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useDayStore } from "@/store/useDayStore";
import { dateForOffset } from "@/lib/utils/date";
import { MEAL_NAMES, MEAL_OPTIONS } from "@/lib/constants/meals";
import { insertLog } from "@/lib/api/foodLogs";
import type { MealKey } from "@/types/database";

const DEFAULT_NAME = "Ručno unesene kalorije";

type Payload = { defaultMeal?: MealKey };

export function ManualKcalModal({ onAdded }: { onAdded?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const offset = useDayStore((s) => s.offset);

  const [kcalStr, setKcalStr] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [meal, setMeal] = useState<MealKey>("dorucak");
  const [lastPayload, setLastPayload] = useState<Payload | null>(null);

  if (modal === "manualKcal" && payload !== lastPayload) {
    setLastPayload(payload);
    setKcalStr("");
    setName("");
    setMeal(payload?.defaultMeal ?? "dorucak");
  } else if (modal !== "manualKcal" && lastPayload) {
    setLastPayload(null);
  }

  if (modal !== "manualKcal") return null;
  const kcal = parseFloat(kcalStr) || 0;

  const onConfirm = async () => {
    if (!user) return;
    if (!kcal || kcal <= 0) {
      showToast("Unesi broj kalorija veći od 0");
      return;
    }
    const finalName = name.trim() || DEFAULT_NAME;
    const finalKcal = Math.round(kcal);
    closeModal();
    showToast(`${finalName} dodano u: ${MEAL_NAMES[meal]}`);
    try {
      await insertLog({
        user_id: user.id,
        date: dateForOffset(offset),
        meal,
        food_name: finalName,
        grams: 0,
        kcal: finalKcal,
        p: 0,
        u: 0,
        m: 0,
        pieces: null,
      });
      onAdded?.();
    } catch {
      showToast("Greška pri spremanju");
    }
  };

  return (
    <Modal open onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        Ručno unesi kalorije
      </div>
      <div className="text-[13px] mb-5" style={{ color: "var(--color-muted)" }}>
        Za obroke izvan baze (npr. restoran).
      </div>

      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Kalorije (kcal)
      </div>
      <Input
        type="number"
        inputMode="numeric"
        autoFocus
        value={kcalStr}
        onChange={(e) => setKcalStr(e.target.value)}
        placeholder="0"
        className="mb-3"
      />

      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Naziv (neobavezno)
      </div>
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={DEFAULT_NAME}
        maxLength={80}
        className="mb-4"
      />

      {payload?.defaultMeal ? (
        <div
          className="mb-4 px-3.5 py-2.5 rounded-xl bg-bg text-[13px] font-semibold flex items-center justify-between"
          style={{ color: "var(--color-navy)" }}
        >
          <span style={{ color: "var(--color-muted)" }}>Obrok</span>
          <span>{MEAL_NAMES[payload.defaultMeal]}</span>
        </div>
      ) : (
        <>
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
        </>
      )}

      <div
        className="text-[11px] mb-4 leading-snug"
        style={{ color: "var(--color-muted)" }}
      >
        Proteini, ugljikohidrati i masti se ne računaju (0g).
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
            Dodaj
          </button>
        </div>
      </div>
    </Modal>
  );
}
