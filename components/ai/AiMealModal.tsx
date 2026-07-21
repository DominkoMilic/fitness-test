"use client";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useDayStore } from "@/store/useDayStore";
import { dateForOffset } from "@/lib/utils/date";
import { MEAL_NAMES, MEAL_OPTIONS } from "@/lib/constants/meals";
import { emitLogsChanged } from "@/lib/api/foodLogs";
import { prepareImage } from "@/lib/ai/image";
import {
  analyzeMeal,
  saveAnalysis,
  type AnalyzeResponse,
} from "@/lib/api/aiMeals";
import type { AiAnalysisItem, AiAnalysisResult } from "@/types/app";
import type { MealKey } from "@/types/database";

const round1 = (n: number) => Math.round(n * 10) / 10;
const MAX_TEXT = 300;

// Shown for any server/model/network failure so raw internals never reach the
// user. Deliberate, user-actionable Croatian messages from the API (rate
// limit, image too large, unsupported format, "odaberite obrok", …) are kept
// as-is; only technical errors are replaced.
const GENERIC_ERROR =
  "Došlo je do pogreške na serveru. Već radimo na popravku, molimo pokušajte ponovno za koji trenutak.";

const TECHNICAL_ERROR =
  /(HTTP\b|\b5\d\d\b|Gemini|fetch|Failed|Unauthorized|Request failed|permission denied|non-JSON|models?\s+failed|timeout|network|ECONN|TypeError)/i;

function friendlyError(e: unknown): string {
  const msg = (e as Error)?.message?.trim();
  if (!msg) return GENERIC_ERROR;
  return TECHNICAL_ERROR.test(msg) ? GENERIC_ERROR : msg;
}

type Step = "input" | "loading" | "result" | "offtopic" | "error";

// Editable item carries a per-100g basis so grams edits recompute macros the
// same way the rest of the app does (macroForGrams).
type EditItem = {
  name: string;
  gramsStr: string;
  source: AiAnalysisItem["source"];
  matchedFoodId: number | null;
  per100: { kcal: number; p: number; u: number; m: number };
};

function mealByHour(): MealKey {
  const h = new Date().getHours();
  if (h < 11) return "dorucak";
  if (h < 16) return "rucak";
  if (h < 21) return "vecera";
  return "uzina";
}

function toEditItems(items: AiAnalysisItem[]): EditItem[] {
  return items.map((i) => {
    const g = i.grams > 0 ? i.grams : 0;
    const per100 =
      g > 0
        ? {
            kcal: (i.kcal / g) * 100,
            p: (i.p / g) * 100,
            u: (i.u / g) * 100,
            m: (i.m / g) * 100,
          }
        : { kcal: i.kcal, p: i.p, u: i.u, m: i.m };
    return {
      name: i.name,
      gramsStr: String(i.grams),
      source: i.source,
      matchedFoodId: i.matchedFoodId,
      per100,
    };
  });
}

function macrosForEdit(it: EditItem) {
  const g = Math.max(0, parseFloat(it.gramsStr) || 0);
  const r = g / 100;
  return {
    grams: round1(g),
    kcal: round1(it.per100.kcal * r),
    p: round1(it.per100.p * r),
    u: round1(it.per100.u * r),
    m: round1(it.per100.m * r),
  };
}

