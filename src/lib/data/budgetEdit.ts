import { addDays, periodContaining, type IsoDate } from "@/lib/calc";
import { ensureCurrentPeriod } from "./ensurePeriod";
import { MAX_CATEGORIES, checkName, firstDuplicate, isPence, isRecord, type Check } from "./onboarding";
import type { Db, PeriodRow } from "./types";

type Kind = "need" | "want";

/** A category in the budget being edited, with its allocation in the current period. */
export type EditorCategory = { id: string; name: string; kind: Kind; amountPence: number };

export type BudgetEditor = {
  /** The period containing today. */
  current: PeriodRow;
  /** The period after it, when it has already been created (by a "From next period" save). */
  next: PeriodRow | null;
  /** The current period's allocations, by category name. */
  categories: EditorCategory[];
};

/**
 * "this": the current period and, if it exists, the next one. "next": only
 * the next period, created now if needed. Past periods are never changed.
 */
export type BudgetEditScope = "this" | "next";

/** One category row as saved. No `id` = a new category; `removed` drops it from the budget. */
export type BudgetEditCategory = { id?: string; name: string; kind: Kind; amountPence: number; removed?: boolean };

export type BudgetEditInput = {
  incomePence: number;
  savingsPence: number;
  scope: BudgetEditScope;
  categories: BudgetEditCategory[];
};

/** A category name is already used by another category (names are unique, ignoring case). */
export class NameTakenError extends Error {
  constructor(name?: string) {
    super(name ? `You already have a category called ${name}.` : "Another category already has that name.");
    this.name = "NameTakenError";
  }
}

/** The category has expenses or a recurring payment, so it can't be deleted (only removed from the budget). */
export class CategoryInUseError extends Error {
  constructor() {
    super("This category has expenses, so it can't be deleted.");
    this.name = "CategoryInUseError";
  }
}

