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

// Lift Vercel function timeout. Default is 10 s on Hobby and that's what
// caused the "syncs ~12 rows at a time" behavior — serial Supabase calls
// at ~200–500 ms each ran out the clock. With bulk inserts/deletes and
// parallel updates below, 60 s is plenty for thousands of rows.
export const maxDuration = 60;

type ApplyBody = { plan?: SheetSyncPlan };

// Tunables. Insert chunk small enough to stay under Supabase's request
// payload budget even with big rows; update concurrency low enough not to
// trip per-IP rate limits.
const INSERT_CHUNK = 500;
const UPDATE_CONCURRENCY = 12;
const DELETE_CHUNK = 500;

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Bounded-parallel mapper. Avoids `Promise.all(arr.map(fn))` flood while
// still being ~N× faster than serial.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]!, i);
      }
    });
  await Promise.all(workers);
  return results;
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

  const { toInsert, toUpdate, toDelete } = body.plan as {
    toInsert: FoodInsert[];
    toUpdate: FoodUpdatePatch[];
    toDelete: FoodDelete[];
  };
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

  // ---- INSERTS — bulk by chunk ---------------------------------------
  // One HTTP per chunk instead of one per row. Fall back to per-row only
  // when a chunk fails, so we keep per-row error reporting on the rare
  // bad-row case (e.g. unique-barcode collision).
  for (const batch of chunk(toInsert, INSERT_CHUNK)) {
    const { error } = await supa.from("foods").insert(batch);
    if (!error) {
      result.inserted += batch.length;
      for (const f of batch) result.insertedNames.push(f.name);
      continue;
    }
    // Bulk failed — retry per-row to isolate the offender(s).
    for (const food of batch) {
      const { error: rowErr } = await supa.from("foods").insert(food);
      if (rowErr) {
        result.insertFail++;
        result.failedNames.push(food.name);
      } else {
        result.inserted++;
        result.insertedNames.push(food.name);
      }
    }
  }

  // ---- UPDATES — parallel with cascade rename ------------------------
  // Patches are unique per row, so we can't bulk-update with one query.
  // Parallel-with-concurrency-cap is ~UPDATE_CONCURRENCY× faster than
  // serial without hammering Supabase.
  await mapWithConcurrency(toUpdate, UPDATE_CONCURRENCY, async (upd) => {
    const { error } = await supa
      .from("foods")
      .update(upd.patch)
      .eq("id", upd.id);

    if (error) {
      result.updateFail++;
      result.failedNames.push(upd.newName);
      return;
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
  });

  // ---- DELETES — bulk logs + bulk foods ------------------------------
  const deleteNames = Array.from(
    new Set(toDelete.map((d) => d.name).filter(Boolean)),
  );

  if (deleteNames.length) {
    // food_logs already used .in() — keep, but chunk to avoid oversized
    // query strings on huge deletes.
    for (const nameChunk of chunk(deleteNames, DELETE_CHUNK)) {
      const { data: removedLogs, error: logDeleteError } = await supa
        .from("food_logs")
        .delete()
        .in("food_name", nameChunk)
        .select("id");
      if (logDeleteError) {
        return NextResponse.json(
          { error: `Ne mogu obrisati food_logs: ${logDeleteError.message}` },
          { status: 500 },
        );
      }
      result.removedLogCount += removedLogs?.length ?? 0;
    }
  }

  // Bulk-by-id foods delete — N+1 → 1 per chunk.
  const deleteIds = toDelete.map((d) => d.id);
  const idToName = new Map(toDelete.map((d) => [d.id, d.name]));
  for (const idChunk of chunk(deleteIds, DELETE_CHUNK)) {
    const { data, error } = await supa
      .from("foods")
      .delete()
      .in("id", idChunk)
      .select("id");
    if (error) {
      result.deleteFail += idChunk.length;
      for (const id of idChunk) {
        const n = idToName.get(id);
        if (n) result.failedNames.push(n);
      }
      continue;
    }
    const deletedIds = new Set((data ?? []).map((r) => r.id as number));
    for (const id of idChunk) {
      if (deletedIds.has(id)) {
        result.deleted++;
        const n = idToName.get(id);
        if (n) result.deletedNames.push(n);
      } else {
        result.deleteFail++;
        const n = idToName.get(id);
        if (n) result.failedNames.push(n);
      }
    }
  }

  return NextResponse.json({ result });
}
