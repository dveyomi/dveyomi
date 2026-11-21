import { describe, expect, it } from "vitest";
import { categoriesOverTwiceInThree, leftoverBreakdown, suggestedBudget } from "./leftover";
import type { BudgetSummary } from "./budget";

const summaryWith = (leftToSpendPence: number) => ({ leftToSpendPence }) as BudgetSummary;

describe("leftoverBreakdown", () => {
  it("attributes carry, then freed by pause, then unspent categories", () => {
    expect(leftoverBreakdown(summaryWith(50000), 10000, 15000)).toEqual({
      totalPence: 50000,
      sources: [
        { kind: "previously_unassigned", amountPence: 10000 },
        { kind: "freed_by_pause", amountPence: 15000 },
        { kind: "unspent_categories", amountPence: 25000 },
      ],
    });
  });

  it("caps the carry at the total", () => {
    expect(leftoverBreakdown(summaryWith(5000), 10000, 0)).toEqual({
      totalPence: 5000,
      sources: [{ kind: "previously_unassigned", amountPence: 5000 }],
    });
  });

  it("caps freed by pause at what the carry left over", () => {
    expect(leftoverBreakdown(summaryWith(12000), 10000, 15000)).toEqual({
      totalPence: 12000,
      sources: [
        { kind: "previously_unassigned", amountPence: 10000 },
        { kind: "freed_by_pause", amountPence: 2000 },
      ],
    });
  });

  it("omits zero-amount sources", () => {
    expect(leftoverBreakdown(summaryWith(3000), 0, 0).sources).toEqual([
      { kind: "unspent_categories", amountPence: 3000 },
    ]);
  });

  it("negative left gives total 0 and no sources", () => {
    expect(leftoverBreakdown(summaryWith(-2500), 10000, 5000)).toEqual({ totalPence: 0, sources: [] });
  });
});

describe("categoriesOverTwiceInThree", () => {
  const over = (categoryId: string, overPence: number) => ({ categoryId, overPence });

  it("returns a category over in periods 1 and 3 of three", () => {
    expect(
      categoriesOverTwiceInThree([[over("a", 100)], [over("a", 0)], [over("a", 50)]]),
    ).toEqual(["a"]);
  });

  it("does not return a category over only once", () => {
    expect(categoriesOverTwiceInThree([[over("a", 100)], [], [over("a", 0)]])).toEqual([]);
  });

  it("works with only two periods", () => {
    expect(categoriesOverTwiceInThree([[over("a", 1)], [over("a", 2)]])).toEqual(["a"]);
  });

  it("uses only the last three periods (oldest first)", () => {
    expect(
      categoriesOverTwiceInThree([[over("a", 1)], [over("a", 1)], [], [over("b", 1)], [over("b", 1)]]),
    ).toEqual(["b"]);
  });

  it("returns ids in first-seen order without duplicates", () => {
    expect(
      categoriesOverTwiceInThree([
        [over("b", 1), over("a", 1)],
        [over("a", 1), over("b", 1)],
        [over("b", 1)],
      ]),
    ).toEqual(["b", "a"]);
  });
});

describe("suggestedBudget", () => {
  it("rounds the mean up to the whole pound", () => {
    expect(suggestedBudget([41050, 43000, 40000])).toBe(41400);
  });

  it("keeps an exact whole-pound mean", () => {
    expect(suggestedBudget([10000, 20000])).toBe(15000);
  });

  it("throws on an empty array", () => {
    expect(() => suggestedBudget([])).toThrow(Error);
  });
});
