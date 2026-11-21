import { addDays, daysBetween, lastDayOfMonth, type IsoDate } from "./dates";
import type { Period } from "./periods";

export type Frequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annually";
export type Price = { effectiveFrom: IsoDate; amountPence: number };
export type Rule = {
  frequency: Frequency;
  anchorDate: IsoDate;
  endDate: IsoDate | null;
  pausedUntil: IsoDate | null;
  skippedDates: IsoDate[];
};

const MONTH_STEP = { monthly: 1, quarterly: 3, annually: 12 } as const;

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Occurrence k (k >= 0), always derived from the anchor, never the previous occurrence. */
function occurrence(rule: Rule, k: number): IsoDate {
  const { frequency, anchorDate } = rule;
  if (frequency === "weekly") return addDays(anchorDate, 7 * k);
  if (frequency === "fortnightly") return addDays(anchorDate, 14 * k);
  const [y, m, d] = anchorDate.split("-").map(Number);
  const total = y * 12 + (m - 1) + k * MONTH_STEP[frequency];
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(d, lastDayOfMonth(year, month));
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Occurrences in [from, to] inclusive; skipped = paused or in skippedDates. */
export function scheduleBetween(
  rule: Rule,
  from: IsoDate,
  to: IsoDate,
): { date: IsoDate; skipped: boolean }[] {
  const out: { date: IsoDate; skipped: boolean }[] = [];
  for (let k = 0; ; k++) {
    const date = occurrence(rule, k);
    if (date > to) break;
    if (rule.endDate !== null && date > rule.endDate) break;
    if (date < from) continue;
    const paused = rule.pausedUntil !== null && date < rule.pausedUntil;
    out.push({ date, skipped: paused || rule.skippedDates.includes(date) });
  }
  return out;
}

export function dueOccurrences(rule: Rule, from: IsoDate, to: IsoDate): IsoDate[] {
  return scheduleBetween(rule, from, to)
    .filter((o) => !o.skipped)
    .map((o) => o.date);
}

/** The price with the latest effectiveFrom <= date. Throws if none applies. */
export function amountOn(prices: Price[], date: IsoDate): number {
  let best: Price | null = null;
  for (const p of prices) {
    if (p.effectiveFrom <= date && (best === null || p.effectiveFrom > best.effectiveFrom)) {
      best = p;
    }
  }
  if (best === null) throw new Error(`No price applies on ${date}`);
  return best.amountPence;
}

/** New history sorted by effectiveFrom; replaces an entry with the same effectiveFrom. */
export function withPriceChange(
  prices: Price[],
  effectiveFrom: IsoDate,
  amountPence: number,
): Price[] {
  return [...prices.filter((p) => p.effectiveFrom !== effectiveFrom), { effectiveFrom, amountPence }].sort(
    (a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0),
  );
}

/** The first due (not paused or skipped) date on or after `from`, or null when the rule has ended. */
export function nextDue(rule: Rule, from: IsoDate): IsoDate | null {
  // Search a year (and a bit) at a time: a long pause or several skips push it further out.
  let start = from < rule.anchorDate ? rule.anchorDate : from;
  for (let i = 0; i < 20; i++) {
    if (rule.endDate !== null && start > rule.endDate) return null;
    const end = addDays(start, 400);
    const due = dueOccurrences(rule, start, end);
    if (due.length > 0) return due[0];
    start = addDays(end, 1);
  }
  return null;
}

/** The amount on `date`; before the first price takes effect (a rule that starts later), the first price. */
export function currentAmount(prices: Price[], date: IsoDate): number {
  if (prices.length === 0) throw new Error("A recurring payment needs a price");
  const first = prices.reduce((a, b) => (b.effectiveFrom < a.effectiveFrom ? b : a));
  return amountOn(prices, date < first.effectiveFrom ? first.effectiveFrom : date);
}

export type RecurringStatus =
  | { kind: "active" }
  | { kind: "paused"; until: IsoDate }
  | { kind: "ends"; on: IsoDate };

/** How a rule stands on `today`: ending (it has an end date), paused until a later date, or active. */
export function recurringStatus(rule: Rule, today: IsoDate): RecurringStatus {
  if (rule.endDate !== null) return { kind: "ends", on: rule.endDate };
  if (rule.pausedUntil !== null && rule.pausedUntil > today) return { kind: "paused", until: rule.pausedUntil };
  return { kind: "active" };
}

/**
 * What pausing until `until` frees in `period`: the payments still to come
 * (from tomorrow; today's has already been added) up to the day before
 * `until`, within the period, each at its own date's price. Payments already
 * skipped or paused don't count.
 */
export function freedByPause(rule: Rule, prices: Price[], until: IsoDate, period: Period, today: IsoDate): number {
  const tomorrow = addDays(today, 1);
  const from = tomorrow > period.start ? tomorrow : period.start;
  const dayBefore = addDays(until, -1);
  const to = dayBefore < period.end ? dayBefore : period.end;
  return dueOccurrences(rule, from, to).reduce((sum, d) => sum + amountOn(prices, d), 0);
}

/**
 * What a rule's pauses and skips kept out of `period` (an ended period's
 * review): the payments due in it that were paused or skipped, each at its
 * own date's price (the first price before any applies). `paidDates` are
 * dates the rule's payment was recorded anyway (before a later pause), so
 * nothing was freed on them.
 *
 * Pause history isn't stored: the rule's current pausedUntil and skippedDates
 * are used, so a pause lifted before the review no longer counts as freeing
 * anything in an earlier period.
 */
export function freedInPeriod(rule: Rule, prices: Price[], period: Period, paidDates: IsoDate[] = []): number {
  return scheduleBetween(rule, period.start, period.end)
    .filter((o) => o.skipped && !paidDates.includes(o.date))
    .reduce((sum, o) => sum + currentAmount(prices, o.date), 0);
}

/** A payment name compared loosely: trimmed, lower case, single spaces. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The frequency a gap in days fits, allowing for months of 28–31 days, or null. */
function frequencyOfGap(days: number): Frequency | null {
  if (days >= 6 && days <= 8) return "weekly";
  if (days >= 13 && days <= 15) return "fortnightly";
  if (days >= 28 && days <= 31) return "monthly";
  if (days >= 89 && days <= 92) return "quarterly";
  if (days >= 364 && days <= 366) return "annually";
  return null;
}

/**
 * How far back detection looks for each frequency: far enough to see three
 * payments even when the latest was nearly a full interval ago (three
 * intervals and a little slack). Weekly to monthly: 120 days; quarterly:
 * 300; annually: 1,100.
 */
export const DETECTION_WINDOW_DAYS: Record<Frequency, number> = {
  weekly: 120,
  fortnightly: 120,
  monthly: 120,
  quarterly: 300,
  annually: 1100,
};

export type Detection<T> = { name: string; nameKey: string; frequency: Frequency; payments: T[] };

/**
 * Payments that look recurring (§5.8): at least three with the same name
 * (ignoring case and spacing) whose latest three are an even interval apart
 * (weekly, fortnightly, monthly, quarterly or annually). Each hit names the
 * latest payment's spelling and lists those three payments, oldest first.
 */
export function detectRecurring<T extends { name: string; date: IsoDate }>(txns: T[]): Detection<T>[] {
  const groups = new Map<string, T[]>();
  for (const t of txns) {
    const key = nameKey(t.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const hits: Detection<T>[] = [];
  for (const [key, group] of groups) {
    const latest = group.toSorted((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-3);
    if (latest.length < 3) continue;
    const first = frequencyOfGap(daysBetween(latest[0].date, latest[1].date));
    const second = frequencyOfGap(daysBetween(latest[1].date, latest[2].date));
    if (first === null || first !== second) continue;
    hits.push({ name: latest[2].name.trim(), nameKey: key, frequency: first, payments: latest });
  }
  return hits;
}
