import type { DropdownOption } from "@/components/ui/Dropdown";
import type { ActivityStatus, UserActivityRow } from "@/types/database";

// -----------------------------------------------------------------------------
// Filter / sort
// -----------------------------------------------------------------------------

export type UserFilter = "active" | "deactivated";

export type ActivitySort = "most" | "least";

export const ACTIVITY_SORT_OPTIONS: readonly DropdownOption<ActivitySort>[] = [
  { value: "most", label: "Najaktivniji" },
  { value: "least", label: "Najmanje aktivni" },
];

function inactivityScore(c: UserActivityRow): number {
  // null last_upload → treat as highest inactivity.
  if (c.inactivity_days == null) return Number.POSITIVE_INFINITY;
  return c.inactivity_days;
}

export function sortByActivity(
  rows: UserActivityRow[],
  dir: ActivitySort,
): UserActivityRow[] {
  const factor = dir === "most" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = inactivityScore(a);
    const bv = inactivityScore(b);
    if (av !== bv) return (av - bv) * factor;
    // Tie-breaker: higher streak first when "most" active, reverse otherwise.
    return (b.current_streak - a.current_streak) * factor;
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

export const PAGE_SIZE = 5;

const STATE_KEY = "kf_admin_list_state";
export const SCROLL_KEY = "kf_admin_list_scroll";

export type PersistedState = {
  page: number;
  filter: UserFilter;
  sort: ActivitySort;
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
