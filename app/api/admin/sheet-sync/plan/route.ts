import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";
import {
  computePlan,
  fetchSheetCsv,
  parseSheet,
} from "@/lib/server/sheetSyncCore";
import { loadAllFoods } from "@/lib/server/loadAllFoods";

// Sheet fetch + parse can spike on slow upstream. Lift over default 10 s.
export const maxDuration = 60;

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const supa = getSupabaseAdmin();
    const [csv, dbRows] = await Promise.all([
      fetchSheetCsv(),
      // PAGINATED — Supabase caps single-request reads at 1000. Without
      // this, planner mis-classified row 1001+ as INSERTs because they
      // appeared "missing" from DB.
      loadAllFoods(supa, { status: "imported" }),
    ]);

    const parsed = parseSheet(csv);
    const plan = computePlan(parsed, dbRows);

    // Diagnostics — surfaces counts to UI so admin can spot drift
    // (e.g. parsed != dbRows + inserts - deletes ⇒ something's off).
    const diagnostics = {
      sheetRowsParsed: parsed.length,
      dbRowsImported: dbRows.length,
    };

    return NextResponse.json(
      { plan, diagnostics },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Greška pri izradi sync plana",
      },
      { status: 500 },
    );
  }
}
