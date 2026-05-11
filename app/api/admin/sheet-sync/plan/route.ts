import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";
import {
  computePlan,
  fetchSheetCsv,
  parseSheet,
} from "@/lib/server/sheetSyncCore";

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const [csv, dbRows] = await Promise.all([
      fetchSheetCsv(),
      (async () => {
        const supa = getSupabaseAdmin();
        const { data, error } = await supa
          .from("foods")
          .select("*")
          .eq("status", "imported");
        if (error) throw new Error(error.message);
        return data ?? [];
      })(),
    ]);

    const parsed = parseSheet(csv);
    const plan = computePlan(parsed, dbRows);
    return NextResponse.json({ plan }, { headers: { "Cache-Control": "no-store" } });
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
