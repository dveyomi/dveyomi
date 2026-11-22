import { expenseWindow, type ExpenseRange, type ExpenseWindow, type IsoDate, type Txn, type YearMonth } from "@/lib/calc";
import type { Kind } from "@/lib/validation/budgetEdit";
import { allRows } from "./paging";
import type { Db } from "./types";

/** An expense as the Expenses tab lists it: the calc fields plus what the rows show. */
export type ExpenseTxn = Txn & {
  name: string;
  categoryName: string;
  categoryKind: Kind;
  /** Set when it was paid from a savings fund ("Travel · from Holiday"). */
  fundName: string | null;
  /** Auto-added by a recurring payment and not yet confirmed (§5.8). */
  unchecked: boolean;
};

export type ExpensesView = {
  range: ExpenseRange;
  window: ExpenseWindow;
  /** Expenses from the previous window's start to the current window's end, newest first. */
  transactions: ExpenseTxn[];
  /** The user's categories by name, for the filter. */
  categories: { id: string; name: string; kind: Kind }[];
};

/**
 * What the Expenses tab shows for calendar month `month` (or, with range
 * "period", the budget period starting in it); null means the one containing
 * `today`. Fund-paid expenses are included: Expenses totals count them (§5.7).
 */
export async function loadExpensesView(
  supabase: Db,
  today: IsoDate,
  { range, month }: { range: ExpenseRange; month: YearMonth | null },
): Promise<ExpensesView> {
  const [profile, categoriesRes] = await Promise.all([
    supabase.from("profiles").select("budget_start_day").single(),
    supabase.from("categories").select("id, name, kind").order("name"),
  ]);
  if (profile.error) throw profile.error;
  if (categoriesRes.error) throw categoriesRes.error;

  const window = expenseWindow(range, month, profile.data.budget_start_day, today);
  const data = await allRows((count) =>
    supabase
      .from("transactions")
      .select("id, name, amount_pence, date, category_id, fund_id, unchecked, categories(name, kind), funds(name)", count)
      .gte("date", window.previous.start)
      .lte("date", window.current.end)
      .order("date", { ascending: false })
      .order("id", { ascending: false }),
  );

  return {
    range,
    window,
    transactions: data.map((t) => ({
      id: t.id,
      name: t.name,
      amountPence: t.amount_pence,
      date: t.date,
      categoryId: t.category_id,
      categoryName: t.categories?.name ?? "",
      categoryKind: (t.categories?.kind ?? "want") as Kind,
      fundId: t.fund_id,
      fundName: t.funds?.name ?? null,
      unchecked: t.unchecked,
    })),
    categories: categoriesRes.data.map((c) => ({ id: c.id, name: c.name, kind: c.kind as Kind })),
  };
}
