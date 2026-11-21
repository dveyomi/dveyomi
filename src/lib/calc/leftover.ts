import type { BudgetSummary } from "./budget";

export type LeftoverSource = {
  kind: "freed_by_pause" | "previously_unassigned" | "unspent_categories";
  amountPence: number;
};

/**
 * Breaks the leftover (one whole amount, never recomputed) into sources,
 * attributed in order: carry, freed by pause, then unspent categories.
 * Each is capped so the sources sum to the total; zero amounts are omitted.
 */
export function leftoverBreakdown(
  summary: BudgetSummary,
  unassignedCarryPence: number,
  freedByPausePence: number,
): { totalPence: number; sources: LeftoverSource[] } {
  const totalPence = Math.max(0, summary.leftToSpendPence);
  const carry = Math.min(Math.max(0, unassignedCarryPence), totalPence);
  const freed = Math.min(Math.max(0, freedByPausePence), totalPence - carry);
  const unspent = totalPence - carry - freed;
  const sources: LeftoverSource[] = [
    { kind: "previously_unassigned" as const, amountPence: carry },
    { kind: "freed_by_pause" as const, amountPence: freed },
    { kind: "unspent_categories" as const, amountPence: unspent },
  ].filter((s) => s.amountPence > 0);
  return { totalPence, sources };
}

/**
 * Input is ordered oldest to newest. Looks at the last three periods and
 * returns category ids over budget in at least two, in first-seen order.
 */
export function categoriesOverTwiceInThree(
  lastPeriods: { categoryId: string; overPence: number }[][],
): string[] {
  const counts = new Map<string, number>();
  for (const period of lastPeriods.slice(-3)) {
    const overInPeriod = new Set(period.filter((c) => c.overPence > 0).map((c) => c.categoryId));
    for (const id of overInPeriod) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= 2).map(([id]) => id);
}

/** Mean of recent spends in pence, rounded up to the next whole pound. */
export function suggestedBudget(recentSpentPence: number[]): number {
  if (recentSpentPence.length === 0) {
    throw new Error("suggestedBudget needs at least one period of spend");
  }
  const sum = recentSpentPence.reduce((a, b) => a + b, 0);
  const divisor = recentSpentPence.length * 100;
  const pounds = (sum - (sum % divisor)) / divisor + (sum % divisor > 0 ? 1 : 0);
  return pounds * 100;
}
