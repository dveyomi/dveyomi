import { addDays, lastDayOfMonth, type IsoDate } from "./dates";

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
