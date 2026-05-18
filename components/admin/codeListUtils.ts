import type { ActivityStatus, UserActivityRow } from "@/types/database";

// -----------------------------------------------------------------------------
// Filter / sort
// -----------------------------------------------------------------------------

export type UserFilter = "active" | "deactivated";

export function sortByNewest(rows: UserActivityRow[]): UserActivityRow[] {
  return [...rows].sort((a, b) => {
    const av = a.created_at ? Date.parse(a.created_at) : 0;
    const bv = b.created_at ? Date.parse(b.created_at) : 0;
    return bv - av;
  });
}

// -----------------------------------------------------------------------------
// Row styling
// -----------------------------------------------------------------------------

export const ROW_STYLE: Record<ActivityStatus, { row: string; icon: string }> =
  {
    active: { row: "", icon: "" },
    yellow: {
      row: "bg-amber-50 border-amber-200 hover:bg-amber-100 active:bg-amber-200",
      icon: "text-amber-600",
    },
    red: {
      row: "bg-rose-50 border-rose-200 hover:bg-rose-100 active:bg-rose-200",
      icon: "text-rose-600",
    },
  };

// -----------------------------------------------------------------------------
// Date formatting
// -----------------------------------------------------------------------------

export function formatExpireDateHR(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${Number(day)}.${Number(month)}.${year}.`;
}

// -----------------------------------------------------------------------------
// Pagination / persistence
// -----------------------------------------------------------------------------

export const PAGE_SIZE = 20;

const STATE_KEY = "kf_admin_list_state";
export const SCROLL_KEY = "kf_admin_list_scroll";

export type PersistedState = {
  page: number;
  filter: UserFilter;
  query: string;
};

export function readPersistedState(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : {};
  } catch {
    return {};
  }
}

export function writePersistedState(s: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* quota / disabled — ignore */
  }
}
