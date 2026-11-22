import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDaysLeft, formatDayMonth, formatPeriodRange, formatRelativeDay, formatShortDate, formatDayMonthYear, formatWeekdayDate, lastDayOfMonth, todayIn } from "./dates";

describe("dates", () => {
  it("addDays crosses year end", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("daysBetween is to minus from", () => {
    expect(daysBetween("2026-11-21", "2026-11-25")).toBe(4);
  });
  it("lastDayOfMonth handles leap years", () => {
    expect(lastDayOfMonth(2028, 2)).toBe(29);
  });
  it("todayIn uses the given time zone", () => {
    expect(todayIn("Asia/Taipei", new Date("2026-11-20T20:00:00Z"))).toBe("2026-11-21");
  });
});

describe("formatWeekdayDate", () => {
  it("formats a calendar date in en-GB as weekday, day and month", () => {
    expect(formatWeekdayDate("2026-11-25")).toBe("Wednesday 25 November");
    expect(formatWeekdayDate("2027-01-01")).toBe("Friday 1 January");
  });
});

describe("formatDayMonth", () => {
  it("formats a calendar date as day and short month", () => {
    expect(formatDayMonth("2026-11-01")).toBe("1 Nov");
    expect(formatDayMonth("2026-12-31")).toBe("31 Dec");
  });
});

describe("formatShortDate", () => {
  it("formats a calendar date as short weekday, day and short month", () => {
    expect(formatShortDate("2026-11-21")).toBe("Sat 21 Nov");
  });
});

describe("formatDaysLeft", () => {
  it("pluralises", () => {
    expect(formatDaysLeft(1)).toBe("1 day left");
    expect(formatDaysLeft(0)).toBe("0 days left");
    expect(formatDaysLeft(5)).toBe("5 days left");
  });
});

describe("formatPeriodRange", () => {
  it("formats start and end as day and short month", () => {
    expect(formatPeriodRange("2026-11-01", "2026-11-30")).toBe("1 Nov – 30 Nov");
  });
});

describe("formatRelativeDay", () => {
  it('says "Today" and "Tomorrow" where they apply', () => {
    expect(formatRelativeDay("2026-11-21", "2026-11-21")).toBe("Today");
    expect(formatRelativeDay("2026-11-22", "2026-11-21")).toBe("Tomorrow");
    expect(formatRelativeDay("2026-12-01", "2026-11-30")).toBe("Tomorrow");
  });

  it("otherwise gives the weekday and date, with the year when it isn't this year", () => {
    expect(formatRelativeDay("2026-11-20", "2026-11-21")).toBe("Friday 20 November");
    expect(formatRelativeDay("2026-11-25", "2026-11-21")).toBe("Wednesday 25 November");
    expect(formatRelativeDay("2025-11-21", "2026-11-21")).toBe("Friday 21 November 2025");
    expect(formatRelativeDay("2027-01-01", "2026-12-31")).toBe("Tomorrow");
    expect(formatRelativeDay("2027-01-02", "2026-12-31")).toBe("Saturday 2 January 2027");
  });
});

describe("formatDayMonthYear", () => {
  it("is the day, short month and year", () => {
    expect(formatDayMonthYear("2027-07-31")).toBe("31 Jul 2027");
  });
});

describe("dates in Traditional Chinese", () => {
  it("formats with Intl zh-TW", () => {
    expect(formatWeekdayDate("2026-11-22", "zh-TW")).toBe("11月22日星期日");
    expect(formatDayMonth("2026-11-22", "zh-TW")).toBe("11月22日");
    expect(formatDayMonthYear("2026-11-22", "zh-TW")).toBe("2026年11月22日");
    expect(formatShortDate("2026-11-22", "zh-TW")).toBe("11月22日週日");
    expect(formatPeriodRange("2026-10-25", "2026-11-24", "zh-TW")).toBe("10月25日 – 11月24日");
  });
});
