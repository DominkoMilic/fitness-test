/**
 * Backfill foods.normalized_name for every existing row.
 *
 * Safe to run repeatedly: only writes rows whose stored normalized value
 * does not match the freshly-computed one. The DB trigger already keeps
 * new writes in sync — this script exists for:
 *   • initial rollout (1k+ existing rows)
 *   • normalization-rule changes (run again to recompute everything)
 *   • paranoid post-import verification
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL = "<url>"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<key>"
 *   npx tsx scripts/backfill-normalized-names.ts
 *
 * Or via package.json: `npm run db:backfill-normalized`
 *
 * Batched (default 500 rows/page) to stay well under Supabase row limits
 * and to keep memory flat even at 100k+ rows. Logs progress per batch.
 */

import { createClient } from "@supabase/supabase-js";
import { normalizeForSearch } from "../lib/utils/normalize";
import type { Database } from "../types/database";

const PAGE_SIZE = 500;
const UPDATE_CHUNK = 100;

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    console.error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
    process.exit(1);
  }

  const supa = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count, error: countError } = await supa
    .from("foods")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error("Count failed:", countError.message);
    process.exit(1);
  }

  const total = count ?? 0;
  console.log(`[backfill] foods total = ${total}`);
  if (!total) return;

  let processed = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let from = 0;

  while (from < total) {
    const to = Math.min(from + PAGE_SIZE - 1, total - 1);
    const { data: page, error } = await supa
      .from("foods")
      .select("id, name, normalized_name")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      console.error(`[backfill] read ${from}..${to} failed:`, error.message);
      failed += to - from + 1;
      from = to + 1;
      continue;
    }
    if (!page || !page.length) break;

    const dirty: { id: number; normalized_name: string }[] = [];
    for (const row of page) {
      const next = normalizeForSearch(row.name);
      if (next === row.normalized_name) {
        unchanged++;
      } else {
        dirty.push({ id: row.id, normalized_name: next });
      }
    }

    // Batched UPDATE — Supabase has no bulk-by-id update, so issue
    // single-row updates in small parallel chunks.
    for (let i = 0; i < dirty.length; i += UPDATE_CHUNK) {
      const chunk = dirty.slice(i, i + UPDATE_CHUNK);
      const results = await Promise.all(
        chunk.map((row) =>
          supa
            .from("foods")
            .update({ normalized_name: row.normalized_name })
            .eq("id", row.id),
        ),
      );
      for (const r of results) {
        if (r.error) failed++;
        else updated++;
      }
    }

    processed += page.length;
    console.log(
      `[backfill] ${processed}/${total}  (updated=${updated}, unchanged=${unchanged}, failed=${failed})`,
    );
    from = to + 1;
  }

  console.log(
    `[backfill] done: total=${total} updated=${updated} unchanged=${unchanged} failed=${failed}`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