export function AiMealModal() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const offset = useDayStore((s) => s.offset);

  const open = modal === "aiMeal";

  const [step, setStep] = useState<Step>("input");
  const [prepared, setPrepared] = useState<{ base64: string; mime: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [title, setTitle] = useState("");
  const [meal, setMeal] = useState<MealKey>("dorucak");
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const cameraRef = useRef<HTMLInputElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  // Reset all state on the closed→open transition. Render-phase adjustment
  // (guarded by `wasOpen`) mirrors the other modals and avoids setState-in-
  // effect cascades.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setStep("input");
    setPrepared(null);
    setPreview(null);
    setText("");
    setResult(null);
    setTitle("");
    setMeal(mealByHour());
    setEditing(false);
    setEditItems([]);
    setMessage("");
    setSaving(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // NOTE: intentionally NOT returning null when closed — keeping <Modal>
  // mounted lets its AnimatePresence play the slide-down/fade exit. Modal
  // itself renders nothing while open=false.

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
      const r = (res as { result: AiAnalysisResult }).result;
      setResult(r);
      setTitle(r.title);
      setStep("result");
    } catch (e) {
      setMessage(friendlyError(e));
      setStep("error");
    }
  };

  const startEditing = () => {
    if (!result) return;
    setEditItems(toEditItems(result.items));
    setEditing(true);
  };

  const removeEditItem = (idx: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const setEditGrams = (idx: number, v: string) => {
    setEditItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, gramsStr: v } : it)),
    );
  };

  // Current items to persist — from edit state if editing, else the result.
  const currentItems = (): AiAnalysisItem[] => {
    if (editing) {
      return editItems
        .filter((it) => it.name.trim() && (parseFloat(it.gramsStr) || 0) > 0)
        .map((it) => {
          const m = macrosForEdit(it);
          return {
            name: it.name.trim(),
            grams: m.grams,
            kcal: m.kcal,
            p: m.p,
            u: m.u,
            m: m.m,
            source: it.source,
            matchedFoodId: it.matchedFoodId,
          };
        });
    }
    return result?.items ?? [];
  };

  const totals = (() => {
    return currentItems().reduce(
      (acc, i) => ({
        kcal: round1(acc.kcal + i.kcal),
        p: round1(acc.p + i.p),
        u: round1(acc.u + i.u),
        m: round1(acc.m + i.m),
      }),
      { kcal: 0, p: 0, u: 0, m: 0 },
    );
  })();

  const doSave = async () => {
    if (!user || !result) return;
    const items = currentItems();
    if (items.length === 0) {
      showToast("Nema stavki za spremanje");
      return;
    }
    setSaving(true);
    try {
      await saveAnalysis({
        date: dateForOffset(offset),
        meal,
        title: title.trim() || result.title,
        items,
        kcalMin: result.kcalMin,
        kcalMax: result.kcalMax,
        confidence: result.confidence,
        model: result.model,
        addToDiary: true,
      });
      emitLogsChanged();
      closeModal();
      showToast(`AI obrok dodan u: ${MEAL_NAMES[meal]}`);
    } catch (e) {
      showToast(friendlyError(e));
      setSaving(false);
    }
  };

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

      {/* Hidden file inputs */}
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

      {/* ── Step: input ─────────────────────────────────────────── */}
      {step === "input" && (
        <>
          <div
            className="text-[13px] mb-4"
            style={{ color: "var(--color-muted)" }}
          >
            Slikaj obrok ili učitaj fotografiju. AI procjenjuje namirnice i
            približne kalorije kao pomoć pri unosu.
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
                className="py-4 rounded-xl kf-tile text-[13px] font-bold flex flex-col items-center gap-1.5"
                style={{ color: "var(--color-navy)" }}
              >
                <span className="text-xl">📷</span>
                Slikaj
              </button>
              <button
                onClick={() => uploadRef.current?.click()}
                className="py-4 rounded-xl kf-tile text-[13px] font-bold flex flex-col items-center gap-1.5"
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
              className="flex-1 py-3.5 rounded-xl kf-btn-secondary text-[15px] font-semibold"
              style={{ color: "var(--color-muted)" }}
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

      {/* ── Step: loading ───────────────────────────────────────── */}
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

      {/* ── Step: off-topic / error ─────────────────────────────── */}
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
              className="flex-1 py-3.5 rounded-xl kf-btn-secondary text-[15px] font-semibold"
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

      {/* ── Step: result ────────────────────────────────────────── */}
      {step === "result" && result && (
        <>
          {editing ? (
            <>
              <div
                className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--color-muted)" }}
              >
                Naziv obroka
              </div>
              <Input
                type="text"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                className="mb-3"
              />
            </>
          ) : (
            <div
              className="text-[15px] font-extrabold mb-1"
              style={{ color: "var(--color-navy)" }}
            >
              {title || result.title}
            </div>
          )}

          {/* Disclaimer + confidence */}
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
          {result.confidence === "low" && (
            <div
              className="mb-3 px-3 py-2 rounded-lg text-[11px] font-bold"
              style={{
                background: "rgba(255,138,0,0.1)",
                color: "var(--color-orange)",
              }}
            >
              Niska sigurnost procjene — provjerite vrijednosti prije spremanja.
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-between items-center bg-linear-to-br from-blue-50 to-indigo-100 rounded-xl px-3.5 py-3 mb-1.5">
            <span
              className="text-[13px] font-semibold"
              style={{ color: "var(--color-muted)" }}
            >
              Ukupno kalorija
            </span>
            <span
              className="text-[22px] font-extrabold"
              style={{ color: "var(--color-navy)" }}
            >
              {Math.round(totals.kcal)}
            </span>
          </div>
          {result.kcalMin != null && result.kcalMax != null && (
            <div
              className="text-[11px] text-center mb-3"
              style={{ color: "var(--color-muted)" }}
            >
              AI raspon: ~{result.kcalMin}–{result.kcalMax} kcal
            </div>
          )}
          <div className="flex gap-2 mb-4">
            <MacroBox name="Proteini" v={totals.p} />
            <MacroBox name="Ugljik." v={totals.u} />
            <MacroBox name="Masti" v={totals.m} />
          </div>

          {/* Items */}
          <div
            className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--color-muted)" }}
          >
            Namirnice
          </div>
          <div className="rounded-xl border border-border overflow-hidden mb-4">
            {editing
              ? editItems.map((it, idx) => {
                  const m = macrosForEdit(it);
                  return (
                    <div
                      key={idx}
                      className="px-3 py-2.5 border-b border-border last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold truncate">
                          {it.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <SourceBadge source={it.source} />
                          <button
                            onClick={() => removeEditItem(idx)}
                            className="text-gray-300 text-lg w-6 h-6 flex items-center justify-center"
                            aria-label="Ukloni"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={it.gramsStr}
                          onChange={(e) => setEditGrams(idx, e.target.value)}
                          className="w-24 py-1.5! text-[13px]!"
                          aria-label={`Grami za ${it.name}`}
                        />
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--color-muted)" }}
                        >
                          g · {Math.round(m.kcal)} kcal · P {Math.round(m.p)} / UH{" "}
                          {Math.round(m.u)} / M {Math.round(m.m)}
                        </span>
                      </div>
                    </div>
                  );
                })
              : result.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2.5 border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold truncate">
                        {it.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <SourceBadge source={it.source} />
                        <span
                          className="text-[13px] font-bold whitespace-nowrap"
                          style={{ color: "var(--color-navy)" }}
                        >
                          {Math.round(it.kcal)} kcal
                        </span>
                      </div>
                    </div>
                    <div
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {Math.round(it.grams)} g · P {Math.round(it.p)} / UH{" "}
                      {Math.round(it.u)} / M {Math.round(it.m)}
                    </div>
                  </div>
                ))}
          </div>

          {/* Meal */}
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
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-xl kf-btn-secondary text-[15px] font-semibold disabled:opacity-50"
                  style={{ color: "var(--color-muted)" }}
                >
                  Natrag
                </button>
                <button
                  onClick={doSave}
                  disabled={saving}
                  className="flex-2 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[15px] font-bold disabled:opacity-50"
                >
                  {saving ? "Spremam..." : "Spremi u dnevnik"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startEditing}
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-xl kf-btn-secondary text-[14px] font-bold disabled:opacity-50"
                  style={{ color: "var(--color-navy)" }}
                >
                  Uredi pa dodaj
                </button>
                <button
                  onClick={doSave}
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-xl bg-linear-to-br from-navy to-[#162844] text-white text-[14px] font-bold disabled:opacity-50"
                >
                  {saving ? "Spremam..." : "Dodaj odmah"}
                </button>
              </>
            )}
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
      <div
        className="text-[15px] font-extrabold"
        style={{ color: "var(--color-navy)" }}
      >
        {Math.round(v)}g
      </div>
      <div
        className="text-[10px] font-semibold mt-0.5"
        style={{ color: "var(--color-muted)" }}
      >
        {name}
      </div>
    </div>
  );
}
