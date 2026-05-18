import type { FoodEntry } from "@/types/app";
import { normalizeBarcode } from "@/lib/barcode/normalize";

const ENDPOINT = "https://world.openfoodfacts.org/api/v0/product";

export async function lookupBarcode(
  barcode: string,
): Promise<FoodEntry | null> {
  const norm = normalizeBarcode(barcode);
  if (!norm) return null;
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${encodeURIComponent(norm)}.json`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as
    | {
        status?: number;
        product?: {
          product_name?: string;
          nutriments?: Record<string, number | undefined>;
        };
      }
    | null;
  if (!data || data.status !== 1 || !data.product) return null;
  const n = data.product.nutriments ?? {};
  return {
    id: Date.now(),
    name: data.product.product_name || `Proizvod ${norm}`,
    kcal: Math.round(Number(n["energy-kcal_100g"] ?? 0)),
    p: Math.round(Number(n.proteins_100g ?? 0)),
    u: Math.round(Number(n.carbohydrates_100g ?? 0)),
    m: Math.round(Number(n.fat_100g ?? 0)),
  };
}
