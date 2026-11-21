import { addDays, daysBetween, type IsoDate } from "./dates";
import type { Txn } from "./budget";
import type { Period } from "./periods";
import { totalSpent } from "./totals";

export type Comparison = {
  currentPence: number;
  previousPence: number;
  diffPence: number;
  /** Percentage change, one decimal; null when the previous window spend is 0. */
  pct: number | null;
  direction: "up" | "down" | "same";
};

/**
 * Compare spend in `current` with `previous`. While `today` is inside `current`,
 * only the same number of elapsed days of `previous` is counted. Returns null
 * when `previous` has no transactions at all.
 */
export function compareToPrevious(
  txns: Txn[],
  current: Period,
  previous: Period,
  today: IsoDate,
): Comparison | null {
  if (!txns.some((t) => t.date >= previous.start && t.date <= previous.end)) return null;

  let currentWindow = current;
  let previousWindow = previous;
  if (today >= current.start && today <= current.end) {
    const elapsed = daysBetween(current.start, today) + 1;
    currentWindow = { ...current, end: today };
    const prevEnd = addDays(previous.start, elapsed - 1);
    previousWindow = { ...previous, end: prevEnd < previous.end ? prevEnd : previous.end };
  }

  const currentPence = totalSpent(txns, currentWindow);
  const previousPence = totalSpent(txns, previousWindow);
  const diffPence = currentPence - previousPence;
  return {
    currentPence,
    previousPence,
    diffPence,
    pct: previousPence === 0 ? null : Math.round((diffPence / previousPence) * 1000) / 10,
    direction: diffPence > 0 ? "up" : diffPence < 0 ? "down" : "same",
  };
}
