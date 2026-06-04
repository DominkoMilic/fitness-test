"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useUIStore } from "@/store/useUIStore";
import { effectiveGrams, macroForGrams, sumLogs } from "@/lib/utils/macros";
import { portionsLabel } from "@/lib/utils/groupLogs";
import { updateLog, deleteLog } from "@/lib/api/foodLogs";
import type { FoodLogRow } from "@/types/database";

type Payload = { groupId: string };

// Drill-in for a collapsed recipe card. Lists each food of the added
// recipe-portion; tap a food to expand an inline qty editor (mirrors
// EditFoodModal math), or delete it. Reads the live rows from `logs` so edits
// reflect immediately. Self-contained — no nested modal stacking.
//
// Only one row's editor is open at a time: editingId lives here, so opening a
// second food closes the first. The editor is a child that mounts only while
// open, so closing it discards any unsaved input.
export function RecipeLogModal({
  logs,
  onChanged,
}: {
  logs: FoodLogRow[];
  onChanged?: () => void;
}) {
  const modal = useUIStore((s) => s.modal);
  const payload = useUIStore((s) => s.modalPayload as Payload | null);
  const closeModal = useUIStore((s) => s.closeModal);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (modal !== "recipeLog" || !payload) return null;
  const items = logs.filter((l) => l.group_id === payload.groupId);
  // All rows deleted (or day switched) — nothing to show.
  if (items.length === 0) return null;

  const name = items[0].group_name || "Recept";
  const portions =
    items[0].group_portions == null ? null : Number(items[0].group_portions);
  const totals = sumLogs(items);
  const sub = portionsLabel(portions);

  return (
    <Modal open onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        {name}
      </div>
      <div className="text-[13px] mb-4" style={{ color: "var(--color-muted)" }}>
        {sub ? `${sub} · ` : ""}
        {items.length} {items.length === 1 ? "namirnica" : "namirnice"} ·{" "}
        <span style={{ color: "var(--color-orange)", fontWeight: 700 }}>
          {Math.round(totals.kcal)} kcal
        </span>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        {items.map((it) => (
          <FoodRow
            key={it.id}
            item={it}
            editing={editingId === it.id}
            onToggle={() =>
              setEditingId((cur) => (cur === it.id ? null : it.id))
            }
            onClose={() => setEditingId(null)}
            onChanged={onChanged}
          />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.25rem+env(safe-area-inset-bottom))] bg-white border-t border-border/70 mt-4">
        <button
          onClick={closeModal}
          className="w-full py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold"
        >
          Gotovo
        </button>
      </div>
    </Modal>
  );
}

function FoodRow({
  item,
  editing,
  onToggle,
  onClose,
  onChanged,
}: {
  item: FoodLogRow;
  editing: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const isPieces = item.pieces != null;

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteLog(item.id);
      showToast("Namirnica obrisana");
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const qtyLabel = isPieces
    ? `${item.pieces} kom (${Math.round(item.grams)}g)`
    : `${Math.round(item.grams)}g`;

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        onClick={() => !busy && onToggle()}
        className={`px-3.5 py-2.5 cursor-pointer transition-colors ${editing ? "bg-bg/60" : ""}`}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">{item.food_name}</div>
            <div
              className="text-[11px] mt-px"
              style={{ color: "var(--color-muted)" }}
            >
              {qtyLabel}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-bold whitespace-nowrap"
              style={{ color: "var(--color-navy)" }}
            >
              {Math.round(item.kcal)} kcal
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={busy}
              className="kf-icon-btn text-gray-300 text-lg w-7 h-7 flex items-center justify-center disabled:opacity-40"
              aria-label="Obriši"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex gap-2.5 mt-1">
          <Tag k="P" v={item.p} />
          <Tag k="UH" v={item.u} />
          <Tag k="M" v={item.m} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            key="editor"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden bg-bg/60"
          >
            <FoodEditor
              item={item}
              busy={busy}
              setBusy={setBusy}
              onClose={onClose}
              onChanged={onChanged}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mounted only while its row is open, so unsaved input is discarded on close.
function FoodEditor({
  item,
  busy,
  setBusy,
  onClose,
  onChanged,
}: {
  item: FoodLogRow;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const isPieces = item.pieces != null;
  const unit: "g" | "kom" = isPieces ? "kom" : "g";
  const [qtyStr, setQtyStr] = useState<string>(
    String(item.pieces ?? Number(item.grams)),
  );

  // Per-100g basis derived from the logged row, like EditFoodModal.
  const factor100 = Number(item.grams) > 0 ? 100 / Number(item.grams) : 1;
  const food = {
    id: `_edit_${item.id}`,
    name: item.food_name,
    kcal: Number(item.kcal) * factor100,
    p: Number(item.p) * factor100,
    u: Number(item.u) * factor100,
    m: Number(item.m) * factor100,
  };
  const editPieceG = isPieces ? Number(item.grams) / Number(item.pieces) : null;
  const qty = parseFloat(qtyStr.replace(",", ".")) || 0;
  const grams = effectiveGrams(qty, unit, food, editPieceG);
  const macros = macroForGrams(food, grams);

  const onSave = async () => {
    if (!qty || qty <= 0 || grams <= 0) {
      showToast("Količina mora biti veća od 0");
      return;
    }
    setBusy(true);
    try {
      await updateLog(item.id, {
        grams: Math.round(grams * 10) / 10,
        kcal: macros.kcal,
        p: macros.p,
        u: macros.u,
        m: macros.m,
        pieces: unit === "kom" ? qty : null,
      });
      showToast("Spremljeno");
      onClose();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-3.5 pb-3.5 pt-1">
      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        {unit === "kom" ? "Broj komada" : "Količina (g)"}
      </div>
      <Input
        type="number"
        inputMode="decimal"
        autoFocus
        value={qtyStr}
        onChange={(e) => setQtyStr(e.target.value)}
        onFocus={(e) => {
          const input = e.currentTarget;
          setTimeout(() => input.select(), 0);
        }}
        className="mb-2"
      />
      {unit === "kom" && editPieceG && (
        <div
          className="text-xs text-center mb-2"
          style={{ color: "var(--color-muted)" }}
        >
          1 kom ≈ {Math.round(editPieceG * 10) / 10}g
        </div>
      )}
      <div className="flex justify-between items-center bg-linear-to-br from-blue-50 to-indigo-100 rounded-xl px-3.5 py-2.5 mb-3">
        <span
          className="text-[12px] font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          Ukupno kalorija
        </span>
        <span
          className="text-[18px] font-extrabold"
          style={{ color: "var(--color-navy)" }}
        >
          {Math.round(macros.kcal)}
        </span>
      </div>
      <div className="flex gap-2.5">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border-[1.5px] border-border bg-bg text-[14px] font-semibold"
          style={{ color: "var(--color-muted)" }}
        >
          Odustani
        </button>
        <button
          onClick={onSave}
          disabled={busy}
          className="flex-2 py-2.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[14px] font-bold disabled:opacity-60"
        >
          Spremi
        </button>
      </div>
    </div>
  );
}

function Tag({ k, v }: { k: string; v: number }) {
  return (
    <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
      {k}: <span className="font-bold text-gray-700">{Math.round(v)}g</span>
    </span>
  );
}
