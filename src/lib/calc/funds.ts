import type { Txn } from "./budget";
import type { IsoDate } from "./dates";

export type FundMovement = {
  id: string;
  date: IsoDate;
  kind: "contribution" | "withdrawal";
  amountPence: number;
};
export type FundEntry = {
  date: IsoDate;
  direction: "in" | "out";
  amountPence: number;
  label: "contribution" | "withdrawal" | "expense";
  refId: string;
};

/** Balance = opening + contributions - withdrawals - fund-paid spending. `paidFromFund` is already filtered to this fund. */
export function fundBalance(openingPence: number, movements: FundMovement[], paidFromFund: Txn[]): number {
  let balance = openingPence;
  for (const m of movements) balance += m.kind === "contribution" ? m.amountPence : -m.amountPence;
  for (const t of paidFromFund) balance -= t.amountPence;
  return balance;
}

/** Fund activity, newest first; equal dates order by refId descending. */
export function fundHistory(movements: FundMovement[], paidFromFund: Txn[]): FundEntry[] {
  const entries: FundEntry[] = [
    ...movements.map((m): FundEntry => ({
      date: m.date,
      direction: m.kind === "contribution" ? "in" : "out",
      amountPence: m.amountPence,
      label: m.kind,
      refId: m.id,
    })),
    ...paidFromFund.map((t): FundEntry => ({
      date: t.date,
      direction: "out",
      amountPence: t.amountPence,
      label: "expense",
      refId: t.id,
    })),
  ];
  return entries.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.refId < b.refId ? 1 : a.refId > b.refId ? -1 : 0,
  );
}

/**
 * Whole percent of a fund's target already saved, rounded down so it never
 * overstates progress. It passes 100 once the target is beaten, and is 0 for
 * an empty or negative balance. Null when the fund has no target (or a £0 one).
 */
export function fundProgressPercent(balancePence: number, targetPence: number | null): number | null {
  if (targetPence === null || targetPence <= 0) return null;
  if (balancePence <= 0) return 0;
  return Math.floor((balancePence * 100) / targetPence);
}

export type SplitDifference = { state: "exact" | "left" | "over"; pence: number };

/**
 * How a savings split compares with the savings to move: exact, `pence` still
 * left to place, or `pence` over.
 */
export function splitDifference(savingsPence: number, amountsPence: number[]): SplitDifference {
  const placed = amountsPence.reduce((sum, a) => sum + a, 0);
  if (placed === savingsPence) return { state: "exact", pence: 0 };
  return placed < savingsPence ? { state: "left", pence: savingsPence - placed } : { state: "over", pence: placed - savingsPence };
}
