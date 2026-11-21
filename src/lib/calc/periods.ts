import { addDays, daysBetween, lastDayOfMonth, type IsoDate } from "./dates";

/** A budget period. `end` is inclusive; `nextStart` is `end` + 1 day. */
export type Period = { start: IsoDate; end: IsoDate; nextStart: IsoDate };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The reset date in a month: the start day, clamped to the month's last day. */
function startInMonth(year: number, month: number, startDay: number): IsoDate {
  return `${year}-${pad(month)}-${pad(Math.min(startDay, lastDayOfMonth(year, month)))}`;
}

function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const idx = year * 12 + (month - 1) + delta;
  return [Math.floor(idx / 12), (idx % 12) + 1];
}

function periodStartingIn(year: number, month: number, startDay: number): Period {
  const start = startInMonth(year, month, startDay);
  const [ny, nm] = shiftMonth(year, month, 1);
  const nextStart = startInMonth(ny, nm, startDay);
  return { start, end: addDays(nextStart, -1), nextStart };
}

/** The period that starts in month `yearMonth` ("2026-11"). With start day 1 it is that calendar month. */
export function periodStartingInMonth(yearMonth: string, startDay: number): Period {
  const [y, m] = yearMonth.split("-").map(Number);
  return periodStartingIn(y, m, startDay);
}

export function periodContaining(date: IsoDate, startDay: number): Period {
  const [y, m] = date.split("-").map(Number);
  if (date >= startInMonth(y, m, startDay)) return periodStartingIn(y, m, startDay);
  const [py, pm] = shiftMonth(y, m, -1);
  return periodStartingIn(py, pm, startDay);
}

/** Days remaining in the period counting `today`; at least 1. */
export function daysLeft(period: Period, today: IsoDate): number {
  return Math.max(1, daysBetween(today, period.nextStart));
}

export function previousPeriod(period: Period, startDay: number): Period {
  return periodContaining(addDays(period.start, -1), startDay);
}

/**
 * The period that starts on `start` and runs until the start day next comes
 * round. After a start-day change the next budget is this one: it starts the
 * day after the current one ends and ends the day before the new start day.
 */
export function periodStartingOn(start: IsoDate, startDay: number): Period {
  const { end, nextStart } = periodContaining(start, startDay);
  return { start, end, nextStart };
}

/** "First day of the month" for 1, otherwise an ordinal such as "25th". */
export function startDayLabel(day: number): string {
  if (day === 1) return "First day of the month";
  const tens = day % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as const)[day % 10 as 1 | 2 | 3] ?? "th";
  return `${day}${suffix}`;
}
