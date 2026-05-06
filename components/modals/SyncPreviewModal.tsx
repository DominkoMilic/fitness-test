"use client";
import { Modal } from "@/components/ui/Modal";
import { useUIStore } from "@/store/useUIStore";
import { insertFoods, clearFoodsCache } from "@/lib/api/foods";
import type { FoodInsert } from "@/types/database";

type Payload = { foods: FoodInsert[] };

export function SyncPreviewModal({ onDone }: { onDone?: () => void }) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const setLoading = useUIStore((s) => s.setLoading);

  if (modal !== "syncPreview" || !payload) return null;
  const foods = payload.foods;

  const onConfirm = async () => {
    setLoading(true);
    try {
      const { ok, fail } = await insertFoods(foods);
      clearFoodsCache();
      try {
        localStorage.setItem("kf_last_sync", new Date().toISOString());
      } catch {}
      closeModal();
      if (fail === 0) showToast(`Sinkronizirano: ${ok} novih namirnica`);
      else
        showToast(`Sinkronizirano ${ok} od ${ok + fail}, neuspješno: ${fail}`);
      onDone?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={closeModal} className="max-h-[85vh] flex flex-col">
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        Pronađeno {foods.length} novih namirnica
      </div>
      <div className="text-[13px] mb-4" style={{ color: "var(--color-muted)" }}>
        {foods.length === 0
          ? "Nema novih namirnica za sinkronizaciju."
          : "Provjeri popis prije nego potvrdiš."}
      </div>
      <div className="overflow-y-auto flex-1 mb-4 max-h-[50vh]">
        {foods.map((f, idx) => {
          const piece =
            f.piece_name && f.piece_weight_g
              ? ` · 1 ${f.piece_name} = ${f.piece_weight_g}g`
              : "";
          return (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-3.5 border-b border-border last:border-b-0"
            >
              <div className="text-xs font-semibold">{f.name}</div>
              <div
                className="text-[11px]"
                style={{ color: "var(--color-muted)" }}
              >
                {f.kcal_per_100g} kcal · P:{f.protein}g · U:{f.carbs}g · M:
                {f.fat}g{piece}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={closeModal}
          className="flex-1 py-3.5 rounded-xl border-[1.5px] border-border bg-[var(--color-bg)] text-[15px] font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          Odustani
        </button>
        {foods.length > 0 && (
          <button
            onClick={onConfirm}
            className="flex-[2] py-3.5 rounded-xl bg-gradient-to-br from-[#1b3255] to-[#162844] text-white text-[15px] font-bold"
          >
            Sinkroniziraj sve
          </button>
        )}
      </div>
    </Modal>
  );
}
