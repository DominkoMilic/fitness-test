"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { BarcodeScanner } from "@/components/search/BarcodeScanner";
import { ConfirmPopup } from "@/components/ui/ConfirmPopup";
import { useFoods } from "@/hooks/useFoods";
import { useFoodSearch } from "@/hooks/useFoodSearch";
import {
  gramsToUnitQty,
  IngredientAddPanel,
  itemDisplayQty,
  reconcileItemQty,
  unitDropdownOptions,
  unitsForFood,
  unitShortLabel,
  type RecipeEditItem,
} from "@/components/modals/IngredientAmountFields";
import { getPieceInfo, type AmountUnit } from "@/lib/utils/macros";
import type { AiAnalysisItem, AiAnalysisResult, FoodEntry } from "@/types/app";
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

// Editable AI item = the shared recipe/favourite ingredient shape, so unit
// switching, quantity reconciliation and the add-ingredient panel behave
// exactly as they do in the recipe/favourite modals, plus the AI provenance.
type AiEditItem = RecipeEditItem & {
  source: AiAnalysisItem["source"];
  matchedFoodId: number | null;
};

// Resolve the database row behind an AI item. Match on the stored id first —
// the model writes its own names ("Umak od rajčice"), which need not equal the
// DB name — then fall back to an exact name match.
function findFood(
  id: number | null | undefined,
  name: string,
  foods: FoodEntry[],
): FoodEntry | null {
  if (id != null) {
    const byId = foods.find((f) => Number(f.id) === Number(id));
    if (byId) return byId;
  }
  return foods.find((f) => f.name === name) ?? null;
}

// Units an item may be measured in. A DB-backed item offers whatever the food
// supports (kom / šalica / žlice); a pure AI estimate has no such metadata, so
// grams only.
function unitsForAiItem(it: AiEditItem, foods: FoodEntry[]): AmountUnit[] {
  const food = findFood(it.matchedFoodId, it.name, foods);
  if (food) return unitsForFood(food);
  const units: AmountUnit[] = ["g"];
  if (it.pieceG) units.push("kom");
  return units;
}

// Switch unit while keeping grams (and macros) constant — only the displayed
// quantity changes. Mirrors changeItemUnit, but resolves the food by id.
function changeAiItemUnit(
  it: AiEditItem,
  unit: AmountUnit,
  foods: FoodEntry[],
): AiEditItem {
  const food = findFood(it.matchedFoodId, it.name, foods);
  if (!food) {
    const qty = gramsToUnitQty(it.grams, unit, it.pieceG);
    return { ...it, unit, qty, pieces: unit === "kom" ? qty : null };
  }
  const pieceG = getPieceInfo(food)?.g ?? food.piece_g ?? it.pieceG;
  const qty = gramsToUnitQty(it.grams, unit, pieceG);
  return { ...it, unit, qty, pieces: unit === "kom" ? qty : null, pieceG };
}

function mealByHour(): MealKey {
  const h = new Date().getHours();
  if (h < 11) return "dorucak";
  if (h < 16) return "rucak";
  if (h < 21) return "vecera";
  return "uzina";
}

