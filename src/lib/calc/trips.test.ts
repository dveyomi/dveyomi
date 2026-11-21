import { describe, expect, it } from "vitest";
import type { Txn } from "./budget";
import { formatTripRange, summariseTrip, tripLength, tripOn } from "./trips";

const taiwan = { start: "2026-12-01", end: "2026-12-15" };
const txn = (id: string, date: string, amountPence: number, categoryId = "food", fundId: string | null = null): Txn => ({
  id,
  date,
  amountPence,
  categoryId,
  fundId,
});

describe("tripOn", () => {
  const trips = [
    { id: "t1", ...taiwan },
    { id: "t2", start: "2027-03-01", end: "2027-03-03" },
  ];
  it("finds the trip whose dates include the day, ends included", () => {
    expect(tripOn(trips, "2026-12-01")?.id).toBe("t1");
    expect(tripOn(trips, "2026-12-15")?.id).toBe("t1");
    expect(tripOn(trips, "2027-03-02")?.id).toBe("t2");
  });
  it("is null outside every trip", () => {
    expect(tripOn(trips, "2026-11-30")).toBeNull();
    expect(tripOn(trips, "2026-12-16")).toBeNull();
    expect(tripOn([], "2026-12-03")).toBeNull();
  });
});

describe("tripLength", () => {
  it("counts both ends", () => {
    expect(tripLength(taiwan)).toBe(15);
    expect(tripLength({ start: "2026-12-01", end: "2026-12-01" })).toBe(1);
  });
});

describe("formatTripRange", () => {
  it("shortens within a month, a year, and across years", () => {
    expect(formatTripRange("2026-12-01", "2026-12-15")).toBe("1–15 Dec 2026");
    expect(formatTripRange("2026-12-01", "2026-12-01")).toBe("1 Dec 2026");
    expect(formatTripRange("2026-11-28", "2026-12-03")).toBe("28 Nov – 3 Dec 2026");
    expect(formatTripRange("2026-12-28", "2027-01-03")).toBe("28 Dec 2026 – 3 Jan 2027");
  });
});

describe("summariseTrip", () => {
  it("totals every expense given, fund-paid ones included, per category largest first", () => {
    const s = summariseTrip(
      [txn("a", "2026-12-03", 1250, "food"), txn("b", "2026-12-10", 30000, "travel", "fund-1"), txn("c", "2026-12-10", 750, "food")],
      taiwan,
    );
    expect(s.totalPence).toBe(32000);
    expect(s.categories).toEqual([
      { categoryId: "travel", pence: 30000, percent: 94 },
      { categoryId: "food", pence: 2000, percent: 6 },
    ]);
  });

  it("lists every day of the trip in order, empty days as 0", () => {
    const s = summariseTrip([txn("a", "2026-12-03", 1250), txn("b", "2026-12-03", 750)], { start: "2026-12-01", end: "2026-12-04" });
    expect(s.days).toEqual([
      { date: "2026-12-01", pence: 0 },
      { date: "2026-12-02", pence: 0 },
      { date: "2026-12-03", pence: 2000 },
      { date: "2026-12-04", pence: 0 },
    ]);
  });

  it("counts an expense added by hand from outside the dates, and lists its day too", () => {
    const s = summariseTrip([txn("a", "2026-12-02", 1000), txn("pre", "2026-11-20", 50000, "travel")], {
      start: "2026-12-01",
      end: "2026-12-02",
    });
    expect(s.totalPence).toBe(51000);
    expect(s.days).toEqual([
      { date: "2026-11-20", pence: 50000 },
      { date: "2026-12-01", pence: 0 },
      { date: "2026-12-02", pence: 1000 },
    ]);
  });

  it("is zero with no expenses", () => {
    const s = summariseTrip([], taiwan);
    expect(s.totalPence).toBe(0);
    expect(s.categories).toEqual([]);
    expect(s.days).toHaveLength(15);
  });
});
