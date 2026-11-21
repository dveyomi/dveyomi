"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NameTakenError } from "@/lib/data/budgetEdit";
import { deleteTransaction, MissingReferenceError, saveExpense, TransactionNotFoundError } from "@/lib/data/transactions";
import { safeNext } from "@/lib/safeNext";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { isId } from "@/lib/validation/budgetEdit";
import { isRecord } from "@/lib/validation/common";
import { validateExpense, type ExpenseField } from "@/lib/validation/expense";

export type ExpenseActionResult = { error: string; field?: ExpenseField };

/** Which expense (none when adding) and where to go afterwards. Bound by the page, but untrusted: a client can change them. */
type Target = { id?: unknown; returnTo?: unknown };

const targetOf = (t: unknown): Target => (isRecord(t) ? t : {});

const DEFAULT_RETURN = "/expenses";

const knownError = (e: unknown): string | null =>
  e instanceof MissingReferenceError || e instanceof TransactionNotFoundError ? e.message : null;

/**
 * Saves the add/edit expense form, then returns to `returnTo` (an in-app path
 * only; /expenses otherwise). The date range is checked against the
 * server's today for the user. The input is untrusted: it is validated here,
 * and RLS and the composite foreign keys keep the expense, its category and
 * its fund to the signed-in user.
 */
export async function saveExpenseAction(rawTarget: Target, raw: unknown): Promise<ExpenseActionResult> {
  if (!(await getUserId())) redirect("/login");
  const target = targetOf(rawTarget);
  if (target.id !== undefined && !isId(target.id)) return { error: "This expense wasn't recognised." };
  const id = target.id as string | undefined;

  const checked = validateExpense(raw, await getToday());
  if (!checked.ok) return { error: checked.error, ...(checked.field ? { field: checked.field } : {}) };

  try {
    await saveExpense(await createClient(), id ?? null, checked.input);
  } catch (e) {
    if (e instanceof NameTakenError) return { error: e.message, field: "newCategory" };
    const known = knownError(e);
    if (known) return { error: known };
    console.error("saveExpense failed", e);
    return { error: "We couldn't save this expense. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(target.returnTo, DEFAULT_RETURN));
}

/** Deletes the expense being edited, then returns to `returnTo` (as for saving). */
export async function deleteExpenseAction(rawTarget: Target): Promise<ExpenseActionResult> {
  if (!(await getUserId())) redirect("/login");
  const target = targetOf(rawTarget);
  if (!isId(target.id)) return { error: "This expense wasn't recognised." };

  try {
    await deleteTransaction(await createClient(), target.id);
  } catch (e) {
    const known = knownError(e);
    if (known) return { error: known };
    console.error("deleteTransaction failed", e);
    return { error: "We couldn't delete this expense. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(target.returnTo, DEFAULT_RETURN));
}

/**
 * Deletes an expense where it is listed (the calendar's day sheet) and
 * refreshes the pages; the caller stays where it is. `id` is untrusted; RLS
 * keeps the delete to the signed-in user's own expenses.
 */
export async function removeExpenseAction(id: unknown): Promise<{ error?: string }> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(id)) return { error: "This expense wasn't recognised." };

  try {
    await deleteTransaction(await createClient(), id);
  } catch (e) {
    const known = knownError(e);
    if (known) return { error: known };
    console.error("deleteTransaction failed", e);
    return { error: "We couldn't delete this expense. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  return {};
}
