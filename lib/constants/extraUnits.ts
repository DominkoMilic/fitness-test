// Universal volume units offered when a food has `has_extra_units = true`.
// Gram values are fixed app-wide; per-food overrides are not supported by
// design (per product spec).

export type ExtraUnit = "salica" | "jusna_zlica" | "cajna_zlica";

export const EXTRA_UNIT_G: Record<ExtraUnit, number> = {
  salica: 200,
  jusna_zlica: 16,
  cajna_zlica: 6,
};

type Forms = { singular: string; paucal: string; plural: string };

export const EXTRA_UNIT_FORMS: Record<ExtraUnit, Forms> = {
  salica: {
    singular: "Šalica / čaša",
    paucal: "Šalice / čaše",
    plural: "Šalice / čaše",
  },
  jusna_zlica: {
    singular: "Jušna žlica",
    paucal: "Jušne žlice",
    plural: "Jušnih žlica",
  },
  cajna_zlica: {
    singular: "Čajna žlica",
    paucal: "Čajne žlice",
    plural: "Čajnih žlica",
  },
};

// Order: largest first → preferred when deriving display from grams.
export const EXTRA_UNITS_ORDERED: ExtraUnit[] = [
  "salica",
  "jusna_zlica",
  "cajna_zlica",
];
