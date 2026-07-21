"use client";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useUIStore } from "@/store/useUIStore";
import { prepareImage } from "@/lib/ai/image";

// Step 2 — input capture. User can take/upload a photo (downscaled + previewed)
// and/or type a description. "Analiziraj" is not wired to the model yet — that
// arrives in the next branch. The two result buttons don't exist here.
const MAX_TEXT = 300;

export function AiMealModal() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const open = modal === "aiMeal";

  const [prepared, setPrepared] = useState<{ base64: string; mime: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");

  const cameraRef = useRef<HTMLInputElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  // Reset on the closed→open transition (render-phase, guarded).
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setPrepared(null);
    setPreview(null);
    setText("");
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const prep = await prepareImage(file);
      setPrepared(prep);
      setPreview(`data:${prep.mime};base64,${prep.base64}`);
    } catch {
      showToast("Neispravna slika");
    }
  };

  const onAnalyze = () => {
    if (!prepared && !text.trim()) {
      showToast("Priložite fotografiju ili opis");
      return;
    }
    // Not wired to the model yet.
    showToast("Analiza dolazi u sljedećem koraku");
  };

  return (
    <Modal open={open} onClose={closeModal}>
      <div
        className="text-base font-extrabold mb-1"
        style={{ color: "var(--color-navy)" }}
      >
        AI prepoznavanje obroka
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="text-[13px] mb-4" style={{ color: "var(--color-muted)" }}>
        Slikaj obrok ili učitaj fotografiju, po želji dodaj kratak opis.
      </div>

      {preview ? (
        <div className="relative mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Pregled obroka"
            className="w-full max-h-64 object-cover rounded-xl"
          />
          <button
            onClick={() => {
              setPreview(null);
              setPrepared(null);
            }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
            aria-label="Ukloni sliku"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <button
            onClick={() => cameraRef.current?.click()}
            className="py-4 rounded-xl border-[1.5px] border-dashed border-border bg-bg text-[13px] font-bold flex flex-col items-center gap-1.5"
            style={{ color: "var(--color-navy)" }}
          >
            <span className="text-xl">📷</span>
            Slikaj
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            className="py-4 rounded-xl border-[1.5px] border-dashed border-border bg-bg text-[13px] font-bold flex flex-col items-center gap-1.5"
            style={{ color: "var(--color-navy)" }}
          >
            <span className="text-xl">🖼️</span>
            Učitaj
          </button>
        </div>
      )}

      <div
        className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-muted)" }}
      >
        Opis (neobavezno)
      </div>
      <Input
        type="text"
        value={text}
        maxLength={MAX_TEXT}
        onChange={(e) => setText(e.target.value)}
        placeholder="npr. bolonjez, velika porcija"
        className="mb-5"
      />

      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.25rem+env(safe-area-inset-bottom))] bg-white border-t border-border/70">
        <div className="flex gap-2.5">
          <button
            onClick={closeModal}
            className="flex-1 py-3.5 rounded-xl kf-btn-secondary text-[15px] font-semibold"
            style={{ color: "var(--color-muted)" }}
          >
            Odustani
          </button>
          <button
            onClick={onAnalyze}
            disabled={!prepared && !text.trim()}
            className="flex-2 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold disabled:opacity-40"
          >
            Analiziraj
          </button>
        </div>
      </div>
    </Modal>
  );
}
