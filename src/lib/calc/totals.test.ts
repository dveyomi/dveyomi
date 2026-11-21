import { describe, expect, it } from "vitest";
import { totalsByCategory, totalsByDay, totalSpent } from "./totals";
import type { Txn } from "./budget";
import type { Period } from "./periods";

const period: Period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
const t = (id: string, amountPence: number, date: string, categoryId = "c1", fundId: string | null = null): Txn => ({
  id, amountPence, date, categoryId, fundId,
});

describe("totals", () => {
  it("totalsByDay sums two txns on one date", () => {
    const m = totalsByDay([t("a", 100, "2026-11-02"), t("b", 250, "2026-11-02"), t("c", 5, "2026-11-03")]);
    expect(m.get("2026-11-02")).toBe(350);
    expect(m.get("2026-11-03")).toBe(5);
  });

  it("includes fund-paid expenses in totalSpent and totalsByCategory", () => {
    const txns = [t("a", 100, "2026-11-02", "c1"), t("b", 400, "2026-11-03", "c2", "fund1")];
    expect(totalSpent(txns, period)).toBe(500);
    expect(totalsByCategory(txns, period).get("c2")).toBe(400);
  });

  it("ignores txns outside the period", () => {
    const txns = [t("a", 100, "2026-10-31"), t("b", 200, "2026-11-01"), t("c", 300, "2026-12-01")];
    expect(totalSpent(txns, period)).toBe(200);
    expect(totalsByCategory(txns, period).get("c1")).toBe(200);
  });
});
