import type { IsoDate } from "@/lib/calc";
import { isId, type Kind } from "@/lib/validation/budgetEdit";
import type { ExpenseInput } from "@/lib/validation/expense";
import { createCategory } from "./category";
import type { Db } from "./types";

/** An expense's stored values, as the edit form starts from them. */
export type ExpenseRecord = {
  id: string;
  name: string;
  amountPence: number;
  date: IsoDate;
  categoryId: string;
  fundId: string | null;
  accountLabel: string | null;
  notes: string | null;
};

/** What the expense form offers: the user's categories and funds, by name. */
export type ExpenseOptions = {
  categories: { id: string; name: string; kind: Kind }[];
  funds: { id: string; name: string }[];
};

/** A checked expense with an existing category. Text must already be trimmed and within the limits. */
export type TransactionInput = {
  name: string;
  amountPence: number;
  date: IsoDate;
  categoryId: string;
  fundId?: string | null;
  accountLabel?: string;
  notes?: string;
};

/** The category or fund isn't one of the user's (or no longer exists). */
export class MissingReferenceError extends Error {
  constructor() {
    super("That category or fund no longer exists. Reload and try again.");
    this.name = "MissingReferenceError";
  }
}

/** The expense isn't one of the user's (or has been deleted). */
export class TransactionNotFoundError extends Error {
  constructor() {
    super("This expense no longer exists. It may have been deleted in another tab.");
    this.name = "TransactionNotFoundError";
  }
}

/** A composite foreign key (category or fund, with user_id) found no row of the user's. */
const isForeignKeyViolation = (e: { code?: string } | null) => e?.code === "23503";

const columns = (input: TransactionInput) => ({
  name: input.name,
  amount_pence: input.amountPence,
  date: input.date,
  category_id: input.categoryId,
  fund_id: input.fundId ?? null,
  account_label: input.accountLabel ?? null,
  notes: input.notes ?? null,
});

/** The user's categories and funds, by name, for the expense form. */
export async function loadExpenseOptions(supabase: Db): Promise<ExpenseOptions> {
  const [categories, funds] = await Promise.all([
    supabase.from("categories").select("id, name, kind").order("name"),
    supabase.from("funds").select("id, name").order("name"),
  ]);
  if (categories.error) throw categories.error;
  if (funds.error) throw funds.error;
  return {
    categories: categories.data.map((c) => ({ id: c.id, name: c.name, kind: c.kind as Kind })),
    funds: funds.data,
  };
}

/** One of the user's expenses, or null for an unknown id or another user's (RLS hides it). */
export async function loadTransaction(supabase: Db, id: string): Promise<ExpenseRecord | null> {
  if (!isId(id)) return null;
  const { data, error } = await supabase
    .from("transactions")
    .select("id, name, amount_pence, date, category_id, fund_id, account_label, notes")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    amountPence: data.amount_pence,
    date: data.date,
    categoryId: data.category_id,
    fundId: data.fund_id,
    accountLabel: data.account_label,
    notes: data.notes,
  };
}

/**
 * Records a manual expense and returns its id. The category and fund must be
 * the user's: the composite foreign keys refuse anyone else's, which throws
 * MissingReferenceError.
 */
export async function createTransaction(supabase: Db, input: TransactionInput): Promise<string> {
  const { data, error } = await supabase.from("transactions").insert(columns(input)).select("id").single();
  if (isForeignKeyViolation(error)) throw new MissingReferenceError();
  if (error) throw error;
  return data.id;
}

/**
 * Replaces an expense's entered values; optional ones left out are cleared.
 * Throws TransactionNotFoundError for an unknown id or another user's
 * expense, and MissingReferenceError for a category or fund that isn't theirs.
 */
export async function updateTransaction(supabase: Db, id: string, input: TransactionInput): Promise<void> {
  const { data, error } = await supabase.from("transactions").update(columns(input)).eq("id", id).select("id");
  if (isForeignKeyViolation(error)) throw new MissingReferenceError();
  if (error) throw error;
  if (data.length === 0) throw new TransactionNotFoundError();
}

/** Deletes an expense. Throws TransactionNotFoundError for an unknown id or another user's expense. */
export async function deleteTransaction(supabase: Db, id: string): Promise<void> {
  const { data, error } = await supabase.from("transactions").delete().eq("id", id).select("id");
  if (error) throw error;
  if (data.length === 0) throw new TransactionNotFoundError();
}

/**
 * Saves the expense form: creates the expense (`id` null) or updates it, and
 * returns its id. A new category in the input is created first (with no
 * allocation, so it shows "no budget yet"); if the expense then can't be
 * saved, that category is removed again so nothing is left half-saved.
 */
export async function saveExpense(supabase: Db, id: string | null, input: ExpenseInput): Promise<string> {
  const { category, ...rest } = input;
  const created = "id" in category ? null : await createCategory(supabase, category);
  const txn: TransactionInput = { ...rest, categoryId: created ?? (category as { id: string }).id };
  try {
    if (id === null) return await createTransaction(supabase, txn);
    await updateTransaction(supabase, id, txn);
    return id;
  } catch (e) {
    if (created) {
      const { error: undo } = await supabase.from("categories").delete().eq("id", created);
      // Visible in the logs: an empty category may now be left behind.
      if (undo) console.error("saveExpense: couldn't remove the new category after a failed save", created, undo);
    }
    throw e;
  }
}