function toEditItems(
  items: AiAnalysisItem[],
  foods: FoodEntry[],
): AiEditItem[] {
  return items.map((i) => {
    const grams = i.grams > 0 ? i.grams : 0;
    // Per-gram rates keep macros correct through any later unit/qty change.
    const per = grams > 0 ? 1 / grams : 0;
    const food = findFood(i.matchedFoodId, i.name, foods);
    const pieceG = getPieceInfo(food)?.g ?? food?.piece_g ?? null;
    return {
      name: i.name,
      grams,
      kcal: i.kcal,
      p: i.p,
      u: i.u,
      m: i.m,
      pieces: null,
      unit: "g" as AmountUnit,
      qty: grams,
      rKcal: i.kcal * per,
      rP: i.p * per,
      rU: i.u * per,
      rM: i.m * per,
      pieceG,
      source: i.source,
      matchedFoodId: i.matchedFoodId,
    };
  });
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
  const [editItems, setEditItems] = useState<AiEditItem[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Add-ingredient / barcode / remove-confirm state for the edit view.
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addFood, setAddFood] = useState<FoodEntry | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);

  const { foods } = useFoods();
  const { results: searchResults } = useFoodSearch(
    foods,
    addFood ? "" : addSearch,
    { limit: 8, minLength: 2 },
  );

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
    setShowAdd(false);
    setAddSearch("");
    setAddFood(null);
    setScanOpen(false);
    setPendingRemove(null);
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
    setEditItems(toEditItems(result.items, foods));
    setEditing(true);
  };

  const confirmRemove = () => {
    if (pendingRemove == null) return;
    setEditItems((prev) => prev.filter((_, i) => i !== pendingRemove));
    setPendingRemove(null);
  };

  const updateQty = (idx: number, val: number) => {
    setEditItems((prev) =>
      prev.map((it, i) =>
        i === idx ? ({ ...it, ...reconcileItemQty(it, val) } as AiEditItem) : it,
      ),
    );
  };

  const changeUnit = (idx: number, unit: AmountUnit) => {
    setEditItems((prev) =>
      prev.map((it, i) => (i === idx ? changeAiItemUnit(it, unit, foods) : it)),
    );
  };

  const resetAdd = () => {
    setShowAdd(false);
    setAddSearch("");
    setAddFood(null);
  };

  const selectFood = (food: FoodEntry) => {
    setAddFood(food);
    setAddSearch(food.name);
  };

  // A manually added ingredient comes straight from the database, so it is
  // marked "db". Only keep the id when the food really is a DB row — a scanned
  // barcode may resolve via OpenFoodFacts and carry a synthetic id.
  const onItemAdded = (item: RecipeEditItem) => {
    const id = addFood ? Number(addFood.id) : NaN;
    const isDbRow =
      Number.isFinite(id) && foods.some((f) => Number(f.id) === id);
    setEditItems((prev) => [
      ...prev,
      { ...item, source: "db", matchedFoodId: isDbRow ? id : null },
    ]);
    resetAdd();
  };

  // Scanned food flows into the same add path as a searched one.
  const onScanned = (food: FoodEntry) => {
    selectFood(food);
    setShowAdd(true);
    setScanOpen(false);
  };

  // Emptying a quantity field must not silently drop the row on save.
  const hasZeroQty = editItems.some((it) => !(it.grams > 0));

  // Current items to persist — from edit state if editing, else the result.
  const currentItems = (): AiAnalysisItem[] => {
    if (editing) {
      return editItems
        .filter((it) => it.name.trim() && it.grams > 0)
        .map((it) => ({
          name: it.name.trim(),
          grams: round1(it.grams),
          kcal: round1(it.kcal),
          p: round1(it.p),
          u: round1(it.u),
          m: round1(it.m),
          source: it.source,
          matchedFoodId: it.matchedFoodId,
        }));
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
    // Block instead of silently dropping rows whose quantity was cleared.
    if (editing && hasZeroQty) {
      showToast("Količina svake namirnice mora biti veća od 0");
      return;
    }
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
                  const units = unitsForAiItem(it, foods);
                  const zero = !(it.grams > 0);
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
                            onClick={() => setPendingRemove(idx)}
                            className="text-gray-300 text-lg w-6 h-6 flex items-center justify-center"
                            aria-label={`Ukloni ${it.name}`}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={String(itemDisplayQty(it))}
                          onChange={(e) =>
                            updateQty(idx, parseFloat(e.target.value) || 0)
                          }
                          onFocus={(e) => {
                            const input = e.currentTarget;
                            setTimeout(() => input.select(), 0);
                          }}
                          className="w-20 py-1.5! text-[13px]!"
                          aria-label={`Količina za ${it.name}`}
                        />
                        {units.length > 1 ? (
                          <Dropdown
                            value={it.unit}
                            onChange={(u) => changeUnit(idx, u)}
                            options={unitDropdownOptions(units)}
                            variant="pill"
                            ariaLabel={`Mjerna jedinica za ${it.name}`}
                          />
                        ) : (
                          <span
                            className="text-[11px]"
                            style={{ color: "var(--color-muted)" }}
                          >
                            {unitShortLabel(it.unit)}
                          </span>
                        )}
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--color-muted)" }}
                        >
                          {it.unit !== "g" && it.grams > 0
                            ? `≈ ${Math.round(it.grams)} g · `
                            : ""}
                          {Math.round(it.kcal)} kcal · P {Math.round(it.p)} / UH{" "}
                          {Math.round(it.u)} / M {Math.round(it.m)}
                        </span>
                      </div>
                      {zero && (
                        <div
                          className="text-[11px] font-bold mt-1"
                          style={{ color: "var(--color-orange)" }}
                        >
                          Količina mora biti veća od 0
                        </div>
                      )}
                    </div>
                  );
                })
              : result.items.map((it, idx) => (
                  <ItemRow key={idx} item={it} />
                ))}
            {editing && editItems.length === 0 && (
              <div
                className="text-[11px] text-center py-3"
                style={{ color: "var(--color-muted)" }}
              >
                Nema namirnica. Dodaj barem jednu.
              </div>
            )}
          </div>

          {/* Add more foods — same search + barcode flow as recipes/favourites */}
          {editing &&
            (showAdd ? (
              <div className="bg-bg rounded-xl px-3 py-2.5 mb-4 border border-dashed border-border">
                <div
                  className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: "var(--color-muted)" }}
                >
                  Pretraži namirnicu
                </div>
                <Input
                  value={addSearch}
                  onChange={(e) => {
                    setAddSearch(e.target.value);
                    setAddFood(null);
                  }}
                  placeholder="npr. piletina, skuta…"
                  className="mb-1"
                />
                {searchResults.length > 0 && (
                  <div className="bg-white rounded-xl border border-border mb-2 max-h-36 overflow-y-auto">
                    {searchResults.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => selectFood(f)}
                        className="w-full text-left px-3 py-2 text-xs border-b border-border last:border-b-0 hover:bg-blue-50"
                        style={{ color: "var(--color-navy)" }}
                      >
                        {f.name}
                        <span
                          className="ml-1.5 font-normal"
                          style={{ color: "var(--color-muted)" }}
                        >
                          {f.kcal} kcal/100g
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {addFood && (
                  <IngredientAddPanel
                    food={addFood}
                    onAdd={onItemAdded}
                    onCancel={resetAdd}
                  />
                )}
                {!addFood && (
                  <button
                    onClick={resetAdd}
                    className="text-[11px] underline mt-1"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Zatvori
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex-1 py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold"
                  style={{ color: "var(--color-muted)" }}
                >
                  + Dodaj namirnicu
                </button>
                <button
                  onClick={() => setScanOpen(true)}
                  className="flex-1 py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold"
                  style={{ color: "var(--color-muted)" }}
                >
                  Skeniraj barkod
                </button>
              </div>
            ))}

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
                  className="flex-1 py-3.5 rounded-xl border-[1.5px] border-[#b9c8e0] bg-[#e8edf6] text-navy hover:bg-[#d8e1f1] hover:border-[#8ea6cd] active:bg-[#c9d5ec] text-[15px] font-semibold disabled:opacity-50"
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
                  className="flex-1 py-3.5 rounded-xl border-[1.5px] border-[#b9c8e0] bg-[#e8edf6] text-navy hover:bg-[#d8e1f1] hover:border-[#8ea6cd] active:bg-[#c9d5ec] text-[14px] font-bold disabled:opacity-50"
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

      {/* Barcode scanner — nested modal, same pattern as the recipe modals. */}
      <Modal open={scanOpen} onClose={() => setScanOpen(false)}>
        <div
          className="text-base font-extrabold mb-3"
          style={{ color: "var(--color-navy)" }}
        >
          Skeniraj barkod
        </div>
        <BarcodeScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onResult={onScanned}
        />
      </Modal>

      {/* Removing a recognized food is destructive within the analysis, so
          confirm it rather than deleting on a single tap. */}
      <ConfirmPopup
        open={pendingRemove !== null}
        question={
          pendingRemove !== null && editItems[pendingRemove]
            ? `Ukloniti "${editItems[pendingRemove].name}" iz AI procjene?`
            : "Ukloniti namirnicu iz AI procjene?"
        }
        onClose={() => setPendingRemove(null)}
        button1={{
          text: "Ne",
          variant: "cancel",
          onClick: () => setPendingRemove(null),
        }}
        button2={{
          text: "Da, ukloni",
          variant: "orange",
          onClick: confirmRemove,
        }}
      />
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

      {/* Animated reveal, matching the inline editor in RecipeLogModal. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
            style={{ background: "var(--color-bg)" }}
          >
            <div
              className="px-3 pb-3 pt-1 text-[11px] leading-relaxed"
              style={{ color: "var(--color-muted)" }}
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
          </motion.div>
        )}
      </AnimatePresence>
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
