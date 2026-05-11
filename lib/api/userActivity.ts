import type { ActivityStatus, UserActivityRow } from "@/types/database";

export type SortKey =
  | "name"
  | "current_streak"
  | "last_upload_at"
  | "inactivity_days"
  | "activity_status";

const STATUS_RANK: Record<ActivityStatus, number> = {
  red: 0,
  yellow: 1,
  active: 2,
};

/**
 * Read all users with their computed activity / streak data.
 * Status is computed server-side by `user_activity_view`. Admin-only —
 * fetched via /api/admin/user-activity which validates the admin cookie.
 */
export async function listUserActivity(): Promise<UserActivityRow[]> {
  const res = await fetch("/api/admin/user-activity", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }
  const body = (await res.json().catch(() => null)) as
    | { data: UserActivityRow[] }
    | null;
  return body?.data ?? [];
}

/** Pure client-side sort — view returns small admin-sized datasets. */
export function sortUserActivity(
  rows: UserActivityRow[],
  key: SortKey,
  dir: "asc" | "desc",
): UserActivityRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = pickSortValue(a, key);
    const bv = pickSortValue(b, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
}

function pickSortValue(
  row: UserActivityRow,
  key: SortKey,
): string | number | null {
  switch (key) {
    case "name":
      return row.name.toLowerCase();
    case "current_streak":
      return row.current_streak;
    case "last_upload_at":
      return row.last_upload_at ? Date.parse(row.last_upload_at) : null;
    case "inactivity_days":
      return row.inactivity_days;
    case "activity_status":
      return STATUS_RANK[row.activity_status];
  }
}
