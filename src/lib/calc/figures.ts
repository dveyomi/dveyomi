import type { BudgetSummary, CategoryFigure } from "./budget";

/** Whole percent of `part` in `whole`, rounded down; 0 unless both are positive. */
function wholePercent(part: number, whole: number): number {
  if (part <= 0 || whole <= 0) return 0;
  return Math.floor((part * 100) / whole);
}

/**
 * Percent of a category's allocation still left, 0–100, rounded down so it
 * never overstates what is left. 0 when the category is over; null when it
 * has no budget (spending without an allocation).
 */
export function percentLeft(figure: CategoryFigure): number | null {
  if (figure.noBudget) return null;
  return wholePercent(figure.leftPence, figure.allocatedPence);
}

/**
 * Percent of this period's spendable money (pool plus any unassigned carry)
 * still left to spend, 0–100, rounded down. 0 when over budget.
 */
export function leftToSpendPercent(summary: BudgetSummary): number {
  return wholePercent(summary.leftToSpendPence, summary.leftToSpendPence + summary.spentPence);
}

/** How far Left to spend has gone below zero; 0 while there is money left. */
export function overBudgetPence(summary: BudgetSummary): number {
  return Math.max(0, -summary.leftToSpendPence);
}

/**
 * `part`'s share of `whole` as an exact percentage, 0 to 100, for drawing
 * (a chart's slice). Not rounded; 0 when the whole is £0 or less. Labels use
 * the whole-percent shares worked out with the figures.
 */
export function sharePercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return (Math.max(0, part) / whole) * 100;
}

/**
 * Safe to spend per day as the Budget tab shows it: never below £0.00. When
 * the true figure (kept in the summary, so status and the review use it) is
 * below zero, `belowZero` is set and the screen says why; the status is then
 * Out of Budget.
 */
export function displaySafeToSpend(summary: BudgetSummary): { perDayPence: number; belowZero: boolean } {
  const belowZero = summary.safeToSpendPerDayPence < 0;
  return { perDayPence: belowZero ? 0 : summary.safeToSpendPerDayPence, belowZero };
}
