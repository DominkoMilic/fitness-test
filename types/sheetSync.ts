import type { FoodInsert } from "./database";

export type FoodUpdatePatch = {
  id: number;
  oldName: string;
  newName: string;
  nameChanged: boolean;
  patch: Partial<FoodInsert>;
};

export type FoodDelete = {
  id: number;
  name: string;
};

export type SheetDuplicate = {
  /** Original-cased name as it appears in the sheet. */
  name: string;
  /** sheet_row_id of the offending row, if any. */
  sheetRowId: string | null;
  /** Reason: same normalized name OR same sheet_row_id as a previous row. */
  reason: "name" | "sheet_row_id";
};

export type SheetSyncPlan = {
  toInsert: FoodInsert[];
  toUpdate: FoodUpdatePatch[];
  toDelete: FoodDelete[];
  unchangedCount: number;
  /** Rows in the sheet that were skipped because an earlier row claimed
   * the same identity (name or sheet_row_id). First occurrence wins. */
  duplicates: SheetDuplicate[];
};

export type ApplyResult = {
  inserted: number;
  insertFail: number;
  updated: number;
  updateFail: number;
  deleted: number;
  deleteFail: number;
  renamedLogCount: number;
  removedLogCount: number;
  insertedNames: string[];
  updatedNames: string[];
  deletedNames: string[];
  failedNames: string[];
};
