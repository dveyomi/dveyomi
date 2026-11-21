import {
  addDays,
  periodContaining,
  summarise,
  type Allocation,
  type BudgetSummary,
  type IsoDate,
  type Period,
  type Txn,
} from "@/lib/calc";
import { ensureCurrentPeriod } from "./ensurePeriod";
import type { CategoryRow, Db } from "./types";

export type BudgetView = { period: Period; summary: BudgetSummary | null; categories: CategoryRow[] };

/**
 * Everything the Budget tab and category detail show, for the period
 * containing `today` (renewed first if due). Every figure comes from
 * `summarise`; this only maps rows to calc types. `summary` is null until the
 * user has a budget, and `period` is then the one their start day gives.
 */
export async function loadBudgetView(supabase: Db, today: IsoDate): Promise<BudgetView> {
  const [row, categoriesRes] = await Promise.all([
    ensureCurrentPeriod(supabase, today),
    supabase.from("categories").select("*").order("name"),
  ]);
  if (categoriesRes.error) throw categoriesRes.error;
  const categories = categoriesRes.data as CategoryRow[];

  if (!row) {
    const profile = await supabase.from("profiles").select("budget_start_day").single();
    if (profile.error) throw profile.error;
    return { period: periodContaining(today, profile.data.budget_start_day), summary: null, categories };
  }

  const period: Period = { start: row.start_date, end: row.end_date, nextStart: addDays(row.end_date, 1) };

  const [allocationsRes, txnsRes] = await Promise.all([
    supabase.from("allocations").select("category_id, amount_pence").eq("period_id", row.id),
    supabase
      .from("transactions")
      .select("id, amount_pence, date, category_id, fund_id")
      .gte("date", period.start)
      .lte("date", period.end),
  ]);
  if (allocationsRes.error) throw allocationsRes.error;
  if (txnsRes.error) throw txnsRes.error;

  const kindOf = new Map(categories.map((c) => [c.id, c.kind]));
  const allocations: Allocation[] = allocationsRes.data.map((a) => ({
    categoryId: a.category_id,
    kind: kindOf.get(a.category_id)!,
    amountPence: a.amount_pence,
  }));
  const txns: Txn[] = txnsRes.data.map((t) => ({
    id: t.id,
    amountPence: t.amount_pence,
    date: t.date,
    categoryId: t.category_id,
    fundId: t.fund_id,
  }));

  const summary = summarise(
    {
      incomePence: row.income_pence,
      savingsPence: row.savings_pence,
      unassignedCarryPence: row.unassigned_carry_pence,
      allocations,
    },
    txns,
    period,
    today,
  );
  return { period, summary, categories };
}
