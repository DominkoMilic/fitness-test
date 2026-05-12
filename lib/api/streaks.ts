// Server-mediated streak bump. Replaces direct supabase.rpc("bump_streak").
// The /api/me/logs and /api/me/logs/bulk routes already invoke the RPC
// server-side when inserting, so most call sites no longer need to call
// this fn. Kept for backwards compatibility + edge cases.

export type StreakBumpResult = {
  current_streak: number | null;
  last_upload_date: string | null;
};

export async function bumpUploadStreak(
  _userId: string,
  opts: { rethrow?: boolean } = {},
): Promise<StreakBumpResult | null> {
  try {
    const res = await fetch("/api/me/streak", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) {
      if (opts.rethrow) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || `Streak bump failed: ${res.status}`);
      }
      return null;
    }
    const body = (await res.json()) as { data: StreakBumpResult | null };
    return body.data ?? null;
  } catch (e) {
    if (opts.rethrow) throw e;
    return null;
  }
}

export async function bumpUploadStreaks(userIds: string[]) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  // Server derives the actual user from cookie; we just need to fire once.
  if (unique.length) await bumpUploadStreak(unique[0]);
}
