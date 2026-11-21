import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatWeekdayDate, lastDayOfMonth, todayIn } from "./dates";

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
