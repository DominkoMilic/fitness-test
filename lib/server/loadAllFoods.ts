import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FoodRow } from "@/types/database";

// Supabase PostgREST caps single-request reads at 1000 rows by default.
// Sheet sync (and any plan/diff logic) needs the COMPLETE row set or it
// silently misclassifies rows past row 1000 as "missing" → re-inserts.
// Paginate via .range() until the page comes back short.
const PAGE = 1000;

export async function loadAllFoods(
  supa: SupabaseClient<Database>,
  opts: { status?: "imported" | "new" | "archived" | "any" } = {},
): Promise<FoodRow[]> {
  const status = opts.status ?? "imported";
  const out: FoodRow[] = [];
  let from = 0;
  while (true) {
    let q = supa
      .from("foods")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (status !== "any") q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as FoodRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
