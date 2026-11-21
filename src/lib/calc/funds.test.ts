import { describe, expect, it } from "vitest";
import { summarise, type PeriodBudget, type Txn } from "./budget";
import { fundBalance, fundHistory, type FundMovement } from "./funds";
import type { Period } from "./periods";

const mv = (over: Partial<FundMovement> = {}): FundMovement => ({
  id: "m1",
  date: "2026-11-05",
  kind: "contribution",
  amountPence: 5000,
  ...over,
});
const txn = (over: Partial<Txn> = {}): Txn => ({
  id: "t1",
  amountPence: 2000,
  date: "2026-11-10",
  categoryId: "c1",
  fundId: "f1",
  ...over,
});

describe("fundBalance", () => {
  it("is opening + contributions - withdrawals - fund-paid spending", () => {
    const movements = [mv(), mv({ id: "m2", kind: "withdrawal", amountPence: 1000 })];
    expect(fundBalance(10000, movements, [txn()])).toBe(12000);
  });

  it("is the opening balance when nothing has happened", () => {
    expect(fundBalance(10000, [], [])).toBe(10000);
  });
});

describe("fundHistory", () => {
  it("is newest first, labelling expenses as expense with direction out", () => {
    const h = fundHistory(
      [mv({ date: "2026-11-05" }), mv({ id: "m2", date: "2026-11-12", kind: "withdrawal", amountPence: 1000 })],
      [txn({ date: "2026-11-10" })],
    );
    expect(h).toEqual([
      { date: "2026-11-12", direction: "out", amountPence: 1000, label: "withdrawal", refId: "m2" },
      { date: "2026-11-10", direction: "out", amountPence: 2000, label: "expense", refId: "t1" },
      { date: "2026-11-05", direction: "in", amountPence: 5000, label: "contribution", refId: "m1" },
    ]);
  });

  it("orders equal dates by refId descending", () => {
    const h = fundHistory(
      [mv({ id: "a", date: "2026-11-10" }), mv({ id: "c", date: "2026-11-10" })],
      [txn({ id: "b", date: "2026-11-10" })],
    );
    expect(h.map((e) => e.refId)).toEqual(["c", "b", "a"]);
  });
});

describe("fund-paid expenses and summarise", () => {
  it("never count in monthly spent", () => {
    const period: Period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
    const budget: PeriodBudget = { incomePence: 600000, savingsPence: 0, unassignedCarryPence: 0, allocations: [] };
    const t = txn();
    expect(summarise(budget, [t], period, "2026-11-21")!.spentPence).toBe(0);
  });
});
