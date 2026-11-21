import type { IsoDate } from "./dates";
import type { Txn } from "./budget";
import type { Period } from "./periods";

/**
 * Expense totals. Unlike `summarise`, these INCLUDE fund-paid expenses (§5.7):
 * they feed Expenses totals, the calendar and category charts.
 */

export function totalsByDay(txns: Txn[]): Map<IsoDate, number> {
  const byDay = new Map<IsoDate, number>();
  for (const t of txns) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amountPence);
  return byDay;
}

function inPeriod(t: Txn, period: Period): boolean {
  return t.date >= period.start && t.date <= period.end;
}

export function totalsByCategory(txns: Txn[], period: Period): Map<string, number> {
  const byCategory = new Map<string, number>();
  for (const t of txns) {
    if (!inPeriod(t, period)) continue;
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amountPence);
  }
  return byCategory;
}

export function totalSpent(txns: Txn[], period: Period): number {
  let total = 0;
  for (const t of txns) if (inPeriod(t, period)) total += t.amountPence;
  return total;
}
