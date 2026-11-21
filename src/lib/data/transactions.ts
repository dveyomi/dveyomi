import type { IsoDate } from "@/lib/calc";
import { isId, type Kind } from "@/lib/validation/budgetEdit";
import type { ExpenseInput } from "@/lib/validation/expense";
import { NameTakenError } from "./budgetEdit";
import { laterPaymentAmounts, RecurringChangedError } from "./recurring";
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
  /** Set when it is a payment of a recurring rule. */
  recurringRuleId: string | null;
  /** Auto-added by a recurring rule and not yet checked. */
  unchecked: boolean;
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

/** A recurring payment moved onto a date its rule already has a payment on. */
export class DuplicateOccurrenceError extends Error {
  constructor() {
    super("There's already a payment for this on that date. Choose another date.");
    this.name = "DuplicateOccurrenceError";
  }
}

/** The (user, recurring rule, date) key: one payment per rule per date. */
const isDuplicateOccurrence = (e: { code?: string; message?: string } | null) =>
  e?.code === "23505" && (e.message ?? "").includes("transactions_user_rule_date_key");

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
    .select("id, name, amount_pence, date, category_id, fund_id, account_label, notes, recurring_rule_id, unchecked")
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
    recurringRuleId: data.recurring_rule_id,
    unchecked: data.unchecked,
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
 * Editing checks it: an auto-added payment is unchecked only until confirmed
 * or edited (§5.8). Throws TransactionNotFoundError for an unknown id or
 * another user's expense, MissingReferenceError for a category or fund that
 * isn't theirs, and DuplicateOccurrenceError for a recurring payment moved
 * onto a date its rule already has a payment on.
 */
export async function updateTransaction(supabase: Db, id: string, input: TransactionInput): Promise<void> {
  const { data, error } = await supabase
    .from("transactions")
    .update({ ...columns(input), unchecked: false })
    .eq("id", id)
    .select("id");
  if (isForeignKeyViolation(error)) throw new MissingReferenceError();
  if (isDuplicateOccurrence(error)) throw new DuplicateOccurrenceError();
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
 * returns its id. Editing an expense checks it. These go through the
 * save_expense RPC, so everything is saved together or not at all:
 * - a new category (created with no allocation, so it shows "no budget yet");
 * - Repeat on a new expense (a recurring rule made from it, which becomes its
 *   first payment). Repeat is ignored when editing;
 * - "This and future payments" (`amountScope`) on a recurring payment: the
 *   rule's price from its date and the amounts of its later unchecked
 *   payments (worked out here with calc), with the expense itself.
 */
export async function saveExpense(supabase: Db, id: string | null, input: ExpenseInput): Promise<string> {
  const { category, repeat: asked, amountScope, ...rest } = input;
  const repeat = id === null ? asked : undefined;
  const thisAndFuture = id !== null && amountScope === "this_and_future";
  if ("id" in category && !repeat && !thisAndFuture) {
    const txn: TransactionInput = { ...rest, categoryId: category.id };
    if (id === null) return createTransaction(supabase, txn);
    await updateTransaction(supabase, id, txn);
    return id;
  }

  const priceUpdates = thisAndFuture ? await laterPaymentAmounts(supabase, id, rest.date, rest.amountPence) : [];
  const { data, error } = await supabase.rpc("save_expense", {
    p_name: rest.name,
    p_amount_pence: rest.amountPence,
    p_date: rest.date,
    ...(id ? { p_id: id } : {}),
    ...("id" in category
      ? { p_category_id: category.id }
      : { p_new_category_name: category.name, p_new_category_kind: category.kind }),
    ...(rest.fundId ? { p_fund_id: rest.fundId } : {}),
    ...(rest.accountLabel ? { p_account_label: rest.accountLabel } : {}),
    ...(rest.notes ? { p_notes: rest.notes } : {}),
    ...(repeat ? { p_repeat: repeat } : {}),
    ...(thisAndFuture ? { p_amount_scope: "this_and_future", p_price_updates: priceUpdates } : {}),
  });
  if (isDuplicateOccurrence(error)) throw new DuplicateOccurrenceError();
  if (error?.code === "23505" && !("id" in category)) throw new NameTakenError(category.name);
  if (isForeignKeyViolation(error)) throw new MissingReferenceError();
  if (error?.code === "P0002") throw new TransactionNotFoundError();
  if (error?.code === "PT409") throw new RecurringChangedError();
  if (error) throw error;
  return data;
}

