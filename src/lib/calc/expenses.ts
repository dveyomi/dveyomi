import type { Txn } from "./budget";
import { compareToPrevious, type Comparison } from "./comparison";
import { addDays, daysBetween, type IsoDate } from "./dates";
import { divRound } from "./money";
import { periodContaining, periodStartingInMonth, previousPeriod, type Period } from "./periods";
import { totalsByCategory, totalsByDay, totalSpent } from "./totals";

/**
 * The Expenses tab's figures (§5.6). Every total here INCLUDES fund-paid
 * expenses (§5.7), unlike the Budget tab's `summarise`.
 */

/** Calendar months (the default) or budget periods. */
export type ExpenseRange = "month" | "period";
/** A month as YYYY-MM. */
export type YearMonth = string;

export function isYearMonth(s: unknown): s is YearMonth {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function shiftYearMonth(m: YearMonth, delta: number): YearMonth {
  const [y, mo] = m.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-11" -> "November 2026". */
export function formatMonthYear(m: YearMonth): string {
  const [y, mo] = m.split("-").map(Number);
  return monthYear.format(Date.UTC(y, mo - 1, 1));
}

export type ExpenseWindow = {
  /** The month the window starts in: the calendar month, or the month the budget period starts. */
  month: YearMonth;
  current: Period;
  previous: Period;
};

/**
 * The dates the Expenses tab shows. "month": calendar month `month` (today's
 * by default). "period": the budget period starting in `month`, by default the
 * one containing today (periodContaining with the user's start day).
 */
export function expenseWindow(
  range: ExpenseRange,
  month: YearMonth | null,
  startDay: number,
  today: IsoDate,
): ExpenseWindow {
  const day = range === "month" ? 1 : startDay;
  const current = month ? periodStartingInMonth(month, day) : periodContaining(today, day);
  return { month: current.start.slice(0, 7), current, previous: previousPeriod(current, day) };
}

/** Monday-first weeks covering `period`; days outside it are null. */
export function calendarWeeks(period: Period): (IsoDate | null)[][] {
  // 2024-01-01 was a Monday.
  const lead = (((daysBetween("2024-01-01", period.start) % 7) + 7) % 7);
  const days: (IsoDate | null)[] = Array.from({ length: lead }, () => null);
  for (let d = period.start; d <= period.end; d = addDays(d, 1)) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}

/** A category's spend in the window and its whole-percent share of the total. */
export type CategoryShare = { categoryId: string; pence: number; percent: number };
/** A slice of the category chart: a category, or (null) everything folded into "Other". */
export type CategorySlice = { categoryId: string | null; pence: number; percent: number };

export type ExpensesSummary = {
  totalPence: number;
  /** Day totals inside the window. */
  byDay: Map<IsoDate, number>;
  /** Largest first. */
  categories: CategoryShare[];
  /** Against the previous window (same elapsed days while current); null with no previous expenses. */
  comparison: Comparison | null;
};

const share = (pence: number, total: number) => (total === 0 ? 0 : divRound(pence * 100, total));

/** Everything the Expenses tab shows for `current`, from expenses spanning `previous` and `current`. */
export function summariseExpenses(txns: Txn[], current: Period, previous: Period, today: IsoDate): ExpensesSummary {
  const inWindow = txns.filter((t) => t.date >= current.start && t.date <= current.end);
  const totalPence = totalSpent(inWindow, current);
  const categories = [...totalsByCategory(inWindow, current)]
    .map(([categoryId, pence]) => ({ categoryId, pence, percent: share(pence, totalPence) }))
    .sort((a, b) => b.pence - a.pence || a.categoryId.localeCompare(b.categoryId));
  return {
    totalPence,
    byDay: totalsByDay(inWindow),
    categories,
    comparison: compareToPrevious(txns, current, previous, today),
  };
}

/** The chart's slices: the `keep` largest categories, then the rest as one "Other" slice. */
export function foldCategories(shares: CategoryShare[], keep: number, totalPence: number): CategorySlice[] {
  if (shares.length <= keep + 1) return shares;
  const rest = shares.slice(keep).reduce((sum, s) => sum + s.pence, 0);
  return [...shares.slice(0, keep), { categoryId: null, pence: rest, percent: share(rest, totalPence) }];
}
