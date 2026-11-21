import { describe, expect, it } from "vitest";
import { compareToPrevious } from "./comparison";
import type { Txn } from "./budget";
import type { Period } from "./periods";

const prev: Period = { start: "2026-10-01", end: "2026-10-31", nextStart: "2026-11-01" };
const cur: Period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
const t = (id: string, amountPence: number, date: string, fundId: string | null = null): Txn => ({
  id, amountPence, date, categoryId: "c1", fundId,
});

describe("compareToPrevious", () => {
  it("mid-period compares only the first N days of the previous period", () => {
    const txns = [
      t("p1", 1000, "2026-10-01"),
      t("p3", 1000, "2026-10-03"),
      t("p4", 9999, "2026-10-04"), // day N+1, excluded
      t("c1", 3000, "2026-11-03"),
    ];
    const r = compareToPrevious(txns, cur, prev, "2026-11-03");
    expect(r).toEqual({ currentPence: 3000, previousPence: 2000, diffPence: 1000, pct: 50, direction: "up" });
  });

  it("does not count current txns after today", () => {
    const txns = [t("p1", 1000, "2026-10-01"), t("c1", 500, "2026-11-01"), t("c2", 700, "2026-11-10")];
    expect(compareToPrevious(txns, cur, prev, "2026-11-01")?.currentPence).toBe(500);
  });

  it("compares full periods once the current one has ended", () => {
    const txns = [t("p1", 1000, "2026-10-01"), t("p2", 1000, "2026-10-31"), t("c1", 1500, "2026-11-30")];
    const r = compareToPrevious(txns, cur, prev, "2026-12-05");
    expect(r).toEqual({ currentPence: 1500, previousPence: 2000, diffPence: -500, pct: -25, direction: "down" });
  });

  it("rounds pct to one decimal", () => {
    const txns = [t("p", 3, "2026-10-01"), t("c", 4, "2026-11-01")];
    expect(compareToPrevious(txns, cur, prev, "2026-12-01")?.pct).toBe(33.3);
  });

  it("returns null when the previous period has no transactions", () => {
    expect(compareToPrevious([t("c", 100, "2026-11-02")], cur, prev, "2026-11-05")).toBeNull();
  });

  it("returns same with pct 0 for equal spend", () => {
    const txns = [t("p", 800, "2026-10-02"), t("c", 800, "2026-11-02")];
    expect(compareToPrevious(txns, cur, prev, "2026-12-01")).toEqual({
      currentPence: 800, previousPence: 800, diffPence: 0, pct: 0, direction: "same",
    });
  });

  it("pct is null when previous window is zero but previous period has txns", () => {
    const txns = [t("p", 800, "2026-10-20"), t("c", 100, "2026-11-02")];
    const r = compareToPrevious(txns, cur, prev, "2026-11-05");
    expect(r).toEqual({ currentPence: 100, previousPence: 0, diffPence: 100, pct: null, direction: "up" });
  });

  it("includes fund-paid expenses", () => {
    const txns = [t("p", 100, "2026-10-02", "f"), t("c", 300, "2026-11-02", "f")];
    expect(compareToPrevious(txns, cur, prev, "2026-12-01")?.currentPence).toBe(300);
  });
});
