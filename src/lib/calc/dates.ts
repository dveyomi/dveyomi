import type { Locale } from "@/lib/locale";
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

const formatters = new Map<string, Intl.DateTimeFormat>();

/** One formatter per locale and style, made on first use (the en-GB ones are what the app always had). */
function formatter(locale: Locale, style: "weekdayDate" | "dayMonth" | "dayMonthYear" | "shortDate"): Intl.DateTimeFormat {
  const key = `${locale}|${style}`;
  let f = formatters.get(key);
  if (!f) {
    const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
      weekdayDate: { weekday: "long", day: "numeric", month: "long" },
      dayMonth: { day: "numeric", month: "short" },
      dayMonthYear: { day: "numeric", month: "short", year: "numeric" },
      shortDate: { weekday: "short", day: "numeric", month: "short" },
    };
    f = new Intl.DateTimeFormat(locale, { ...options[style], timeZone: "UTC" });
    formatters.set(key, f);
  }
  return f;
}

/** A calendar date for people: "2026-11-25" -> "Wednesday 25 November" (zh-TW: "11月25日星期三"). */
export function formatWeekdayDate(d: IsoDate, locale: Locale = "en-GB"): string {
  return formatter(locale, "weekdayDate").format(toUtcMs(d)).replace(",", "");
}

/**
 * How a chosen date reads next to today, in English: "Today", "Tomorrow",
 * otherwise the weekday and date ("Wednesday 25 November"), with the year when
 * it differs from today's ("Friday 21 November 2025"). Other languages use
 * their dictionary's relativeDay.
 */
export function formatRelativeDay(d: IsoDate, today: IsoDate): string {
  const diff = daysBetween(today, d);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  const label = formatWeekdayDate(d);
  return d.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${d.slice(0, 4)}`;
}

/** "2026-11-01" -> "1 Nov" (zh-TW: "11月1日"). */
export function formatDayMonth(d: IsoDate, locale: Locale = "en-GB"): string {
  return formatter(locale, "dayMonth").format(toUtcMs(d));
}

/** "2027-07-31" -> "31 Jul 2027" (zh-TW: "2027年7月31日"). */
export function formatDayMonthYear(d: IsoDate, locale: Locale = "en-GB"): string {
  return formatter(locale, "dayMonthYear").format(toUtcMs(d));
}

/** "2026-11-21" -> "Sat 21 Nov" (zh-TW: "11月21日週六"). */
export function formatShortDate(d: IsoDate, locale: Locale = "en-GB"): string {
  return formatter(locale, "shortDate").format(toUtcMs(d)).replace(",", "");
}

/** 1 -> "1 day left", otherwise "N days left". */
export function formatDaysLeft(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"} left`;
}

/** ("2026-11-01", "2026-11-30") -> "1 Nov – 30 Nov". */
export function formatPeriodRange(start: IsoDate, end: IsoDate, locale: Locale = "en-GB"): string {
  return `${formatDayMonth(start, locale)} – ${formatDayMonth(end, locale)}`;
}
