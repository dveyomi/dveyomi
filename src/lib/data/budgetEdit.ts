import { addDays, periodContaining, type IsoDate } from "@/lib/calc";
import {
  checkCategoryName,
  type BudgetEditInput,
  type BudgetEditScope,
  type BudgetFigures,
  type Kind,
} from "@/lib/validation/budgetEdit";
import { ensureCurrentPeriod } from "./ensurePeriod";
import type { Db, PeriodRow } from "./types";

export {
  validateBudgetEdit,
  type BudgetEditCategory,
  type BudgetEditInput,
  type BudgetEditScope,
  type BudgetFigures,
  type EditorCategory,
} from "@/lib/validation/budgetEdit";

export type BudgetEditor = {
  /** The period containing today. */
  current: PeriodRow;
  /** The period after it, when it has already been created (by a "From next period" save). */
  next: PeriodRow | null;
  /** The current period's figures, categories by name. */
  budget: BudgetFigures;
  /** The next period's own figures, when it exists. */
  nextBudget: BudgetFigures | null;
  /** Whether the next period's figures differ from the current period's. */
  nextDiffers: boolean;
  /** Categories with no allocation this period, by name (for ?category= and adding one back). */
  outside: { id: string; name: string; kind: Kind }[];
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
    super("This category is in use, so it can't be deleted. Remove it from your budget instead.");
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

/** A period's income, savings and allocations (with their categories), categories by name. */
async function figuresOf(supabase: Db, period: PeriodRow): Promise<BudgetFigures> {
  const { data, error } = await supabase
    .from("allocations")
    .select("amount_pence, categories(id, name, kind)")
    .eq("period_id", period.id);
  if (error) throw error;
  const categories = data
    .flatMap((a) => (a.categories ? [{ ...a.categories, amountPence: a.amount_pence }] : []))
    .map((c) => ({ id: c.id, name: c.name, kind: c.kind as Kind, amountPence: c.amountPence }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { incomePence: period.income_pence, savingsPence: period.savings_pence, categories };
}

function sameFigures(a: BudgetFigures, b: BudgetFigures): boolean {
  const key = (f: BudgetFigures) =>
    JSON.stringify([f.incomePence, f.savingsPence, [...f.categories].sort((x, y) => x.id.localeCompare(y.id)).map((c) => [c.id, c.amountPence])]);
  return key(a) === key(b);
}

/**
 * What the budget editor starts from: the period containing `today` (renewed
 * first if due) with its figures, the next period and its own figures if it
 * already exists, whether they differ, and the categories outside this
 * period's budget. Null with no budget.
 */
export async function loadBudgetEditor(supabase: Db, today: IsoDate): Promise<BudgetEditor | null> {
  const current = await ensureCurrentPeriod(supabase, today);
  if (!current) return null;
  const [next, budget, all] = await Promise.all([
    nextPeriodOf(supabase, current),
    figuresOf(supabase, current),
    supabase.from("categories").select("id, name, kind").order("name"),
  ]);
  if (all.error) throw all.error;
  const nextBudget = next ? await figuresOf(supabase, next) : null;
  const inBudget = new Set(budget.categories.map((c) => c.id));
  return {
    current,
    next,
    budget,
    nextBudget,
    nextDiffers: nextBudget !== null && !sameFigures(budget, nextBudget),
    outside: all.data.filter((c) => !inBudget.has(c.id)).map((c) => ({ id: c.id, name: c.name, kind: c.kind as Kind })),
  };
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

/** The budget changed elsewhere (e.g. a category was deleted in another tab) since the editor loaded. */
export class BudgetChangedError extends Error {
  constructor() {
    super("This budget changed in another tab. Reload and try again.");
    this.name = "BudgetChangedError";
  }
}

const isUniqueViolation = (e: { code?: string } | null) => e?.code === "23505";

/**
 * Saves a validated budget edit in one transaction (`save_budget`): income,
 * savings and the allocations of the categories kept, for the periods the
 * scope covers. New categories are created (or one with the same name
 * outside the budget is brought back); renamed and re-kinded ones are
 * updated. Throws NameTakenError when a name belongs to another category.
 * Afterwards the unassigned-leftover nudge is dismissed.
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
  if (error?.code === "P0002") throw new BudgetChangedError();
  if (error) throw error;
  // Editing the budget answers "Give every pound a job".
  await dismissUnassignedNudge(supabase);
}

/** Hides the "Give every pound a job" nudge that keeping a leftover unassigned shows on the Budget tab. */
export async function dismissUnassignedNudge(supabase: Db): Promise<void> {
  const { error } = await supabase
    .from("leftover_movements")
    .update({ nudge_dismissed_at: new Date().toISOString() })
    .eq("destination", "unassigned")
    .is("nudge_dismissed_at", null);
  if (error) throw error;
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

/** Why a category can't be deleted: it has expenses, a recurring payment, or an allocation in a past budget. */
export type CategoryUse = "expenses" | "recurring" | "history";

/**
 * Why the category can't be deleted, or null when it can: any expense ever,
 * a recurring payment, or an allocation in a period starting before
 * `currentStart` (the current period's start). delete_category checks the same.
 */
export async function categoryUse(supabase: Db, categoryId: string, currentStart: IsoDate): Promise<CategoryUse | null> {
  const [txns, rules, past] = await Promise.all([
    supabase.from("transactions").select("id").eq("category_id", categoryId).limit(1),
    supabase.from("recurring_rules").select("id").eq("category_id", categoryId).limit(1),
    supabase
      .from("allocations")
      .select("id, budget_periods!inner(start_date)")
      .eq("category_id", categoryId)
      .lt("budget_periods.start_date", currentStart)
      .limit(1),
  ]);
  for (const r of [txns, rules, past]) if (r.error) throw r.error;
  if (txns.data!.length > 0) return "expenses";
  if (rules.data!.length > 0) return "recurring";
  if (past.data!.length > 0) return "history";
  return null;
}

/**
 * Deletes a category and its allocations (`delete_category`). Throws
 * CategoryInUseError, deleting nothing, when it is in use (see categoryUse):
 * remove it from the budget instead.
 */
export async function deleteCategory(supabase: Db, today: IsoDate, categoryId: string): Promise<void> {
  const { periodId } = await editTarget(supabase, today);
  const { error } = await supabase.rpc("delete_category", { p_category_id: categoryId, p_period_id: periodId });
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
