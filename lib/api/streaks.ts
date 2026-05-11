import { supabase } from "@/lib/supabase/client";

/**
 * Result of the `bump_streak` RPC. `null` values mean the user_id was not
 * found server-side (we silently ignore — the upload still succeeded).
 */
export type StreakBumpResult = {
  current_streak: number | null;
  last_upload_date: string | null;
};

/**
 * Increment the upload streak for a user.
 *
 * Idempotent within a calendar day (Europe/Zagreb): calling repeatedly the
 * same day does not inflate the streak. Safe to call on every upload.
 *
 * Errors are swallowed by default because the streak is observability data,
 * not part of the upload's critical path. Pass { rethrow: true } if you want
 * the caller to handle failures.
 */
export async function bumpUploadStreak(
  userId: string,
  opts: { rethrow?: boolean } = {},
): Promise<StreakBumpResult | null> {
  if (!userId) return null;
  const { data, error } = await supabase.rpc("bump_streak", {
    p_user_id: userId,
  });
  if (error) {
    if (opts.rethrow) throw error;
    if (typeof console !== "undefined") {
      console.warn("bumpUploadStreak failed", error.message);
    }
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    current_streak:
      typeof row.current_streak === "number" ? row.current_streak : null,
    last_upload_date:
      typeof row.last_upload_date === "string" ? row.last_upload_date : null,
  };
}

/** Bump streaks for many users (e.g. bulk insert of favorite-meal items). */
export async function bumpUploadStreaks(userIds: string[]) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  await Promise.all(unique.map((id) => bumpUploadStreak(id)));
}
