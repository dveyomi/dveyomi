import type { IsoDate } from "@/lib/calc";
import { duplicateWindow, type ExistingExpense, type ImportRow } from "@/lib/import/csv";
import { isId } from "@/lib/validation/budgetEdit";
import { MissingReferenceError } from "./transactions";
import { allRows } from "./paging";
import type { Db } from "./types";

/**
 * Imports (Task 20): saving a checked file's rows as expenses, listing past
 * imports and undoing one. Imported expenses are ordinary transactions
 * (source 'csv', import_batch_id set), so every budget and expense figure
 * counts them exactly like manual ones.
 */

/** A row to save: its category is the import's default unless it has its own. */
export type CommitRow = ImportRow & { categoryId?: string };

/** A past import, newest first in listImports. `createdAt` is an ISO timestamp. */
export type ImportBatch = { id: string; filename: string; createdAt: string; rowCount: number };

/** The import isn't one of the user's (or was already undone). */
export class ImportBatchNotFoundError extends Error {
  constructor() {
    super("This import no longer exists. It may have been undone in another tab.");
    this.name = "ImportBatchNotFoundError";
  }
}

/**
 * Saves `rows` as expenses in one new import batch named `filename`, all or
 * nothing (import_expenses). Rows must already be checked (the server action
 * does); the database checks the bounds again against `today`. Throws
 * MissingReferenceError when a category isn't the user's.
 */
export async function commitImport(
  supabase: Db,
  rows: CommitRow[],
  categoryId: string,
  { filename, today }: { filename: string; today: IsoDate },
): Promise<{ batchId: string; inserted: number }> {
  const { data, error } = await supabase.rpc("import_expenses", {
    p_filename: filename,
    p_today: today,
    p_rows: rows.map((r) => ({
      name: r.name,
      amount_pence: r.amountPence,
      date: r.date,
      category_id: r.categoryId ?? categoryId,
    })),
  });
  if (error?.code === "23503") throw new MissingReferenceError();
  if (error) throw error;
  const result = data as { batch_id: string; inserted: number };
  return { batchId: result.batch_id, inserted: result.inserted };
}

/**
 * The user's expenses (any source) dated from 2 days before `rows`' first date
 * to 2 days after their last (duplicateWindow), as findDuplicates compares
 * them, every page of them.
 */
export async function existingExpensesFor(supabase: Db, rows: Pick<ImportRow, "date">[]): Promise<ExistingExpense[]> {
  const window = duplicateWindow(rows);
  if (!window) return [];
  const data = await allRows((count) =>
    supabase
      .from("transactions")
      .select("date, amount_pence, name, source", count)
      .gte("date", window.from)
      .lte("date", window.to)
      .order("id"),
  );
  return data.map((t) => ({ date: t.date, amountPence: t.amount_pence, name: t.name, source: t.source }));
}

/** How many past imports the import page lists. */
export const RECENT_IMPORTS = 20;

/** The user's latest imports, newest first, with how many expenses each still has. */
export async function listImports(supabase: Db): Promise<ImportBatch[]> {
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, filename, created_at, transactions(count)")
    .order("created_at", { ascending: false })
    .limit(RECENT_IMPORTS);
  if (error) throw error;
  return data.map((b) => ({
    id: b.id,
    filename: b.filename,
    createdAt: b.created_at,
    rowCount: b.transactions[0]?.count ?? 0,
  }));
}

/** Deletes one import's expenses and the import itself, together. Returns how many expenses went. */
export async function undoImport(supabase: Db, batchId: string): Promise<number> {
  if (!isId(batchId)) throw new ImportBatchNotFoundError();
  const { data, error } = await supabase.rpc("undo_import", { p_batch_id: batchId });
  if (error?.code === "P0002") throw new ImportBatchNotFoundError();
  if (error) throw error;
  return data;
}
