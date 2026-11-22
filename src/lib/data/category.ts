import type { BudgetSummary, CategoryFigure, IsoDate, Period } from "@/lib/calc";
import { loadBudgetView } from "./budget";
import { categoryUse, NameTakenError, type CategoryUse } from "./budgetEdit";
import type { Kind } from "@/lib/validation/budgetEdit";
import { allRows } from "./paging";
import type { CategoryRow, Db } from "./types";

/** An expense as the category detail lists it. `fundName` is set when it was paid from a fund. */
export type CategoryTxn = { id: string; name: string; amountPence: number; date: IsoDate; fundName: string | null };

export type CategoryView = {
  period: Period;
  category: CategoryRow;
  summary: BudgetSummary | null;
  /** The category's figure from the Budget tab's summary; null with no allocation and no spending. */
  figure: CategoryFigure | null;
  /** Every expense in the period, newest first, fund-paid ones included (they don't count in `figure`). */
  transactions: CategoryTxn[];
  /** Why it can't be deleted (expenses, a recurring payment, a past budget), or null when it can. */
  inUse: CategoryUse | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Everything the category detail shows. The figure is taken from the same
 * `summarise` call as the Budget tab (via loadBudgetView), never recomputed.
 * Null for an unknown id or another user's category (RLS hides it).
 */
export async function loadCategoryView(supabase: Db, today: IsoDate, categoryId: string): Promise<CategoryView | null> {
  if (!UUID.test(categoryId)) return null;
  const { period, summary, categories } = await loadBudgetView(supabase, today);
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return null;

  const [data, inUse] = await Promise.all([
    allRows((count) =>
      supabase
        .from("transactions")
        .select("id, name, amount_pence, date, funds(name)", count)
        .eq("category_id", categoryId)
        .gte("date", period.start)
        .lte("date", period.end)
        .order("date", { ascending: false })
        .order("id", { ascending: false }),
    ),
    categoryUse(supabase, categoryId, period.start),
  ]);

  return {
    period,
    category,
    summary,
    figure: summary?.categories.find((c) => c.categoryId === categoryId) ?? null,
    transactions: data.map((t) => ({
      id: t.id,
      name: t.name,
      amountPence: t.amount_pence,
      date: t.date,
      fundName: t.funds?.name ?? null,
    })),
    inUse,
  };
}

/**
 * Creates a category with no allocation (it shows as "no budget yet" until it
 * is given one) and returns its id. `name` must already be checked (trimmed,
 * 1–50 characters). Throws NameTakenError when the user has a category with
 * that name, ignoring case.
 */
export async function createCategory(supabase: Db, category: { name: string; kind: Kind }): Promise<string> {
  const { data, error } = await supabase.from("categories").insert(category).select("id").single();
  if (error?.code === "23505") throw new NameTakenError(category.name);
  if (error) throw error;
  return data.id;
}
