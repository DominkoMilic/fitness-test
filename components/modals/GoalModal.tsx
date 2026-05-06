"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";

export function GoalModal() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const setGoal = useAuthStore((s) => s.setGoal);
  const [val, setVal] = useState<number>(1500);

  useEffect(() => {
    if (modal === "goal") setVal(user?.goal ?? 1500);
  }, [modal, user]);

  if (modal !== "goal") return null;

  const onSave = async () => {
    if (val < 500 || val > 5000) {
      showToast("Unesi vrijednost između 500 i 5000");
      return;
    }
    await setGoal(val);
    closeModal();
    showToast(`Cilj promijenjen: ${val} kcal`);
  };

  return (
    <Modal open onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        Promijeni dnevni cilj
      </div>
      <div className="text-[13px] mb-5" style={{ color: "var(--color-muted)" }}>
        Unesi novi kalorijski cilj
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
        value={val}
        onChange={(e) => setVal(parseInt(e.target.value) || 0)}
        className="mb-4 text-2xl text-center tracking-widest"
      />
      <div className="flex gap-2.5">
        <button
          onClick={closeModal}
          className="flex-1 py-3.5 rounded-xl border-[1.5px] border-border bg-[var(--color-bg)] text-[15px] font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          Odustani
        </button>
        <button
          onClick={onSave}
          className="flex-[2] py-3.5 rounded-xl bg-gradient-to-br from-[#1b3255] to-[#162844] text-white text-[15px] font-bold"
        >
          Spremi
        </button>
      </div>
    </Modal>
  );
}
