// Client-side wrapper around /api/admin/sheet-sync/* routes. CSV fetch and
// plan computation moved server-side (lib/server/sheetSyncCore.ts) so the
// client only orchestrates the admin UX.

import type {
  ApplyResult,
  FoodDelete,
  FoodUpdatePatch,
  SheetSyncPlan,
} from "@/types/sheetSync";

export type { ApplyResult, FoodDelete, FoodUpdatePatch, SheetSyncPlan };

export type SheetSyncDiagnostics = {
  sheetRowsParsed: number;
  dbRowsImported: number;
};

export type SheetSyncPlanResponse = {
  plan: SheetSyncPlan;
  diagnostics?: SheetSyncDiagnostics;
};

export async function fetchSheetSyncPlan(): Promise<SheetSyncPlanResponse> {
  const res = await fetch("/api/admin/sheet-sync/plan", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error || `Sync plan nije uspio (${res.status})`);
  }
  const body = (await res.json()) as SheetSyncPlanResponse;
  return body;
}

export async function applySheetSyncPlan(
  plan: SheetSyncPlan,
): Promise<ApplyResult> {
  const res = await fetch("/api/admin/sheet-sync/apply", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const body = (await res.json().catch(() => null)) as
    | { result?: ApplyResult; error?: string }
    | null;
  if (!res.ok || !body?.result) {
    throw new Error(body?.error || `Sink nije uspio (${res.status})`);
  }
  return body.result;
}
