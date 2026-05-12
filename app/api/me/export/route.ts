import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/utils/requireUser";

// GDPR Article 15 — Right of Access. Returns all data associated with the
// authenticated user as a downloadable JSON file.
export async function GET() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;
  const { uid } = guard;

  const supa = getSupabaseAdmin();
  const [account, logs, favs, history] = await Promise.all([
    supa.from("codes").select("*").eq("id", uid).limit(1),
    supa.from("food_logs").select("*").eq("user_id", uid),
    supa.from("favorites").select("*").eq("user_id", uid),
    supa.from("search_history").select("*").eq("user_id", uid),
  ]);

  if (account.error || logs.error || favs.error || history.error) {
    const msg =
      account.error?.message ||
      logs.error?.message ||
      favs.error?.message ||
      history.error?.message ||
      "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    schema_version: 1,
    account: account.data?.[0] ?? null,
    food_logs: logs.data ?? [],
    favorites: favs.data ?? [],
    search_history: history.data ?? [],
  };

  const filename = `kresimir-fit-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
