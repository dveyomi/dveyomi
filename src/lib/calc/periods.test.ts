import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "./dates";
import { daysLeft, periodContaining, periodStartingOn, previousPeriod, startDayLabel } from "./periods";

describe("periodContaining", () => {
  it("start day 25", () => {
    expect(periodContaining("2026-11-21", 25)).toEqual({
      start: "2026-10-25",
      end: "2026-11-24",
      nextStart: "2026-11-25",
    });
    expect(periodContaining("2026-11-25", 25).start).toBe("2026-11-25");
  });

  it("start day 31 clamps to the last day of short months", () => {
    const p = periodContaining("2027-02-15", 31);
    expect(p.start).toBe("2027-01-31");
    expect(p.nextStart).toBe("2027-02-28");
    expect(p.end).toBe("2027-02-27");
    const q = periodContaining("2027-02-28", 31);
    expect(q.start).toBe("2027-02-28");
    expect(q.nextStart).toBe("2027-03-31");
  });

  it("start day 30 in a leap year", () => {
    expect(periodContaining("2028-02-10", 30).nextStart).toBe("2028-02-29");
    expect(periodContaining("2028-02-29", 30).start).toBe("2028-02-29");
  });

  it("start day 1 is the calendar month", () => {
    expect(periodContaining("2026-12-31", 1)).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
      nextStart: "2027-01-01",
    });
  });

  it("crosses the year boundary", () => {
    const p = periodContaining("2027-01-05", 25);
    expect(p.start).toBe("2026-12-25");
    expect(p.nextStart).toBe("2027-01-25");
  });
});

describe("daysLeft", () => {
  it("counts today, minimum 1", () => {
    const p = periodContaining("2026-11-21", 25);
    expect(daysLeft(p, "2026-11-21")).toBe(4);
    expect(daysLeft(p, "2026-11-24")).toBe(1);
    expect(daysLeft(p, "2026-10-25")).toBe(31);
  });
});

describe("previousPeriod", () => {
  it("steps back one period", () => {
    const p = periodContaining("2026-11-25", 25);
    const prev = previousPeriod(p, 25);
    expect(prev.start).toBe("2026-10-25");
    expect(prev.nextStart).toBe("2026-11-25");
  });

  it("handles clamped starts", () => {
    const p = periodContaining("2027-03-31", 31);
    expect(previousPeriod(p, 31)).toEqual({
      start: "2027-02-28",
      end: "2027-03-30",
      nextStart: "2027-03-31",
    });
  });
});

describe("every date in exactly one period", () => {
  for (const startDay of [1, 25, 29, 30, 31]) {
    for (const [from, to] of [["2027-01-01", "2027-12-31"], ["2028-01-01", "2028-12-31"]]) {
      it(`start day ${startDay}, ${from.slice(0, 4)}`, () => {
        const n = daysBetween(from, to);
        let prev = periodContaining(from, startDay);
        for (let i = 0; i <= n; i++) {
          const d = addDays(from, i);
          const p = periodContaining(d, startDay);
          expect(p.start <= d && d <= p.end).toBe(true);
          expect(p.nextStart).toBe(addDays(p.end, 1));
          if (p.start !== prev.start) {
            expect(p.start).toBe(prev.nextStart);
            expect(prev.end).toBe(addDays(p.start, -1));
          }
          prev = p;
        }
      });
    }
  }
});

describe("periodStartingOn", () => {
  it("runs from the given date to the day before the start day comes round", () => {
    // After moving from the 1st to the 15th, the next budget starts 1 Dec and ends 14 Dec.
    expect(periodStartingOn("2026-12-01", 15)).toEqual({ start: "2026-12-01", end: "2026-12-14", nextStart: "2026-12-15" });
  });

  it("is a whole period when the date is itself a start day", () => {
    expect(periodStartingOn("2026-12-01", 1)).toEqual(periodContaining("2026-12-01", 1));
    expect(periodStartingOn("2026-12-15", 15)).toEqual({ start: "2026-12-15", end: "2027-01-14", nextStart: "2027-01-15" });
  });

  it("starting the day after a start day runs to the next one", () => {
    expect(periodStartingOn("2026-12-02", 1)).toEqual({ start: "2026-12-02", end: "2026-12-31", nextStart: "2027-01-01" });
  });

  it("clamps start day 31 in February", () => {
    expect(periodStartingOn("2027-02-01", 31)).toEqual({ start: "2027-02-01", end: "2027-02-27", nextStart: "2027-02-28" });
  });
});

describe("startDayLabel", () => {
  it("is 'First day of the month' for 1 and an ordinal otherwise", () => {
    expect(startDayLabel(1)).toBe("First day of the month");
    expect([2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(startDayLabel)).toEqual([
      "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st",
    ]);
  });
});
