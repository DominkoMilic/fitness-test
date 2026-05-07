import { parseCSV } from "@/lib/utils/csv";
import { listImportedFoodNames } from "./foods";
import type { FoodInsert } from "@/types/database";

const SHEET_ID = process.env.NEXT_PUBLIC_SYNC_SHEET_ID!;
const SHEET_GID = process.env.NEXT_PUBLIC_SYNC_SHEET_GID!;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

const normalizeHeader = (value: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const normalizeName = (value: string) =>
  (value || "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeRowId = (value: string) => (value || "").trim().toLowerCase();

function pickValue(row: Record<string, string>, aliases: string[]): string {
  const wanted = aliases.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    const normalized = normalizeHeader(key);
    if (wanted.includes(normalized)) return row[key] || "";
  }
  return "";
}

type ParsedSheetRow = {
  name: string;
  sheetRowId: string;
  food: FoodInsert;
};

function parseSheetRows(rawCsv: string): ParsedSheetRow[] {
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

  const num = (v: string) => parseFloat(String(v || "").replace(",", ".")) || 0;
  const numOrNull = (v: string) => {
    const s = String(v || "").trim();
    if (!s) return null;
    const n = parseFloat(s.replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };

  return items
    .map((row) => {
      const status = pickValue(row, ["Status", "Stanje", "Aktivno"])
        .trim()
        .toLowerCase();
      const name = pickValue(row, ["Ime namirnice", "Naziv", "Name"]).trim();
      if (!name) return null;

      const isImportableStatus =
        status === "" || status === "new" || status === "imported";
      if (!isImportableStatus) return null;

      const explicitSheetRowId = pickValue(row, [
        "sheet_row_id",
        "sheet row id",
        "row id",
        "id",
      ]).trim();

      const food: FoodInsert = {
        name,
        category: pickValue(row, ["Kategorija", "Category"]).trim() || null,
        kcal_per_100g: num(
          pickValue(row, ["kcal/100g", "kcal", "kcal100g", "kalorije"]),
        ),
        protein: num(pickValue(row, ["Protein", "Proteini"])),
        carbs: num(
          pickValue(row, ["Ugljikohidrati", "UH", "Carbs", "Carbohydrates"]),
        ),
        fat: num(pickValue(row, ["Masti", "Fat", "Fats"])),
        piece_name:
          pickValue(row, [
            "Komad (naziv)",
            "Komad",
            "Piece",
            "Piece name",
          ]).trim() || null,
        piece_weight_g: numOrNull(
          pickValue(row, ["Težina komada (g)", "Piece weight", "Piece g"]),
        ),
        status: "imported",
        added_by: pickValue(row, ["Dodao", "Added by"]).trim() || null,
        sheet_row_id: explicitSheetRowId || null,
      };

      return {
        name: normalizeName(name),
        sheetRowId: normalizeRowId(explicitSheetRowId),
        food,
      };
    })
    .filter((x): x is ParsedSheetRow => x !== null);
}

export type SheetSyncPlan = {
  newFoods: FoodInsert[];
  keepNames: string[];
  keepRowIds: string[];
};

export async function fetchSheetSyncPlan(): Promise<SheetSyncPlan> {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Sheet nedostupan (${res.status})`);
  const parsedRows = parseSheetRows(await res.text());
  if (parsedRows.length === 0) {
    return { newFoods: [], keepNames: [], keepRowIds: [] };
  }

  const existing = await listImportedFoodNames();

  const keepNames = new Set<string>();
  const keepRowIds = new Set<string>();
  const newFoods: FoodInsert[] = [];

  for (const row of parsedRows) {
    keepNames.add(row.name);
    if (row.sheetRowId) keepRowIds.add(row.sheetRowId);
    if (!existing.has(row.name)) newFoods.push(row.food);
  }

  return {
    newFoods,
    keepNames: Array.from(keepNames),
    keepRowIds: Array.from(keepRowIds),
  };
}

export async function fetchNewSheetFoods(): Promise<FoodInsert[]> {
  const plan = await fetchSheetSyncPlan();
  return plan.newFoods;
}
