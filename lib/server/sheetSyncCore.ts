import "server-only";
import { parseCSV } from "@/lib/utils/csv";
import { normalizeForSearch } from "@/lib/utils/normalize";
import { normalizeBarcode } from "@/lib/barcode/normalize";
import type { FoodInsert, FoodRow } from "@/types/database";
import type {
  ApplyResult,
  FoodDelete,
  FoodUpdatePatch,
  SheetDuplicate,
  SheetSyncPlan,
} from "@/types/sheetSync";

export type {
  ApplyResult,
  FoodDelete,
  FoodUpdatePatch,
  SheetDuplicate,
  SheetSyncPlan,
};

const SHEET_ID = process.env.NEXT_PUBLIC_SYNC_SHEET_ID;
const SHEET_GID = process.env.NEXT_PUBLIC_SYNC_SHEET_GID;

function csvUrl(): string {
  if (!SHEET_ID || !SHEET_GID) {
    throw new Error(
      "Nedostaje NEXT_PUBLIC_SYNC_SHEET_ID / NEXT_PUBLIC_SYNC_SHEET_GID u .env.local",
    );
  }
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
}

// ----- Normalization helpers -----------------------------------------------

const normalizeHeader = (value: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export const normalizeName = (value: string) =>
  (value || "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeRowId = (value: string | null | undefined) =>
  (value || "").trim();

function pickValue(row: Record<string, string>, aliases: string[]): string {
  const wanted = aliases.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    const normalized = normalizeHeader(key);
    if (wanted.includes(normalized)) return row[key] || "";
  }
  return "";
}

const toNum = (v: string) =>
  parseFloat(String(v || "").replace(",", ".")) || 0;

const toNumOrNull = (v: string) => {
  const s = String(v || "").trim();
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

const toBoolDa = (v: string): boolean =>
  String(v || "")
    .trim()
    .toLowerCase() === "da";

// ----- Types ---------------------------------------------------------------

export type SheetParsedRow = {
  normalizedName: string;
  sheetRowId: string | null;
  food: FoodInsert;
};

// ----- CSV fetch + parse ---------------------------------------------------

export async function fetchSheetCsv(): Promise<string> {
  const res = await fetch(csvUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet nedostupan (${res.status})`);
  return res.text();
}

export function parseSheet(rawCsv: string): SheetParsedRow[] {
  const rows = parseCSV(rawCsv);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const items = rows
    .slice(1)
    .filter((r) => r.some((c) => c && c.trim()))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
      return obj;
    });

  return items
    .map((row): SheetParsedRow | null => {
      const status = pickValue(row, ["Status", "Stanje", "Aktivno"])
        .trim()
        .toLowerCase();

      const isImportable =
        status === "" || status === "new" || status === "imported";
      if (!isImportable) return null;

      const name = pickValue(row, ["Ime namirnice", "Naziv", "Name"]).trim();
      if (!name) return null;

      const sheetRowId =
        normalizeRowId(
          pickValue(row, ["sheet_row_id", "sheet row id", "row id", "id"]),
        ) || null;

      const rawBarcode = pickValue(row, [
        "Bar kod",
        "Barkod",
        "Barcode",
        "EAN",
        "UPC",
      ]);
      const cleanBarcode = normalizeBarcode(rawBarcode);

      const food: FoodInsert = {
        name,
        // Defense-in-depth: DB trigger also fills this on insert/update,
        // but we set it explicitly so the planner / diff sees the canonical
        // value and so any path that bypasses the trigger still gets it.
        normalized_name: normalizeForSearch(name),
        // null when empty so the partial unique index never sees blanks.
        barcode: cleanBarcode ? cleanBarcode : null,
        category: pickValue(row, ["Kategorija", "Category"]).trim() || null,
        kcal_per_100g: toNum(
          pickValue(row, ["kcal/100g", "kcal", "kcal100g", "kalorije"]),
        ),
        protein: toNum(pickValue(row, ["Protein", "Proteini"])),
        carbs: toNum(
          pickValue(row, ["Ugljikohidrati", "UH", "Carbs", "Carbohydrates"]),
        ),
        fat: toNum(pickValue(row, ["Masti", "Fat", "Fats"])),
        piece_name:
          pickValue(row, [
            "Komad (naziv)",
            "Komad",
            "Piece",
            "Piece name",
          ]).trim() || null,
        piece_weight_g: toNumOrNull(
          pickValue(row, ["Težina komada (g)", "Piece weight", "Piece g"]),
        ),
        status: "imported",
        added_by: pickValue(row, ["Dodao", "Added by"]).trim() || null,
        sheet_row_id: sheetRowId,
        has_cup: toBoolDa(pickValue(row, ["Šalica", "Salica", "Cup"])),
        has_spoons: toBoolDa(
          pickValue(row, ["Žlice", "Zlice", "Spoons"]),
        ),
      };

      return {
        normalizedName: normalizeName(name),
        sheetRowId,
        food,
      };
    })
    .filter((x): x is SheetParsedRow => x !== null);
}

// ----- Diff ----------------------------------------------------------------

const DIFFABLE_KEYS = [
  "name",
  "category",
  "kcal_per_100g",
  "protein",
  "carbs",
  "fat",
  "piece_name",
  "piece_weight_g",
  "added_by",
  "sheet_row_id",
  "has_cup",
  "has_spoons",
  "barcode",
] as const;

function valuesEqual(a: unknown, b: unknown): boolean {
  // Treat null / empty string as equal so trim differences don't trigger
  // pointless updates.
  const norm = (v: unknown) => (v === "" || v == null ? null : v);
  const na = norm(a);
  const nb = norm(b);
  if (typeof na === "number" && typeof nb === "number") {
    return Math.abs(na - nb) < 1e-9;
  }
  return na === nb;
}

function diffFood(db: FoodRow, sheet: FoodInsert): Partial<FoodInsert> {
  const patch: Partial<FoodInsert> = {};
  for (const key of DIFFABLE_KEYS) {
    const dbVal = db[key as keyof FoodRow];
    const sheetVal = sheet[key as keyof FoodInsert];
    if (!valuesEqual(dbVal, sheetVal)) {
      // Type-narrow: assign through the FoodInsert key.
      (patch as Record<string, unknown>)[key] = sheetVal;
    }
  }
  return patch;
}

// ----- Plan computation ----------------------------------------------------

export function computePlan(
  parsedRows: SheetParsedRow[],
  dbRows: FoodRow[],
): SheetSyncPlan {
  // Indexes on DB rows
  const dbById = new Map<string, FoodRow>();
  const dbByName = new Map<string, FoodRow>();
  for (const row of dbRows) {
    if (row.sheet_row_id) dbById.set(row.sheet_row_id, row);
    dbByName.set(normalizeName(row.name), row);
  }

  const usedDbIds = new Set<number>();
  const toInsert: FoodInsert[] = [];
  const toUpdate: FoodUpdatePatch[] = [];
  const duplicates: SheetDuplicate[] = [];
  let unchangedCount = 0;

  // Track first-seen sheet identities so subsequent duplicates can be
  // reported (and skipped from inserts/updates).
  const seenNames = new Set<string>();
  const seenSheetIds = new Set<string>();

  for (const sheet of parsedRows) {
    // Duplicate detection — first occurrence wins, the rest are flagged.
    if (sheet.sheetRowId && seenSheetIds.has(sheet.sheetRowId)) {
      duplicates.push({
        name: sheet.food.name,
        sheetRowId: sheet.sheetRowId,
        reason: "sheet_row_id",
      });
      continue;
    }
    if (seenNames.has(sheet.normalizedName)) {
      duplicates.push({
        name: sheet.food.name,
        sheetRowId: sheet.sheetRowId,
        reason: "name",
      });
      continue;
    }
    seenNames.add(sheet.normalizedName);
    if (sheet.sheetRowId) seenSheetIds.add(sheet.sheetRowId);

    let match: FoodRow | null = null;

    // 1) Primary match: stable sheet_row_id
    if (sheet.sheetRowId && dbById.has(sheet.sheetRowId)) {
      const candidate = dbById.get(sheet.sheetRowId)!;
      if (!usedDbIds.has(candidate.id)) match = candidate;
    }

    // 2) Fallback match by normalized name — but only when there's no
    // sheet_row_id collision (both have ids, different values → treat as
    // separate entities). When sheet has no id, allow name match (may be
    // backfilling an id assignment).
    if (!match) {
      const candidate = dbByName.get(sheet.normalizedName);
      if (candidate && !usedDbIds.has(candidate.id)) {
        const sameId =
          !candidate.sheet_row_id ||
          !sheet.sheetRowId ||
          candidate.sheet_row_id === sheet.sheetRowId;
        if (sameId) match = candidate;
      }
    }

    if (match) {
      usedDbIds.add(match.id);
      const patch = diffFood(match, sheet.food);
      if (Object.keys(patch).length === 0) {
        unchangedCount++;
      } else {
        toUpdate.push({
          id: match.id,
          oldName: match.name,
          newName: sheet.food.name,
          nameChanged:
            normalizeName(match.name) !== normalizeName(sheet.food.name),
          patch,
        });
      }
    } else {
      toInsert.push(sheet.food);
    }
  }

  const toDelete: FoodDelete[] = [];
  for (const row of dbRows) {
    if (!usedDbIds.has(row.id)) toDelete.push({ id: row.id, name: row.name });
  }

  return { toInsert, toUpdate, toDelete, unchangedCount, duplicates };
}