/** The user has no budget yet, so there is nothing to edit. */
export class NoBudgetError extends Error {
  constructor() {
    super("You don't have a budget yet.");
    this.name = "NoBudgetError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BudgetEditValidation = { ok: true; input: BudgetEditInput } | { ok: false; error: string; field?: "income" | "savings" };

/**
 * Checks untrusted budget-edit input (from the client): income, savings no
 * more than income, the scope, and up to MAX_CATEGORIES categories kept in
 * the budget, each with a unique trimmed name, a kind and an amount of £0 or
 * more. Removed rows need only a known id. Returns the input with names
 * trimmed, or the first problem in words a person can act on.
 */
export function validateBudgetEdit(raw: unknown): BudgetEditValidation {
  const fail = (error: string): BudgetEditValidation => ({ ok: false, error });
  if (!isRecord(raw)) return fail("Something was missing from your budget. Check it and try again.");
  const { incomePence, savingsPence, scope } = raw;
  if (!isPence(incomePence, 1)) {
    return { ok: false, field: "income", error: "Enter a monthly income between £0.01 and £10,000,000.00." };
  }
  if (!isPence(savingsPence, 0)) {
    return { ok: false, field: "savings", error: "Enter a savings amount, e.g. 250.00, or 0." };
  }
  if (savingsPence > incomePence) {
    return { ok: false, field: "savings", error: "Your savings can't be more than your income." };
  }
  if (scope !== "this" && scope !== "next") return fail("Choose when the changes start.");
  if (!Array.isArray(raw.categories)) return fail("Something was missing from your categories. Check each one.");

  const categories: BudgetEditCategory[] = [];
  for (const c of raw.categories as unknown[]) {
    if (!isRecord(c)) return fail("Something was missing from your categories. Check each one.");
    if (c.id !== undefined && (typeof c.id !== "string" || !UUID.test(c.id))) return fail("A category wasn't recognised.");
    const id = c.id as string | undefined;
    if (c.removed === true) {
      if (!id) continue; // a new row removed before saving: nothing to save
      if (typeof c.name !== "string" || (c.kind !== "need" && c.kind !== "want")) return fail("A category wasn't recognised.");
      categories.push({ id, name: c.name, kind: c.kind, amountPence: 0, removed: true });
      continue;
    }
    const name = checkName(c.name, "category");
    if (!name.ok) return name;
    if (c.kind !== "need" && c.kind !== "want") return fail(`Mark ${name.value} as a need or a want.`);
    if (!isPence(c.amountPence, 0)) return fail(`Enter an amount between £0.00 and £10,000,000.00 for ${name.value}.`);
    categories.push({ ...(id ? { id } : {}), name: name.value, kind: c.kind, amountPence: c.amountPence });
  }
  const kept = categories.filter((c) => !c.removed);
  if (kept.length > MAX_CATEGORIES) return fail(`You can have up to ${MAX_CATEGORIES} categories in your budget.`);
  const dup = firstDuplicate(kept.map((c) => c.name));
  if (dup) return fail(`You already have a category called ${dup}.`);
  const ids = categories.flatMap((c) => (c.id ? [c.id] : []));
  if (new Set(ids).size !== ids.length) return fail("A category appears twice. Reload the page and try again.");

  return { ok: true, input: { incomePence, savingsPence, scope, categories } };
}

/** The period after `current`, if it has been created already. */
async function nextPeriodOf(supabase: Db, current: PeriodRow): Promise<PeriodRow | null> {
  const { data, error } = await supabase
    .from("budget_periods")
    .select("*")
    .eq("start_date", addDays(current.end_date, 1))
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * What the budget editor starts from: the period containing `today` (renewed
 * first if due), the next period if it already exists, and the current
 * allocations with their categories, by name. Null with no budget.
 */
export async function loadBudgetEditor(supabase: Db, today: IsoDate): Promise<BudgetEditor | null> {
  const current = await ensureCurrentPeriod(supabase, today);
  if (!current) return null;
  const [next, allocations] = await Promise.all([
    nextPeriodOf(supabase, current),
    supabase.from("allocations").select("amount_pence, categories(id, name, kind)").eq("period_id", current.id),
  ]);
  if (allocations.error) throw allocations.error;
  const categories = allocations.data
    .flatMap((a) => (a.categories ? [{ ...a.categories, amountPence: a.amount_pence }] : []))
    .map((c) => ({ id: c.id, name: c.name, kind: c.kind as Kind, amountPence: c.amountPence }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { current, next, categories };
}

/** The current period and the end of the one after it (from the start day), for the edit functions. */
async function editTarget(supabase: Db, today: IsoDate): Promise<{ periodId: string; nextEnd: IsoDate }> {
  const current = await ensureCurrentPeriod(supabase, today);
  if (!current) throw new NoBudgetError();
  const profile = await supabase.from("profiles").select("budget_start_day").single();
  if (profile.error) throw profile.error;
  const nextStart = addDays(current.end_date, 1);
  return { periodId: current.id, nextEnd: periodContaining(nextStart, profile.data.budget_start_day).end };
}

const isUniqueViolation = (e: { code?: string } | null) => e?.code === "23505";

/**
 * Saves a validated budget edit in one transaction (`save_budget`): income,
 * savings and the allocations of the categories kept, for the periods the
 * scope covers. New categories are created (or one with the same name
 * outside the budget is brought back); renamed and re-kinded ones are
 * updated. Throws NameTakenError when a name belongs to another category.
 */
export async function saveBudget(supabase: Db, today: IsoDate, input: BudgetEditInput): Promise<void> {
  const { periodId, nextEnd } = await editTarget(supabase, today);
  const { error } = await supabase.rpc("save_budget", {
    p_period_id: periodId,
    p_next_end: nextEnd,
    p_scope: input.scope,
    p_income_pence: input.incomePence,
    p_savings_pence: input.savingsPence,
    p_categories: input.categories.map((c) => ({
      id: c.id ?? null,
      name: c.name,
      kind: c.kind,
      amount_pence: c.amountPence,
      removed: c.removed ?? false,
    })),
  });
  if (isUniqueViolation(error)) throw new NameTakenError();
  if (error) throw error;
}

/** Checks a new category name: trimmed, 1–50 characters. */
export function checkCategoryName(raw: unknown): Check<string> {
  return checkName(raw, "category");
}

/** Renames a category (trimmed, 1–50 characters). Throws NameTakenError when another category has the name, ignoring case. */
export async function renameCategory(supabase: Db, categoryId: string, rawName: string): Promise<void> {
  const name = checkCategoryName(rawName);
  if (!name.ok) throw new Error(name.error);
  const { data, error } = await supabase.from("categories").update({ name: name.value }).eq("id", categoryId).select("id");
  if (isUniqueViolation(error)) throw new NameTakenError(name.value);
  if (error) throw error;
  if (data.length === 0) throw new Error("Category not found.");
}

/** Whether the category has any expense, ever, or a recurring payment: such a category can't be deleted. */
export async function categoryInUse(supabase: Db, categoryId: string): Promise<boolean> {
  const [txns, rules] = await Promise.all([
    supabase.from("transactions").select("id").eq("category_id", categoryId).limit(1),
    supabase.from("recurring_rules").select("id").eq("category_id", categoryId).limit(1),
  ]);
  if (txns.error) throw txns.error;
  if (rules.error) throw rules.error;
  return txns.data.length > 0 || rules.data.length > 0;
}

/**
 * Deletes a category and its allocations (`delete_category`). Throws
 * CategoryInUseError, deleting nothing, when it has expenses or a recurring
 * payment: remove it from the budget instead.
 */
export async function deleteCategory(supabase: Db, categoryId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_category", { p_category_id: categoryId });
  if (error?.code === "PT409") throw new CategoryInUseError();
  if (error) throw error;
}

/**
 * Drops a category's allocation from the periods the scope covers
 * (`remove_from_budget`); the category and its past spending stay, and new
 * spending in it shows as "no budget yet".
 */
export async function removeFromBudget(
  supabase: Db,
  today: IsoDate,
  categoryId: string,
  scope: BudgetEditScope,
): Promise<void> {
  const { periodId, nextEnd } = await editTarget(supabase, today);
  const { error } = await supabase.rpc("remove_from_budget", {
    p_period_id: periodId,
    p_next_end: nextEnd,
    p_scope: scope,
    p_category_id: categoryId,
  });
  if (error) throw error;
}
