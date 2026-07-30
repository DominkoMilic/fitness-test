"use client";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { useUIStore } from "@/store/useUIStore";
import { prepareImage } from "@/lib/ai/image";
import { analyzeMeal, type AnalyzeResponse } from "@/lib/api/aiMeals";
import { MEAL_OPTIONS } from "@/lib/constants/meals";
import type { AiAnalysisItem, AiAnalysisResult } from "@/types/app";
import type { MealKey } from "@/types/database";

// Step 3 — analysis + guard. Calls the model: non-food input shows the
// hardcoded off-topic message; food shows the recognized result (read-only)
// with a meal picker. The two action buttons exist but only echo "hrana" —
// saving to the diary is wired up in the next branches.
const MAX_TEXT = 300;

type Step = "input" | "loading" | "result" | "offtopic" | "error";

function mealByHour(): MealKey {
  const h = new Date().getHours();
  if (h < 11) return "dorucak";
  if (h < 16) return "rucak";
  if (h < 21) return "vecera";
  return "uzina";
}

export function AiMealModal() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const open = modal === "aiMeal";

  const [step, setStep] = useState<Step>("input");
  const [prepared, setPrepared] = useState<{ base64: string; mime: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [meal, setMeal] = useState<MealKey>("dorucak");
  const [message, setMessage] = useState("");

  const cameraRef = useRef<HTMLInputElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setStep("input");
    setPrepared(null);
    setPreview(null);
    setText("");
    setResult(null);
    setMeal(mealByHour());
    setMessage("");
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

  const runAnalyze = async () => {
    if (!prepared && !text.trim()) {
      showToast("Priložite fotografiju ili opis");
      return;
    }
    setStep("loading");
    setMessage("");
    try {
      const res: AnalyzeResponse = await analyzeMeal({
        imageBase64: prepared?.base64,
        mime: prepared?.mime,
        text: text.trim() || undefined,
      });
      if ("offTopic" in res && res.offTopic) {
        setMessage(res.message);
        setStep("offtopic");
        return;
      }
      setResult((res as { result: AiAnalysisResult }).result);
      setStep("result");
    } catch (e) {
      setMessage((e as Error).message || "AI analiza nije uspjela");
      setStep("error");
    }
  };

  // Placeholder for both result buttons until diary-saving is implemented.
  const echoHrana = () => showToast("hrana");

  return (
    <Modal open={open} onClose={closeModal}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ai_assistant_image.png"
        alt=""
        aria-hidden="true"
        className="absolute top-4 right-4 w-11 h-11 rounded-full object-cover shadow-sm"
      />
      <div
        className="text-base font-extrabold mb-1 pr-14"
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

      {/* ── input ── */}
      {step === "input" && (
        <>
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
                className="py-4 rounded-xl border-[1.5px] border-[#c3d1e8] bg-[#eef3fc] text-navy hover:bg-[#e0e9f8] hover:border-[#90a9d6] active:bg-[#d6e0f2] text-[13px] font-bold flex flex-col items-center gap-1.5"
                style={{ color: "var(--color-navy)" }}
              >
                <span className="text-xl">📷</span>
                Slikaj
              </button>
              <button
                onClick={() => uploadRef.current?.click()}
                className="py-4 rounded-xl border-[1.5px] border-[#c3d1e8] bg-[#eef3fc] text-navy hover:bg-[#e0e9f8] hover:border-[#90a9d6] active:bg-[#d6e0f2] text-[13px] font-bold flex flex-col items-center gap-1.5"
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

          <StickyFooter>
            <button
              onClick={closeModal}
              className="flex-1 py-3.5 rounded-xl border-[1.5px] border-[#b9c8e0] bg-[#e8edf6] text-navy hover:bg-[#d8e1f1] hover:border-[#8ea6cd] active:bg-[#c9d5ec] text-[15px] font-semibold"
            >
              Odustani
            </button>
            <button
              onClick={runAnalyze}
              disabled={!prepared && !text.trim()}
              className="flex-2 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold disabled:opacity-40"
            >
              Analiziraj
            </button>
          </StickyFooter>
        </>
      )}

      {/* ── loading ── */}
      {step === "loading" && (
        <div className="py-14 flex flex-col items-center gap-3">
          <div
            className="w-9 h-9 rounded-full border-[3px] border-t-transparent animate-spin"
            style={{ borderColor: "var(--color-navy)", borderTopColor: "transparent" }}
          />
          <div className="text-sm font-semibold" style={{ color: "var(--color-muted)" }}>
            AI analizira obrok...
          </div>
        </div>
      )}

      {/* ── off-topic / error ── */}
      {(step === "offtopic" || step === "error") && (
        <>
          <div
            className="my-4 px-4 py-4 rounded-xl text-[13px] leading-relaxed"
            style={{
              background: "rgba(255,138,0,0.08)",
              color: "var(--color-navy)",
              border: "1px solid rgba(255,138,0,0.35)",
            }}
          >
            {message}
          </div>
          <StickyFooter>
            <button
              onClick={() => setStep("input")}
              className="flex-1 py-3.5 rounded-xl border-[1.5px] border-[#b9c8e0] bg-[#e8edf6] text-navy hover:bg-[#d8e1f1] hover:border-[#8ea6cd] active:bg-[#c9d5ec] text-[15px] font-semibold"
              style={{ color: "var(--color-navy)" }}
            >
              Natrag
            </button>
            <button
              onClick={closeModal}
              className="flex-1 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold"
            >
              Zatvori
            </button>
          </StickyFooter>
        </>
      )}

      {/* ── result (read-only) ── */}
      {step === "result" && result && (
        <>
          <div
            className="text-[15px] font-extrabold mb-1"
            style={{ color: "var(--color-navy)" }}
          >
            {result.title}
          </div>
          <div
            className="mb-3 px-3 py-2 rounded-lg text-[11px] leading-snug flex items-start gap-1.5"
            style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}
          >
            <span>ℹ️</span>
            <span>
              AI procjena — nije 100% točna, služi kao pomoć. Vrijednosti iz
              baze koriste se kad je namirnica prepoznata.
            </span>
          </div>

          <div className="flex justify-between items-center bg-linear-to-br from-blue-50 to-indigo-100 rounded-xl px-3.5 py-3 mb-1.5">
            <span className="text-[13px] font-semibold" style={{ color: "var(--color-muted)" }}>
              Ukupno kalorija
            </span>
            <span className="text-[22px] font-extrabold" style={{ color: "var(--color-navy)" }}>
              {Math.round(result.totals.kcal)}
            </span>
          </div>
          {result.kcalMin != null && result.kcalMax != null && (
            <div className="text-[11px] text-center mb-3" style={{ color: "var(--color-muted)" }}>
              AI raspon: ~{result.kcalMin}–{result.kcalMax} kcal
            </div>
          )}
          <div className="flex gap-2 mb-4">
            <MacroBox name="Proteini" v={result.totals.p} />
            <MacroBox name="Ugljik." v={result.totals.u} />
            <MacroBox name="Masti" v={result.totals.m} />
          </div>

          <div
            className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--color-muted)" }}
          >
            Namirnice
          </div>
          <div className="rounded-xl border border-border overflow-hidden mb-4">
            {result.items.map((it, idx) => (
              <ItemRow key={idx} item={it} />
            ))}
          </div>

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

          <StickyFooter>
            <button
              onClick={echoHrana}
              className="flex-1 py-3.5 rounded-xl border-[1.5px] border-[#b9c8e0] bg-[#e8edf6] text-navy hover:bg-[#d8e1f1] hover:border-[#8ea6cd] active:bg-[#c9d5ec] text-[14px] font-bold"
              style={{ color: "var(--color-navy)" }}
            >
              Uredi pa dodaj
            </button>
            <button
              onClick={echoHrana}
              className="flex-1 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[14px] font-bold"
            >
              Dodaj odmah
            </button>
          </StickyFooter>
        </>
      )}
    </Modal>
  );
}

function StickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.25rem+env(safe-area-inset-bottom))] bg-white border-t border-border/70">
      <div className="flex gap-2.5">{children}</div>
    </div>
  );
}

// One recognized food. Tapping it expands the provenance: which database
// entry was used (or that the value is a model estimate), the per-100g basis,
// and the arithmetic that produced the total — so the numbers are never an
// unexplained black box.
function ItemRow({ item }: { item: AiAnalysisItem }) {
  const [open, setOpen] = useState(false);
  const isDb = item.source === "db";
  const per100 = item.per100;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left px-3 py-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold truncate">{item.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <SourceBadge source={item.source} />
            <span
              className="text-[13px] font-bold whitespace-nowrap"
              style={{ color: "var(--color-navy)" }}
            >
              {Math.round(item.kcal)} kcal
            </span>
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              style={{ color: "var(--color-muted)" }}
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: "var(--color-muted)" }}>
          {Math.round(item.grams)} g · P {Math.round(item.p)} / UH{" "}
          {Math.round(item.u)} / M {Math.round(item.m)}
        </div>
      </button>

      {open && (
        <div
          className="px-3 pb-3 pt-1 text-[11px] leading-relaxed"
          style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}
        >
          {isDb ? (
            <p className="mb-1.5">
              Vrijednosti su uzete iz baze, iz unosa{" "}
              <b style={{ color: "var(--color-navy)" }}>
                {item.matchedFoodName ?? "—"}
              </b>
              .
            </p>
          ) : (
            <p className="mb-1.5">
              Ova namirnica nije pronađena u bazi, pa je vrijednost{" "}
              <b style={{ color: "var(--color-orange)" }}>AI procjena</b> na
              temelju fotografije/opisa. Zato je manje pouzdana — provjerite je
              i po potrebi uredite.
            </p>
          )}
          {per100 && (
            <>
              <div>
                Na 100 g: <b>{Math.round(per100.kcal)} kcal</b> · P{" "}
                {Math.round(per100.p)} / UH {Math.round(per100.u)} / M{" "}
                {Math.round(per100.m)}
              </div>
              <div>
                Izračun: {Math.round(per100.kcal)} kcal × {Math.round(item.grams)}{" "}
                g / 100 = <b>{Math.round(item.kcal)} kcal</b>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: AiAnalysisItem["source"] }) {
  const isDb = source === "db";
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
      style={{
        background: isDb ? "rgba(27,50,85,0.08)" : "rgba(255,138,0,0.12)",
        color: isDb ? "var(--color-navy)" : "var(--color-orange)",
      }}
    >
      {isDb ? "baza" : "AI"}
    </span>
  );
}

function MacroBox({ name, v }: { name: string; v: number }) {
  return (
    <div className="flex-1 bg-bg rounded-xl py-2 text-center border border-border">
      <div className="text-[15px] font-extrabold" style={{ color: "var(--color-navy)" }}>
        {Math.round(v)}g
      </div>
      <div className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--color-muted)" }}>
        {name}
      </div>
    </div>
  );
}
