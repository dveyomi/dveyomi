import { describe, expect, it } from "vitest";
import {
  amountOn,
  dueOccurrences,
  scheduleBetween,
  withPriceChange,
  type Rule,
} from "./recurring";

const rule = (over: Partial<Rule>): Rule => ({
  frequency: "weekly",
  anchorDate: "2026-11-02",
  endDate: null,
  pausedUntil: null,
  skippedDates: [],
  ...over,
});

describe("schedule", () => {
  it("weekly", () => {
    expect(dueOccurrences(rule({}), "2026-11-02", "2026-11-30")).toEqual([
      "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30",
    ]);
  });
  it("fortnightly", () => {
    expect(
      dueOccurrences(rule({ frequency: "fortnightly" }), "2026-11-01", "2026-12-31"),
    ).toEqual(["2026-11-02", "2026-11-16", "2026-11-30", "2026-12-14", "2026-12-28"]);
  });
  it("monthly anchored on the 31st", () => {
    expect(
      dueOccurrences(rule({ frequency: "monthly", anchorDate: "2026-01-31" }), "2026-01-01", "2026-04-30"),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("quarterly and annually from a leap day", () => {
    expect(
      dueOccurrences(rule({ frequency: "annually", anchorDate: "2024-02-29" }), "2024-01-01", "2028-12-31"),
    ).toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
    expect(
      dueOccurrences(rule({ frequency: "quarterly", anchorDate: "2024-02-29" }), "2024-01-01", "2025-03-01"),
    ).toEqual(["2024-02-29", "2024-05-29", "2024-08-29", "2024-11-29", "2025-02-28"]);
  });
  it("never produces dates before the anchor", () => {
    expect(dueOccurrences(rule({}), "2026-10-01", "2026-11-05")).toEqual(["2026-11-02"]);
  });
  it("pausedUntil marks earlier dates skipped, on/after due", () => {
    const r = rule({ pausedUntil: "2026-11-16" });
    expect(scheduleBetween(r, "2026-11-02", "2026-11-23")).toEqual([
      { date: "2026-11-02", skipped: true },
      { date: "2026-11-09", skipped: true },
      { date: "2026-11-16", skipped: false },
      { date: "2026-11-23", skipped: false },
    ]);
    expect(dueOccurrences(r, "2026-11-02", "2026-11-23")).toEqual(["2026-11-16", "2026-11-23"]);
  });
  it("skippedDates skips exactly one", () => {
    const r = rule({ skippedDates: ["2026-11-09"] });
    expect(dueOccurrences(r, "2026-11-02", "2026-11-23")).toEqual([
      "2026-11-02", "2026-11-16", "2026-11-23",
    ]);
    expect(scheduleBetween(r, "2026-11-09", "2026-11-09")).toEqual([
      { date: "2026-11-09", skipped: true },
    ]);
  });
  it("endDate is inclusive and stops generation", () => {
    const r = rule({ endDate: "2026-11-16" });
    expect(dueOccurrences(r, "2026-11-02", "2026-12-31")).toEqual([
      "2026-11-02", "2026-11-09", "2026-11-16",
    ]);
  });
  it("empty when from is after to", () => {
    expect(scheduleBetween(rule({}), "2026-11-30", "2026-11-02")).toEqual([]);
  });
});

describe("prices", () => {
  const prices = [
    { effectiveFrom: "2026-03-01", amountPence: 1200 },
    { effectiveFrom: "2023-01-01", amountPence: 800 },
  ];
  it("amountOn picks latest effective price", () => {
    expect(amountOn(prices, "2026-02-28")).toBe(800);
    expect(amountOn(prices, "2026-03-01")).toBe(1200);
  });
  it("amountOn throws when none applies", () => {
    expect(() => amountOn(prices, "2022-12-31")).toThrow();
  });
  it("withPriceChange keeps history, sorts, does not mutate", () => {
    const copy = JSON.parse(JSON.stringify(prices));
    const out = withPriceChange(prices, "2027-01-01", 1500);
    expect(prices).toEqual(copy);
    expect(out.map((p) => p.effectiveFrom)).toEqual(["2023-01-01", "2026-03-01", "2027-01-01"]);
  });
  it("withPriceChange replaces same effectiveFrom", () => {
    const out = withPriceChange(prices, "2026-03-01", 999);
    expect(out).toEqual([
      { effectiveFrom: "2023-01-01", amountPence: 800 },
      { effectiveFrom: "2026-03-01", amountPence: 999 },
    ]);
  });
});
