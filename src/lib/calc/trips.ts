import type { Txn } from "./budget";
import { addDays, daysBetween, formatDayMonthYear, type IsoDate } from "./dates";
import type { CategoryShare } from "./expenses";
import { divRound } from "./money";
import { totalsByCategory, totalsByDay, totalSpent } from "./totals";

/**
 * Trips (§5.12): a trip is a label on expenses, never a budget. These figures
 * INCLUDE fund-paid expenses, like the Expenses tab, and never feed
 * `summarise`.
 */

/** A trip's dates, both included. */
export type TripRange = { start: IsoDate; end: IsoDate };

export type TripSummary = {
  totalPence: number;
  /** Largest first. */
  categories: CategoryShare[];
  /** Every day of the trip in order (0 when nothing was spent), plus any day outside it with an expense added by hand. */
  days: { date: IsoDate; pence: number }[];
};

/** The trip whose dates include `date`, or null. Trips never overlap, so there is at most one. */
export function tripOn<T extends TripRange>(trips: T[], date: IsoDate): T | null {
  return trips.find((t) => date >= t.start && date <= t.end) ?? null;
}

/** Days in the trip, counting both ends. */
export function tripLength(trip: TripRange): number {
  return daysBetween(trip.start, trip.end) + 1;
}

/** "1–15 Dec 2026", "28 Nov – 3 Dec 2026", "28 Dec 2026 – 3 Jan 2027", or "1 Dec 2026" for one day. */
export function formatTripRange(start: IsoDate, end: IsoDate): string {
  const to = formatDayMonthYear(end);
  if (start === end) return to;
  const from = formatDayMonthYear(start);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8))}–${to}`;
  if (start.slice(0, 4) === end.slice(0, 4)) return `${from.slice(0, -5)} – ${to}`;
  return `${from} – ${to}`;
}

const share = (pence: number, total: number) => (total === 0 ? 0 : divRound(pence * 100, total));

/**
 * The trip screen's figures from the trip's expenses (those dated inside it
 * plus any added by hand, as the data layer selects them): the total, each
 * category's spend and share, and the spend per day.
 */
export function summariseTrip(txns: Txn[], trip: TripRange): TripSummary {
  // Expenses added by hand can sit outside the dates: count over a span that covers them too.
  let start = trip.start;
  let end = trip.end;
  for (const t of txns) {
    if (t.date < start) start = t.date;
    if (t.date > end) end = t.date;
  }
  const span = { start, end, nextStart: addDays(end, 1) };
  const totalPence = totalSpent(txns, span);
  const categories = [...totalsByCategory(txns, span)]
    .map(([categoryId, pence]) => ({ categoryId, pence, percent: share(pence, totalPence) }))
    .sort((a, b) => b.pence - a.pence || a.categoryId.localeCompare(b.categoryId));

  const byDay = totalsByDay(txns);
  const dates = new Set<IsoDate>(byDay.keys());
  for (let d = trip.start; d <= trip.end; d = addDays(d, 1)) dates.add(d);
  const days = [...dates].sort().map((date) => ({ date, pence: byDay.get(date) ?? 0 }));
  return { totalPence, categories, days };
}
