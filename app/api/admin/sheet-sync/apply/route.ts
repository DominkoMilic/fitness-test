import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";
import type {
  ApplyResult,
  FoodDelete,
  FoodUpdatePatch,
  SheetSyncPlan,
} from "@/types/sheetSync";
import type { FoodInsert } from "@/types/database";

type ApplyBody = { plan?: SheetSyncPlan };

function isPlan(value: unknown): value is SheetSyncPlan {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.toInsert) &&
    Array.isArray(v.toUpdate) &&
    Array.isArray(v.toDelete) &&
    typeof v.unchangedCount === "number" &&
    Array.isArray(v.duplicates)
  );
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard) return guard;

  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.plan || !isPlan(body.plan)) {
    return NextResponse.json(
      { error: "Plan nedostaje ili je neispravan oblik" },
      { status: 400 },
    );
  }

  const { toInsert, toUpdate, toDelete } = body.plan;
  const supa = getSupabaseAdmin();

  const result: ApplyResult = {
    inserted: 0,
    insertFail: 0,
    updated: 0,
    updateFail: 0,
    deleted: 0,
    deleteFail: 0,
    renamedLogCount: 0,
    removedLogCount: 0,
    insertedNames: [],
    updatedNames: [],
    deletedNames: [],
    failedNames: [],
  };

  // ---- INSERTS --------------------------------------------------------
  for (const food of toInsert as FoodInsert[]) {
    const { error } = await supa.from("foods").insert(food);
    if (error) {
      result.insertFail++;
      result.failedNames.push(food.name);
    } else {
      result.inserted++;
      result.insertedNames.push(food.name);
    }
  }

  // ---- UPDATES (with food_logs rename cascade) ------------------------
  for (const upd of toUpdate as FoodUpdatePatch[]) {
    const { error } = await supa
      .from("foods")
      .update(upd.patch)
      .eq("id", upd.id);

    if (error) {
      result.updateFail++;
      result.failedNames.push(upd.newName);
      continue;
    }

    if (upd.nameChanged && upd.oldName && upd.newName) {
      const { data: renamedLogs, error: renameError } = await supa
        .from("food_logs")
        .update({ food_name: upd.newName })
        .eq("food_name", upd.oldName)
        .select("id");
      if (!renameError) {
        result.renamedLogCount += renamedLogs?.length ?? 0;
      }
    }

    result.updated++;
    result.updatedNames.push(upd.newName);
  }

  // ---- DELETES (with food_logs deletion cascade) ----------------------
  const deleteNames = Array.from(
    new Set(
      (toDelete as FoodDelete[]).map((d) => d.name).filter(Boolean),
    ),
  );

  if (deleteNames.length) {
    const { data: removedLogs, error: logDeleteError } = await supa
      .from("food_logs")
      .delete()
      .in("food_name", deleteNames)
      .select("id");
    if (logDeleteError) {
      return NextResponse.json(
        { error: `Ne mogu obrisati food_logs: ${logDeleteError.message}` },
        { status: 500 },
      );
    }
    result.removedLogCount = removedLogs?.length ?? 0;
  }

  for (const del of toDelete as FoodDelete[]) {
    const { data, error } = await supa
      .from("foods")
      .delete()
      .eq("id", del.id)
      .select("id");

    if (error || !data?.length) {
      result.deleteFail++;
      result.failedNames.push(del.name);
    } else {
      result.deleted++;
      result.deletedNames.push(del.name);
    }
  }

  return NextResponse.json({ result });
}
