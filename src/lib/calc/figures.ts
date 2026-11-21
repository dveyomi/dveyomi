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
