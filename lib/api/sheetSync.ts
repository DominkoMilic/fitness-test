import { parseCSV } from "@/lib/utils/csv";
import { listImportedFoodNames } from "./foods";
import type { FoodInsert } from "@/types/database";

const SHEET_ID = process.env.NEXT_PUBLIC_SYNC_SHEET_ID!;
const SHEET_GID = process.env.NEXT_PUBLIC_SYNC_SHEET_GID!;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

export async function fetchNewSheetFoods(): Promise<FoodInsert[]> {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Sheet nedostupan (${res.status})`);
  const rows = parseCSV(await res.text());
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

  const existing = await listImportedFoodNames();
  const num = (v: string) => parseFloat(String(v || "").replace(",", ".")) || 0;
  const numOrNull = (v: string) => {
    const s = String(v || "").trim();
    if (!s) return null;
    const n = parseFloat(s.replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };

  return items
    .map((row, idx) => {
      const status = (row["Status"] || "").trim().toLowerCase();
      const name = (row["Ime namirnice"] || "").trim();
      if (!name) return null;
      if (status !== "imported" && status !== "new") return null;
      if (existing.has(name.toLowerCase())) return null;
      const out: FoodInsert = {
        name,
        category: row["Kategorija"] || null,
        kcal_per_100g: num(row["kcal/100g"]),
        protein: num(row["Protein"]),
        carbs: num(row["Ugljikohidrati"]),
        fat: num(row["Masti"]),
        piece_name: row["Komad (naziv)"]?.trim() || null,
        piece_weight_g: numOrNull(row["Težina komada (g)"]),
        status: "imported",
        added_by: row["Dodao"]?.trim() || null,
        sheet_row_id: `row_${idx + 2}`,
      };
      return out;
    })
    .filter((x): x is FoodInsert => x !== null);
}
