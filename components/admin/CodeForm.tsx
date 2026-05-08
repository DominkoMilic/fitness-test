"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { useUIStore } from "@/store/useUIStore";
import { createCode } from "@/lib/api/codes";

export function CodeForm({ onCreated }: { onCreated: () => void }) {
  const showToast = useUIStore((s) => s.showToast);
  const setLoading = useUIStore((s) => s.setLoading);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [goal, setGoal] = useState<number>(1500);

  const onSubmit = async () => {
    if (!code || !name || !exp) {
      showToast("Popuni sva polja");
      return;
    }
    setLoading(true);
    try {
      await createCode({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        exp,
        goal,
      });
      setCode("");
      setName("");
      setExp("");
      setGoal(1500);
      showToast(`Kod dodan: ${code}`);
      onCreated();
    } catch {
      showToast("Greška - kod možda već postoji");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kf-card bg-white rounded-2xl border border-border p-5 mb-4">
      <div
        className="text-sm font-extrabold mb-4"
        style={{ color: "var(--color-navy)" }}
      >
        Novi pristupni kod
      </div>
      <label
        htmlFor="admin-code"
        className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Pristupni kod
      </label>
      <Input
        id="admin-code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Kod (npr. ANA-2024)"
        maxLength={12}
        className="mb-3"
      />
      <label
        htmlFor="admin-name"
        className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Ime klijentice
      </label>
      <Input
        id="admin-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ime klijentice"
        className="mb-3"
      />
      <label
        htmlFor="admin-exp"
        className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Vrijedi do
      </label>
      <Input
        id="admin-exp"
        type="date"
        value={exp}
        onChange={(e) => setExp(e.target.value)}
        className="mb-3"
      />
      <label
        htmlFor="admin-goal"
        className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Dnevni kalorijski cilj (kcal)
      </label>
      <Input
        id="admin-goal"
        type="number"
        inputMode="numeric"
        value={goal === 0 ? "" : goal}
        onChange={(e) => setGoal(parseInt(e.target.value) || 0)}
        placeholder="Kalorijski cilj"
        className="mb-3"
      />
      <button
        onClick={onSubmit}
        className="w-full py-3 rounded-xl bg-linear-to-br from-orange to-orange-dark text-white font-bold text-sm"
      >
        Dodaj kod
      </button>
    </div>
  );
}
