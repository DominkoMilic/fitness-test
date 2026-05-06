import type { FoodEntry } from "@/types/app";

const ENDPOINT = "https://world.openfoodfacts.org/api/v0/product";

export async function lookupBarcode(barcode: string): Promise<FoodEntry | null> {
  const res = await fetch(`${ENDPOINT}/${barcode}.json`);
  const data = await res.json();
  if (data.status !== 1) return null;
  const n = data.product.nutriments ?? {};
  return {
    id: Date.now(),
    name: data.product.product_name || `Proizvod ${barcode}`,
    kcal: Math.round(n["energy-kcal_100g"] || 0),
    p: Math.round(n.proteins_100g || 0),
    u: Math.round(n.carbohydrates_100g || 0),
    m: Math.round(n.fat_100g || 0),
  };
}
