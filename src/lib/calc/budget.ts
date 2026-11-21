import { daysBetween, type IsoDate } from "./dates";
import { divRound } from "./money";
import { daysLeft, type Period } from "./periods";
import { allocationTotals } from "./setup";

export type Txn = {
  id: string;
  amountPence: number;
  date: IsoDate;
  categoryId: string;
  fundId: string | null;
};
export type Allocation = { categoryId: string; kind: "need" | "want"; amountPence: number };
export type PeriodBudget = {
  incomePence: number;
  savingsPence: number;
  unassignedCarryPence: number;
  allocations: Allocation[];
};
export type CategoryFigure = {
  categoryId: string;
  kind: "need" | "want" | null;
  allocatedPence: number;
  spentPence: number;
  leftPence: number;
  overPence: number;
  noBudget: boolean;
};
export type BudgetStatus = "on_track" | "spending_fast" | "out_of_budget";
export type BudgetSummary = {
  poolPence: number;
  spentPence: number;
  leftToSpendPence: number;
  needsLeftPence: number;
  unallocatedPence: number;
  overAllocatedPence: number;
  daysLeft: number;
  safeToSpendPerDayPence: number;
  categories: CategoryFigure[];
  status: BudgetStatus;
};

/** Wants may run this far ahead of the elapsed share of the period before "spending fast". */
const PACE_TOLERANCE = 0.1;

function figure(
  categoryId: string,
  kind: "need" | "want" | null,
  allocatedPence: number,
  spentPence: number,
): CategoryFigure {
  const leftPence = allocatedPence - spentPence;
  return {
    categoryId,
    kind,
    allocatedPence,
    spentPence,
    leftPence,
    overPence: Math.max(0, -leftPence),
    noBudget: kind === null,
  };
}

/** Budget figures for a period. `null` budget means "no budget yet": no figures are invented. */
export function summarise(
  budget: PeriodBudget | null,
  txns: Txn[],
  period: Period,
  today: IsoDate,
): BudgetSummary | null {
  if (budget === null) return null;

  // Only in-period, non-fund-paid transactions count towards monthly spending.
  const spentByCategory = new Map<string, number>();
  let spentPence = 0;
  for (const t of txns) {
    if (t.fundId !== null || t.date < period.start || t.date > period.end) continue;
    spentPence += t.amountPence;
    spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amountPence);
  }

  const categories: CategoryFigure[] = budget.allocations.map((a) =>
    figure(a.categoryId, a.kind, a.amountPence, spentByCategory.get(a.categoryId) ?? 0),
  );
  const allocated = new Set(budget.allocations.map((a) => a.categoryId));
  for (const [categoryId, spent] of spentByCategory) {
    if (!allocated.has(categoryId)) categories.push(figure(categoryId, null, 0, spent));
  }

  const { poolPence, unallocatedPence, overAllocatedPence } = allocationTotals(
    budget.incomePence,
    budget.savingsPence,
    budget.allocations,
  );
  const leftToSpendPence = poolPence + budget.unassignedCarryPence - spentPence;
  const needsLeftPence = categories
    .filter((c) => c.kind === "need")
    .reduce((sum, c) => sum + Math.max(0, c.leftPence), 0);
  const days = daysLeft(period, today);
  const safeToSpendPerDayPence = divRound(leftToSpendPence - needsLeftPence, days);

  // Out of Budget wins. Spending Fast: a budgeted category is overspent, allocations exceed the
  // spending money, or Wants are ahead of pace. Unbudgeted spending alone never triggers it.
  let status: BudgetStatus = "on_track";
  if (safeToSpendPerDayPence < 0) {
    status = "out_of_budget";
  } else {
    const wants = categories.filter((c) => c.kind === "want");
    const wantsAllocated = wants.reduce((sum, c) => sum + c.allocatedPence, 0);
    const wantsSpent = wants.reduce((sum, c) => sum + c.spentPence, 0);
    // elapsedDays counts period.start through today inclusive.
    const periodDays = daysBetween(period.start, period.nextStart);
    const elapsedDays = periodDays - days + 1;
    const wantsAheadOfPace =
      wantsAllocated > 0 && wantsSpent / wantsAllocated > elapsedDays / periodDays + PACE_TOLERANCE;
    const categoryOverspent = categories.some((c) => !c.noBudget && c.overPence > 0);
    if (categoryOverspent || overAllocatedPence > 0 || wantsAheadOfPace) status = "spending_fast";
  }

  return {
    poolPence,
    spentPence,
    leftToSpendPence,
    needsLeftPence,
    unallocatedPence,
    overAllocatedPence,
    daysLeft: days,
    safeToSpendPerDayPence,
    categories,
    status,
  };
}
