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
import { allRows } from "./paging";
import type { CategoryRow, Db, PeriodRow } from "./types";

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

  const { period, summary } = await summariseRow(supabase, row, categories, today);
  return { period, summary, categories };
}

/** A stored period's figures, from its row, allocations and in-period transactions (`summarise`). `categories` gives each allocation its kind. */
export async function summariseRow(
  supabase: Db,
  row: PeriodRow,
  categories: Pick<CategoryRow, "id" | "kind">[],
  today: IsoDate,
): Promise<{ period: Period; summary: BudgetSummary }> {
  const period: Period = { start: row.start_date, end: row.end_date, nextStart: addDays(row.end_date, 1) };

  const [allocationsRes, txnRows] = await Promise.all([
    supabase.from("allocations").select("category_id, amount_pence").eq("period_id", row.id),
    allRows((count) =>
      supabase
        .from("transactions")
        .select("id, amount_pence, date, category_id, fund_id", count)
        .gte("date", period.start)
        .lte("date", period.end)
        .order("id"),
    ),
  ]);
  if (allocationsRes.error) throw allocationsRes.error;

  const kindOf = new Map(categories.map((c) => [c.id, c.kind]));
  const allocations: Allocation[] = allocationsRes.data.map((a) => ({
    categoryId: a.category_id,
    kind: kindOf.get(a.category_id)!,
    amountPence: a.amount_pence,
  }));
  const txns: Txn[] = txnRows.map((t) => ({
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
  )!;
  return { period, summary };
}

export type PeriodSummary = { row: PeriodRow; period: Period; summary: BudgetSummary };

/**
 * Any stored period's figures, built the way loadBudgetView builds the
 * current one. `today` sets days left and pace: for an ended period pass its
 * end date. Throws when the period isn't the user's.
 */
export async function loadPeriodSummary(supabase: Db, periodId: string, today: IsoDate): Promise<PeriodSummary> {
  const [rowRes, categoriesRes] = await Promise.all([
    supabase.from("budget_periods").select("*").eq("id", periodId).single(),
    supabase.from("categories").select("id, kind"),
  ]);
  if (rowRes.error) throw rowRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  const categories = categoriesRes.data.map((c) => ({ id: c.id, kind: c.kind as CategoryRow["kind"] }));
  return { row: rowRes.data, ...(await summariseRow(supabase, rowRes.data, categories, today)) };
}
