const DAYS = ["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"];
const MONTHS = ["sij", "velj", "ožu", "tra", "svi", "lip", "srp", "kol", "ruj", "lis", "stu", "pro"];

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function dateForOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

export function dayLabels(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const formatted = `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  let label = DAYS[d.getDay()];
  if (offset === 0) label = "Danas";
  else if (offset === -1) label = "Jučer";
  else if (offset === 1) label = "Sutra";
  const headerDate = offset === 0
    ? `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`
    : formatted;
  return { label, formatted, headerDate, isToday: offset === 0 };
}
