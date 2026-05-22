// Week helpers — Croatian locale, Monday-first.

export const WEEKDAY_SHORT_HR = [
  "Pon",
  "Uto",
  "Sri",
  "Čet",
  "Pet",
  "Sub",
  "Ned",
] as const;

export const WEEKDAY_LONG_HR = [
  "Ponedjeljak",
  "Utorak",
  "Srijeda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedjelja",
] as const;

/** Returns midnight Monday at the start of the week that contains `d`. */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** YYYY-MM-DD in local time (not UTC) to avoid TZ-induced day shifts. */
export function formatLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "11.5." — used inside the week header day cells. */
export function formatDayShortHR(d: Date): string {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

/** "11.5.2026." — used in the week range label. */
export function formatDayLongHR(d: Date): string {
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
}

/** Builds the 7-day range [Mon..Sun] containing `d`. */
export function weekDays(d: Date): Date[] {
  const start = startOfWeekMonday(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
