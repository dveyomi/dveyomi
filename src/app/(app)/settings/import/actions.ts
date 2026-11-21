"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { commitImport, existingExpensesFor, ImportBatchNotFoundError, undoImport } from "@/lib/data/imports";
import { MissingReferenceError } from "@/lib/data/transactions";
import { findDuplicates } from "@/lib/import/csv";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { isId } from "@/lib/validation/budgetEdit";
import { validateDuplicateCheck, validateImport } from "@/lib/validation/import";

/**
 * The import wizard's server side. The rows come from the browser, so each
 * action checks them again; RLS and the composite foreign keys keep every
 * read and write to the signed-in user.
 */

/**
 * Which rows look like duplicates (indexes into `rawRows`): the same date,
 * amount and name as an expense already recorded in the rows' dates, or as an
 * earlier row. Saves nothing.
 */
export async function findDuplicatesAction(rawRows: unknown): Promise<{ duplicates: number[] } | { error: string }> {
  if (!(await getUserId())) redirect("/login");
  const rows = validateDuplicateCheck(rawRows);
  if (!rows) return { error: "These rows couldn't be checked. Choose the file again." };
  try {
    const existing = await existingExpensesFor(await createClient(), rows);
    return { duplicates: [...findDuplicates(rows, existing)] };
  } catch (e) {
    console.error("existingExpensesFor failed", e);
    return { error: "We couldn't check for duplicates. Check your connection and try again." };
  }
}

/** Saves the ticked rows as expenses in one import, all or nothing, with the server's today for the date range. */
export async function importAction(raw: unknown): Promise<{ batchId: string; inserted: number } | { error: string }> {
  if (!(await getUserId())) redirect("/login");
  const today = await getToday();
  const checked = validateImport(raw, today);
  if (!checked.ok) return { error: checked.error };
  const { filename, categoryId, rows } = checked.input;
  try {
    const result = await commitImport(await createClient(), rows, categoryId, { filename, today });
    revalidatePath("/", "layout");
    return result;
  } catch (e) {
    if (e instanceof MissingReferenceError) return { error: e.message };
    console.error("commitImport failed", e);
    return { error: "We couldn't import these expenses. Nothing was saved. Check your connection and try again." };
  }
}

/** Removes one import's expenses and the import. */
export async function undoImportAction(batchId: unknown): Promise<{ removed: number } | { error: string }> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(batchId)) return { error: "This import wasn't recognised." };
  try {
    const removed = await undoImport(await createClient(), batchId);
    revalidatePath("/", "layout");
    return { removed };
  } catch (e) {
    if (e instanceof ImportBatchNotFoundError) return { error: e.message };
    console.error("undoImport failed", e);
    return { error: "We couldn't undo this import. Check your connection and try again." };
  }
}
