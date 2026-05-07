const HR_MONTHS = [
  "siječanj",
  "veljača",
  "ožujak",
  "travanj",
  "svibanj",
  "lipanj",
  "srpanj",
  "kolovoz",
  "rujan",
  "listopad",
  "studeni",
  "prosinac",
] as const;

const HR_MONTHS_GENITIVE = [
  "siječnja",
  "veljače",
  "ožujka",
  "travnja",
  "svibnja",
  "lipnja",
  "srpnja",
  "kolovoza",
  "rujna",
  "listopada",
  "studenoga",
  "prosinca",
] as const;

export function croatianMonthYear(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${HR_MONTHS[date.getMonth()]} ${date.getFullYear()}.`;
}

export function croatianFullDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()}. ${HR_MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}.`;
}
