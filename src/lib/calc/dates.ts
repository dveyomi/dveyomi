/** A calendar date as YYYY-MM-DD. Never a timestamp. */
export type IsoDate = string;

const MS_PER_DAY = 86_400_000;

function toUtcMs(d: IsoDate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtcMs(toUtcMs(d) + n * MS_PER_DAY);
}

/** Whole days from `from` to `to` (to - from). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/** The calendar date in `timeZone` at instant `now`. */
export function todayIn(timeZone: string, now: Date): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

const weekdayDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** A calendar date for people, in en-GB: "2026-11-25" -> "Wednesday 25 November". */
export function formatWeekdayDate(d: IsoDate): string {
  return weekdayDate.format(toUtcMs(d)).replace(",", "");
}
