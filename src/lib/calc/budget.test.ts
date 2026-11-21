import { describe, expect, it } from "vitest";
import { summarise, type PeriodBudget, type Txn } from "./budget";
import type { Period } from "./periods";

const period: Period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };

function budget(over: Partial<PeriodBudget> = {}): PeriodBudget {
  return { incomePence: 600000, savingsPence: 0, unassignedCarryPence: 0, allocations: [], ...over };
}

function txn(over: Partial<Txn> = {}): Txn {
  return { id: "t1", amountPence: 1000, date: "2026-11-10", categoryId: "c1", fundId: null, ...over };
}

describe("summarise", () => {
  it("returns null when there is no budget", () => {
    expect(summarise(null, [], period, "2026-11-21")).toBeNull();
  });

  it("reproduces the reference figure", () => {
    const s = summarise(budget(), [txn({ amountPence: 169822 })], period, "2026-11-26")!;
    expect(s.poolPence).toBe(600000);
    expect(s.spentPence).toBe(169822);
    expect(s.leftToSpendPence).toBe(430178);
    expect(s.needsLeftPence).toBe(0);
    expect(s.daysLeft).toBe(5);
    expect(s.safeToSpendPerDayPence).toBe(86036);
  });

  it("floors an overspent need at zero for needs left", () => {
    const b = budget({
      incomePence: 200000,
      allocations: [
        { categoryId: "rent", kind: "need", amountPence: 100000 },
        { categoryId: "fun", kind: "want", amountPence: 100000 },
      ],
    });
    const s = summarise(b, [txn({ categoryId: "rent", amountPence: 120000 })], period, "2026-11-21")!;
    expect(s.needsLeftPence).toBe(0);
    expect(s.leftToSpendPence).toBe(80000);
    expect(s.safeToSpendPerDayPence).toBe(8000);
    const rent = s.categories.find((c) => c.categoryId === "rent")!;
    expect(rent.leftPence).toBe(-20000);
    expect(rent.overPence).toBe(20000);
  });

  it("ignores fund-paid transactions everywhere", () => {
    const b = budget({ allocations: [{ categoryId: "c1", kind: "want", amountPence: 10000 }] });
    const s = summarise(b, [txn({ amountPence: 2000 }), txn({ id: "t2", fundId: "f1", amountPence: 5000 })], period, "2026-11-21")!;
    expect(s.spentPence).toBe(2000);
    expect(s.leftToSpendPence).toBe(598000);
    expect(s.categories.find((c) => c.categoryId === "c1")!.spentPence).toBe(2000);
  });

  it("ignores transactions outside the period", () => {
    const s = summarise(budget(), [txn({ date: "2026-10-31" }), txn({ id: "t2", date: "2026-12-01" })], period, "2026-11-21")!;
    expect(s.spentPence).toBe(0);
    expect(s.categories).toEqual([]);
  });

  it("reports over-allocation without clamping categories or the pool", () => {
    const b = budget({
      incomePence: 100000,
      allocations: [
        { categoryId: "a", kind: "need", amountPence: 90000 },
        { categoryId: "b", kind: "want", amountPence: 60000 },
      ],
    });
    const s = summarise(b, [], period, "2026-11-21")!;
    expect(s.poolPence).toBe(100000);
    expect(s.overAllocatedPence).toBe(50000);
    expect(s.unallocatedPence).toBe(0);
    expect(s.categories.map((c) => c.leftPence)).toEqual([90000, 60000]);
  });

  it("reports unallocated pool", () => {
    const b = budget({ incomePence: 100000, savingsPence: 10000, allocations: [{ categoryId: "a", kind: "need", amountPence: 30000 }] });
    const s = summarise(b, [], period, "2026-11-21")!;
    expect(s.poolPence).toBe(90000);
    expect(s.unallocatedPence).toBe(60000);
    expect(s.overAllocatedPence).toBe(0);
  });

  it("flags spending in an unallocated category as noBudget", () => {
    const s = summarise(budget(), [txn({ categoryId: "mystery", amountPence: 700 })], period, "2026-11-21")!;
    expect(s.categories).toEqual([
      { categoryId: "mystery", kind: null, allocatedPence: 0, spentPence: 700, leftPence: -700, overPence: 700, noBudget: true },
    ]);
  });

  it("adds unassigned carry to left to spend", () => {
    const base = summarise(budget(), [], period, "2026-11-21")!;
    const carry = summarise(budget({ unassignedCarryPence: 3000 }), [], period, "2026-11-21")!;
    expect(carry.leftToSpendPence - base.leftToSpendPence).toBe(3000);
    expect(carry.poolPence).toBe(base.poolPence);
  });

  it("is on track with a budget and no transactions", () => {
    const s = summarise(budget(), [], period, "2026-11-21")!;
    expect(s.status).toBe("on_track");
    expect(s.spentPence).toBe(0);
  });

  it("is spending fast when wants run well ahead of the period", () => {
    const b = budget({
      incomePence: 100000,
      allocations: [{ categoryId: "fun", kind: "want", amountPence: 10000 }],
    });
    // 6 of 30 days elapsed (20%), wants 80% spent
    const s = summarise(b, [txn({ categoryId: "fun", amountPence: 8000, date: "2026-11-03" })], period, "2026-11-06")!;
    expect(s.status).toBe("spending_fast");
  });

  it("is on track when wants are within pace tolerance", () => {
    const b = budget({
      incomePence: 100000,
      allocations: [{ categoryId: "fun", kind: "want", amountPence: 10000 }],
    });
    const s = summarise(b, [txn({ categoryId: "fun", amountPence: 2500, date: "2026-11-03" })], period, "2026-11-06")!;
    expect(s.status).toBe("on_track");
  });

  it("is out of budget when safe to spend is negative", () => {
    const s = summarise(budget({ incomePence: 10000 }), [txn({ amountPence: 20000 })], period, "2026-11-21")!;
    expect(s.safeToSpendPerDayPence).toBeLessThan(0);
    expect(s.status).toBe("out_of_budget");
  });

  describe("stricter status rule", () => {
    const needBudget = (over: Partial<PeriodBudget> = {}) =>
      budget({ allocations: [{ categoryId: "rent", kind: "need", amountPence: 50000 }], ...over });

    it("is spending fast when a need is overspent but safe to spend is still positive", () => {
      const s = summarise(needBudget(), [txn({ categoryId: "rent", amountPence: 70000 })], period, "2026-11-21")!;
      expect(s.safeToSpendPerDayPence).toBeGreaterThan(0);
      expect(s.categories[0].overPence).toBe(20000);
      expect(s.status).toBe("spending_fast");
    });

    it("is spending fast when a want is overspent", () => {
      const b = budget({ allocations: [{ categoryId: "fun", kind: "want", amountPence: 10000 }] });
      const s = summarise(b, [txn({ categoryId: "fun", amountPence: 10100, date: "2026-11-20" })], period, "2026-11-21")!;
      expect(s.status).toBe("spending_fast");
    });

    it("is spending fast when allocations exceed the spending money, with no spending", () => {
      const b = budget({ incomePence: 100000, allocations: [{ categoryId: "fun", kind: "want", amountPence: 120000 }] });
      const s = summarise(b, [], period, "2026-11-21")!;
      expect(s.overAllocatedPence).toBeGreaterThan(0);
      expect(s.status).toBe("spending_fast");
    });

    it("stays on track when only unallocated (no budget yet) spending exists", () => {
      const s = summarise(needBudget(), [txn({ categoryId: "mystery", amountPence: 700 })], period, "2026-11-21")!;
      expect(s.categories.find((c) => c.categoryId === "mystery")!.overPence).toBe(700);
      expect(s.status).toBe("on_track");
    });

    it("is out of budget, not spending fast, when safe to spend is negative with an overspent category", () => {
      const b = budget({ incomePence: 10000, allocations: [{ categoryId: "rent", kind: "need", amountPence: 5000 }] });
      const s = summarise(b, [txn({ categoryId: "rent", amountPence: 20000 })], period, "2026-11-21")!;
      expect(s.safeToSpendPerDayPence).toBeLessThan(0);
      expect(s.status).toBe("out_of_budget");
    });
  });
});
