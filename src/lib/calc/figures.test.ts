import { describe, expect, it } from "vitest";
import type { BudgetSummary, CategoryFigure } from "./budget";
import { leftToSpendPercent, overBudgetPence, percentLeft } from "./figures";

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
