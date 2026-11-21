import { describe, expect, it } from "vitest";
import {
  amountOn,
  currentAmount,
  DETECTION_WINDOW_DAYS,
  detectRecurring,
  dueOccurrences,
  freedByPause,
  nameKey,
  nextDue,
  recurringStatus,
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

describe("nextDue", () => {
  it("is the first due date on or after `from`", () => {
    expect(nextDue(rule({}), "2026-11-10")).toBe("2026-11-16");
    expect(nextDue(rule({}), "2026-11-16")).toBe("2026-11-16");
  });
  it("is the anchor when `from` is before it", () => {
    expect(nextDue(rule({}), "2026-10-01")).toBe("2026-11-02");
  });
  it("passes over paused and skipped dates", () => {
    expect(nextDue(rule({ pausedUntil: "2026-11-20", skippedDates: ["2026-11-23"] }), "2026-11-03")).toBe("2026-11-30");
  });
  it("is null once the rule has ended", () => {
    expect(nextDue(rule({ endDate: "2026-11-10" }), "2026-11-10")).toBeNull();
  });
});

describe("currentAmount", () => {
  it("is the price on the day, or the first price when every price starts later", () => {
    const prices = [
      { effectiveFrom: "2026-12-01", amountPence: 1200 },
      { effectiveFrom: "2026-11-25", amountPence: 800 },
    ];
    expect(currentAmount(prices, "2026-11-30")).toBe(800);
    expect(currentAmount(prices, "2026-12-01")).toBe(1200);
    expect(currentAmount(prices, "2026-11-01")).toBe(800);
  });
});

describe("recurringStatus", () => {
  it("active, paused until a later date, or ending on its end date", () => {
    expect(recurringStatus(rule({}), "2026-11-21")).toEqual({ kind: "active" });
    expect(recurringStatus(rule({ pausedUntil: "2026-12-01" }), "2026-11-21")).toEqual({ kind: "paused", until: "2026-12-01" });
    expect(recurringStatus(rule({ pausedUntil: "2026-11-21" }), "2026-11-21")).toEqual({ kind: "active" });
    expect(recurringStatus(rule({ endDate: "2026-11-21" }), "2026-11-21")).toEqual({ kind: "ends", on: "2026-11-21" });
  });
});

describe("freedByPause", () => {
  const period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
  const prices = [{ effectiveFrom: "2026-11-02", amountPence: 1000 }];
  it("adds up the payments the pause skips from tomorrow to the period's end", () => {
    // Weekly from 2 Nov; today 21 Nov; paused until 1 Mar: 23 and 30 Nov are freed.
    expect(freedByPause(rule({}), prices, "2027-03-01", period, "2026-11-21")).toBe(2000);
  });
  it("stops at the pause's end date (it is due again that day)", () => {
    expect(freedByPause(rule({}), prices, "2026-11-30", period, "2026-11-21")).toBe(1000);
  });
  it("leaves out payments already skipped or already past", () => {
    expect(freedByPause(rule({ skippedDates: ["2026-11-23"] }), prices, "2027-03-01", period, "2026-11-21")).toBe(1000);
    expect(freedByPause(rule({}), prices, "2027-03-01", period, "2026-11-30")).toBe(0);
  });
  it("uses each date's price", () => {
    const changing = [...prices, { effectiveFrom: "2026-11-30", amountPence: 1500 }];
    expect(freedByPause(rule({}), changing, "2027-03-01", period, "2026-11-21")).toBe(2500);
  });
});

describe("detectRecurring", () => {
  const pay = (id: string, name: string, date: string) => ({ id, name, date });
  it("flags three monthly payments with the same name", () => {
    const hits = detectRecurring([
      pay("1", "Spotify", "2026-09-15"),
      pay("2", "spotify ", "2026-10-15"),
      pay("3", "Spotify", "2026-11-15"),
      pay("4", "Tesco", "2026-11-02"),
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ name: "Spotify", frequency: "monthly", nameKey: "spotify" });
    expect(hits[0].payments.map((p) => p.id)).toEqual(["1", "2", "3"]);
  });
  it("does not flag two", () => {
    expect(detectRecurring([pay("1", "Spotify", "2026-10-15"), pay("2", "Spotify", "2026-11-15")])).toEqual([]);
  });
  it("needs an even interval", () => {
    expect(
      detectRecurring([pay("1", "Gym", "2026-11-01"), pay("2", "Gym", "2026-11-08"), pay("3", "Gym", "2026-11-22")]),
    ).toEqual([]);
  });
  it("recognises weekly, fortnightly, quarterly and annual intervals from the latest three", () => {
    const freq = (dates: string[]) => detectRecurring(dates.map((d, i) => pay(String(i), "X", d)))[0]?.frequency;
    expect(freq(["2026-11-01", "2026-11-08", "2026-11-15"])).toBe("weekly");
    expect(freq(["2026-10-18", "2026-11-01", "2026-11-15"])).toBe("fortnightly");
    expect(freq(["2026-05-01", "2026-08-01", "2026-11-01"])).toBe("quarterly");
    expect(freq(["2024-11-01", "2025-11-01", "2026-11-01"])).toBe("annually");
    // An old, irregular payment before the latest three doesn't matter.
    expect(freq(["2026-06-03", "2026-11-01", "2026-11-08", "2026-11-15"])).toBe("weekly");
  });
});

describe("DETECTION_WINDOW_DAYS", () => {
  it("reaches back far enough to see three payments of each frequency", () => {
    expect(DETECTION_WINDOW_DAYS).toEqual({ weekly: 120, fortnightly: 120, monthly: 120, quarterly: 300, annually: 1100 });
    // Three payments, the latest up to an interval ago.
    expect(DETECTION_WINDOW_DAYS.monthly).toBeGreaterThanOrEqual(3 * 31);
    expect(DETECTION_WINDOW_DAYS.quarterly).toBeGreaterThanOrEqual(3 * 92);
    expect(DETECTION_WINDOW_DAYS.annually).toBeGreaterThanOrEqual(3 * 366);
  });
});

describe("nameKey", () => {
  it("ignores case and extra spaces", () => {
    expect(nameKey("  Spotify   Premium ")).toBe("spotify premium");
  });
});
