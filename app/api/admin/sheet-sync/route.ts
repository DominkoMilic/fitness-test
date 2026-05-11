import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/utils/requireAdmin";
import type { FoodInsert } from "@/types/database";

type SyncBody = {
  foods?: FoodInsert[];
  keepNames?: string[];
  keepRowIds?: string[];
};

const normalizeName = (value: string) =>
  (value || "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeRowId = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard) return guard;

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const body = (await req.json()) as SyncBody;
    const foods = Array.isArray(body.foods) ? body.foods : [];
    const keepNames = Array.isArray(body.keepNames) ? body.keepNames : [];
    const keepRowIds = Array.isArray(body.keepRowIds) ? body.keepRowIds : [];

    const keepNameSet = new Set(keepNames.map(normalizeName));
    const keepRowIdSet = new Set(keepRowIds.map((id) => normalizeRowId(id)));

    const { data: existingFoods, error: listError } = await supabaseAdmin
      .from("foods")
      .select("id, name, sheet_row_id")
      .eq("status", "imported");

    if (listError) {
      return NextResponse.json(
        { error: `Ne mogu učitati foods: ${listError.message}` },
        { status: 500 },
      );
    }

    const foodsToDelete = (existingFoods ?? []).filter((row) => {
      const rowName = normalizeName(row.name || "");
      const rowId = normalizeRowId(row.sheet_row_id);

      if (rowId) {
        if (keepRowIdSet.has(rowId)) return false;
        if (keepNameSet.has(rowName)) return false;
        return true;
      }

      return !keepNameSet.has(rowName);
    });

    let inserted = 0;
    let insertFail = 0;

    if (foods.length) {
      const insertResults = await Promise.all(
        foods.map((food) =>
          supabaseAdmin
            .from("foods")
            .insert(food)
            .then((result) => !result.error),
        ),
      );

      inserted = insertResults.filter(Boolean).length;
      insertFail = insertResults.filter((ok) => !ok).length;
    }

    const namesToDelete = Array.from(
      new Set(foodsToDelete.map((food) => food.name).filter(Boolean)),
    );

    let removedLogCount = 0;
    if (namesToDelete.length) {
      const { data: removedLogs, error: logDeleteError } = await supabaseAdmin
        .from("food_logs")
        .delete()
        .in("food_name", namesToDelete)
        .select("id");

      if (logDeleteError) {
        return NextResponse.json(
          { error: `Ne mogu obrisati food_logs: ${logDeleteError.message}` },
          { status: 500 },
        );
      }

      removedLogCount = removedLogs?.length ?? 0;
    }

    let deleted = 0;
    let deleteFail = 0;
    const deletedNames: string[] = [];
    const failedNames: string[] = [];

    if (foodsToDelete.length) {
      const deleteResults = await Promise.all(
        foodsToDelete.map((food) =>
          supabaseAdmin
            .from("foods")
            .delete()
            .eq("id", food.id)
            .select("id")
            .then(({ data, error }) => ({
              ok: !error && Boolean(data?.length),
              name: food.name,
            })),
        ),
      );

      deleted = deleteResults.filter((result) => result.ok).length;
      deleteFail = deleteResults.filter((result) => !result.ok).length;
      deletedNames.push(
        ...deleteResults
          .filter((result) => result.ok)
          .map((result) => result.name),
      );
      failedNames.push(
        ...deleteResults
          .filter((result) => !result.ok)
          .map((result) => result.name),
      );
    }

    return NextResponse.json({
      inserted,
      insertFail,
      deleted,
      deleteFail,
      deletedNames,
      failedNames,
      removedLogCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Greška tijekom sync brisanja",
      },
      { status: 500 },
    );
  }
}
