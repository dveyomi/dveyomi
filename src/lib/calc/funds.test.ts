import { describe, expect, it } from "vitest";
import { summarise, type PeriodBudget, type Txn } from "./budget";
import { fundBalance, fundHistory, fundProgressPercent, splitDifference, type FundMovement } from "./funds";
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

describe("fundProgressPercent", () => {
  it("is the whole percent of the target saved, rounded down", () => {
    expect(fundProgressPercent(33333, 100000)).toBe(33);
    expect(fundProgressPercent(100000, 100000)).toBe(100);
  });

  it("can pass 100 when the fund is over its target", () => {
    expect(fundProgressPercent(150000, 100000)).toBe(150);
  });

  it("is 0 for an empty or negative balance", () => {
    expect(fundProgressPercent(0, 100000)).toBe(0);
    expect(fundProgressPercent(-500, 100000)).toBe(0);
  });

  it("is null without a target (none, or £0)", () => {
    expect(fundProgressPercent(5000, null)).toBeNull();
    expect(fundProgressPercent(5000, 0)).toBeNull();
  });
});

describe("splitDifference", () => {
  it("is exact when the amounts add up to the savings", () => {
    expect(splitDifference(30000, [20000, 10000])).toEqual({ state: "exact", pence: 0 });
  });

  it("says how much is left to place when the amounts are short", () => {
    expect(splitDifference(30000, [20000, 5000])).toEqual({ state: "left", pence: 5000 });
  });

  it("says how much over when the amounts are more than the savings", () => {
    expect(splitDifference(30000, [20000, 15000])).toEqual({ state: "over", pence: 5000 });
  });

  it("treats no amounts as all left to place", () => {
    expect(splitDifference(30000, [])).toEqual({ state: "left", pence: 30000 });
  });
});
