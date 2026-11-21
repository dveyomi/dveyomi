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
