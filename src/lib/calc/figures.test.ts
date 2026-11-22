import { describe, expect, it } from "vitest";
import type { BudgetSummary, CategoryFigure } from "./budget";
import { displaySafeToSpend, leftToSpendPercent, overBudgetPence, percentLeft, sharePercent } from "./figures";

function fig(over: Partial<CategoryFigure> = {}): CategoryFigure {
  return {
    categoryId: "c1",
    kind: "want",
    allocatedPence: 500000,
    spentPence: 10000,
    leftPence: 490000,
    overPence: 0,
    noBudget: false,
    ...over,
  };
}

function summary(over: Partial<BudgetSummary> = {}): BudgetSummary {
  return {
    poolPence: 600000,
    spentPence: 169822,
    leftToSpendPence: 430178,
    needsLeftPence: 0,
    unallocatedPence: 600000,
    overAllocatedPence: 0,
    daysLeft: 5,
    safeToSpendPerDayPence: 86036,
    categories: [],
    status: "on_track",
    ...over,
  };
}

describe("percentLeft", () => {
  it("is the whole percent of the allocation still left", () => {
    expect(percentLeft(fig())).toBe(98);
  });
  it("rounds down, so it never overstates what is left", () => {
    expect(percentLeft(fig({ allocatedPence: 1000, spentPence: 1, leftPence: 999 }))).toBe(99);
  });
  it("is 100 when nothing is spent", () => {
    expect(percentLeft(fig({ spentPence: 0, leftPence: 500000 }))).toBe(100);
  });
  it("is 0 when the category is over", () => {
    expect(percentLeft(fig({ spentPence: 600000, leftPence: -100000, overPence: 100000 }))).toBe(0);
  });
  it("is 0 for a zero allocation", () => {
    expect(percentLeft(fig({ allocatedPence: 0, spentPence: 0, leftPence: 0 }))).toBe(0);
  });
  it("is null when the category has no budget", () => {
    expect(
      percentLeft(fig({ kind: null, noBudget: true, allocatedPence: 0, spentPence: 500, leftPence: -500, overPence: 500 })),
    ).toBeNull();
  });
});

describe("leftToSpendPercent", () => {
  it("is the whole percent of the money available this period that is left", () => {
    // 430178 / 600000 = 71.7%
    expect(leftToSpendPercent(summary())).toBe(71);
  });
  it("is 100 before anything is spent", () => {
    expect(leftToSpendPercent(summary({ spentPence: 0, leftToSpendPence: 600000 }))).toBe(100);
  });
  it("counts an unassigned carry as available money", () => {
    // pool 600000 + carry 100000, spent 350000 -> left 350000 of 700000
    expect(leftToSpendPercent(summary({ spentPence: 350000, leftToSpendPence: 350000 }))).toBe(50);
  });
  it("is 0 when over budget", () => {
    expect(leftToSpendPercent(summary({ spentPence: 700000, leftToSpendPence: -100000 }))).toBe(0);
  });
  it("is 0 when nothing was ever available", () => {
    expect(leftToSpendPercent(summary({ poolPence: 0, spentPence: 0, leftToSpendPence: 0 }))).toBe(0);
  });
});

describe("overBudgetPence", () => {
  it("is how far left to spend has gone below zero", () => {
    expect(overBudgetPence(summary({ leftToSpendPence: -12345 }))).toBe(12345);
  });
  it("is 0 while there is money left", () => {
    expect(overBudgetPence(summary())).toBe(0);
    expect(overBudgetPence(summary({ leftToSpendPence: 0 }))).toBe(0);
  });
});

describe("displaySafeToSpend", () => {
  it("shows the figure as it is while it's £0 or more", () => {
    expect(displaySafeToSpend(summary({ safeToSpendPerDayPence: 86036 }))).toEqual({ perDayPence: 86036, belowZero: false });
    expect(displaySafeToSpend(summary({ safeToSpendPerDayPence: 0 }))).toEqual({ perDayPence: 0, belowZero: false });
  });

  it("shows £0.00 a day when it is below zero, and says so", () => {
    expect(displaySafeToSpend(summary({ safeToSpendPerDayPence: -1250 }))).toEqual({ perDayPence: 0, belowZero: true });
  });

  it("never changes the summary's own figure", () => {
    const s = summary({ safeToSpendPerDayPence: -1250 });
    displaySafeToSpend(s);
    expect(s.safeToSpendPerDayPence).toBe(-1250);
  });
});

describe("sharePercent", () => {
  it("is part's exact share of whole, 0 to 100", () => {
    expect(sharePercent(1, 4)).toBe(25);
    expect(sharePercent(1, 3)).toBeCloseTo(33.333, 3);
    expect(sharePercent(5, 5)).toBe(100);
  });

  it("is 0 when the whole is £0 or less", () => {
    expect(sharePercent(0, 0)).toBe(0);
    expect(sharePercent(5, -1)).toBe(0);
  });
});
