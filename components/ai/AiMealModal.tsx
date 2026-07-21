"use client";
import { Modal } from "@/components/ui/Modal";
import { useUIStore } from "@/store/useUIStore";

// Step 1 — modal shell only. Opens from the FAB and closes with the shared
// slide/fade animation. No capture, analysis, or diary logic yet; those land
// in later branches.
export function AiMealModal() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);
  const open = modal === "aiMeal";

  return (
    <Modal open={open} onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        AI prepoznavanje obroka
      </div>
      <div className="text-[13px] mb-6" style={{ color: "var(--color-muted)" }}>
        Uskoro: slikaj obrok ili opiši ga, a AI će procijeniti kalorije i
        makronutrijente. Za sada je dostupan samo prikaz.
      </div>

      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.25rem+env(safe-area-inset-bottom))] bg-white border-t border-border/70">
        <button
          onClick={closeModal}
          className="w-full py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold"
        >
          Zatvori
        </button>
      </div>
    </Modal>
  );
}
