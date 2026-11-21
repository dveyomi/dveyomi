/** Budget setup figures: how the income divides before any spending. */

export type PlannedAllocation = { kind: "need" | "want"; amountPence: number };

export type AllocationTotals = {
  /** Income minus savings: what the allocations divide. */
  poolPence: number;
  needsPence: number;
  wantsPence: number;
  allocatedPence: number;
  /** Pool not yet given to a category; 0 when over. */
  unallocatedPence: number;
  /** How far allocations exceed the pool; 0 when not over. */
  overAllocatedPence: number;
};

export function allocationTotals(
  incomePence: number,
  savingsPence: number,
  allocations: PlannedAllocation[],
): AllocationTotals {
  const poolPence = incomePence - savingsPence;
  let needsPence = 0;
  let wantsPence = 0;
  for (const a of allocations) {
    if (a.kind === "need") needsPence += a.amountPence;
    else wantsPence += a.amountPence;
  }
  const allocatedPence = needsPence + wantsPence;
  return {
    poolPence,
    needsPence,
    wantsPence,
    allocatedPence,
    unallocatedPence: Math.max(0, poolPence - allocatedPence),
    overAllocatedPence: Math.max(0, allocatedPence - poolPence),
  };
}

/** What is left of `totalPence` after the parts: positive = still to split, negative = parts exceed it. */
export function splitRemainder(totalPence: number, partsPence: number[]): number {
  return partsPence.reduce((left, part) => left - part, totalPence);
}
