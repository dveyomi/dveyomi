import { describe, expect, it } from "vitest";
import type { Txn } from "./budget";
import {
  calendarWeeks,
  expenseWindow,
  foldCategories,
  formatMonthYear,
  isYearMonth,
  shiftYearMonth,
  summariseExpenses,
} from "./expenses";
import { formatGBPShort } from "./money";

let n = 0;
const txn = (date: string, amountPence: number, categoryId = "food", fundId: string | null = null): Txn => ({
  id: `t${++n}`,
  date,
  amountPence,
  categoryId,
  fundId,
});

describe("year-months", () => {
  it("recognises YYYY-MM only", () => {
    expect(isYearMonth("2026-11")).toBe(true);
    expect(isYearMonth("2026-13")).toBe(false);
    expect(isYearMonth("2026-1")).toBe(false);
    expect(isYearMonth("2026-11-01")).toBe(false);
    expect(isYearMonth(undefined)).toBe(false);
  });

  it("shifts across year ends", () => {
    expect(shiftYearMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftYearMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftYearMonth("2026-11", 0)).toBe("2026-11");
  });

  it("formats for people", () => {
    expect(formatMonthYear("2026-11")).toBe("November 2026");
  });
});

describe("expenseWindow", () => {
  it("month range: the calendar month of today by default, and the month before as previous", () => {
    expect(expenseWindow("month", null, 25, "2026-11-21")).toEqual({
      month: "2026-11",
      current: { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" },
      previous: { start: "2026-10-01", end: "2026-10-31", nextStart: "2026-11-01" },
    });
  });

  it("month range: a chosen month", () => {
    expect(expenseWindow("month", "2026-02", 25, "2026-11-21").current).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
      nextStart: "2026-03-01",
    });
  });

  it("period range: the budget period containing today by default (periodContaining with the start day)", () => {
    expect(expenseWindow("period", null, 25, "2026-11-21")).toEqual({
      month: "2026-10",
      current: { start: "2026-10-25", end: "2026-11-24", nextStart: "2026-11-25" },
      previous: { start: "2026-09-25", end: "2026-10-24", nextStart: "2026-10-25" },
    });
  });

  it("period range: a chosen month means the period starting in it", () => {
    expect(expenseWindow("period", "2026-11", 25, "2026-11-21").current).toEqual({
      start: "2026-11-25",
      end: "2026-12-24",
      nextStart: "2026-12-25",
    });
  });
});

describe("calendarWeeks", () => {
  it("lays a month out in Monday-first weeks, blank outside the window", () => {
    const weeks = calendarWeeks({ start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" });
    // 1 Nov 2026 is a Sunday.
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks[1][0]).toBe("2026-11-02");
    expect(weeks.at(-1)).toEqual(["2026-11-30", null, null, null, null, null, null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it("spans two months for a budget period", () => {
    const weeks = calendarWeeks({ start: "2026-10-25", end: "2026-11-24", nextStart: "2026-11-25" });
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks[0][6]).toBe("2026-10-25");
  });
});

describe("formatGBPShort", () => {
  it("keeps pence under £10, whole pounds (halves up) under £1,000, then thousands", () => {
    expect(formatGBPShort(500)).toBe("£5.00");
    expect(formatGBPShort(999)).toBe("£9.99");
    expect(formatGBPShort(1750)).toBe("£18");
    expect(formatGBPShort(1749)).toBe("£17");
    expect(formatGBPShort(99949)).toBe("£999");
    expect(formatGBPShort(99950)).toBe("£1.0k");
    expect(formatGBPShort(25049)).toBe("£250");
    expect(formatGBPShort(25050)).toBe("£251");
    expect(formatGBPShort(123456)).toBe("£1.2k");
    expect(formatGBPShort(1250000)).toBe("£12.5k");
  });
});

describe("summariseExpenses", () => {
  const current = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
  const previous = { start: "2026-10-01", end: "2026-10-31", nextStart: "2026-11-01" };

  it("totals the window by day and category, fund-paid included, categories largest first with whole percents", () => {
    const txns = [
      txn("2026-11-03", 1250),
      txn("2026-11-03", 500, "travel", "holiday"),
      txn("2026-11-10", 3000, "travel"),
      txn("2026-10-10", 9999),
    ];
    const s = summariseExpenses(txns, current, previous, "2026-11-21");
    expect(s.totalPence).toBe(4750);
    expect(s.byDay.get("2026-11-03")).toBe(1750);
    expect(s.byDay.has("2026-10-10")).toBe(false);
    expect(s.categories).toEqual([
      { categoryId: "travel", pence: 3500, percent: 74 },
      { categoryId: "food", pence: 1250, percent: 26 },
    ]);
  });

  it("compares with the previous window via compareToPrevious (same elapsed days)", () => {
    const txns = [txn("2026-11-02", 22000), txn("2026-10-02", 10000), txn("2026-10-30", 50000)];
    const s = summariseExpenses(txns, current, previous, "2026-11-21");
    expect(s.comparison).toMatchObject({ currentPence: 22000, previousPence: 10000, diffPence: 12000, pct: 120 });
  });

  it("has no comparison when the previous window has no expenses", () => {
    expect(summariseExpenses([txn("2026-11-02", 100)], current, previous, "2026-11-21").comparison).toBeNull();
  });
});

describe("foldCategories", () => {
  it("keeps the largest and folds the rest into one Other slice", () => {
    const shares = [
      { categoryId: "a", pence: 500, percent: 50 },
      { categoryId: "b", pence: 300, percent: 30 },
      { categoryId: "c", pence: 150, percent: 15 },
      { categoryId: "d", pence: 50, percent: 5 },
    ];
    expect(foldCategories(shares, 2, 1000)).toEqual([
      { categoryId: "a", pence: 500, percent: 50 },
      { categoryId: "b", pence: 300, percent: 30 },
      { categoryId: null, pence: 200, percent: 20 },
    ]);
  });

  it("leaves a short list alone", () => {
    const shares = [{ categoryId: "a", pence: 500, percent: 100 }];
    expect(foldCategories(shares, 5, 500)).toEqual(shares);
  });
});
