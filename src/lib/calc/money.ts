/** Money is integer pence everywhere. */

/** Parse a user-entered GBP amount into positive integer pence, or null if invalid. */
export function parsePence(input: string): number | null {
  const s = input.trim().replace(/^£/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [pounds, frac = ""] = s.split(".");
  const pence = Number(pounds) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(pence) && pence > 0 ? pence : null;
}

/** Format integer pence as GBP, e.g. 430178 -> "£4,301.78", -10000 -> "-£100.00". */
export function formatGBP(pence: number): string {
  const abs = Math.abs(pence);
  const pounds = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${pence < 0 ? "-" : ""}£${pounds}.${frac}`;
}

/** Integer division rounded to the nearest, halves up (towards +infinity). */
export function divRound(pence: number, divisor: number): number {
  if (!Number.isInteger(divisor) || divisor <= 0) {
    throw new RangeError("divisor must be a positive integer");
  }
  return Math.floor((2 * pence + divisor) / (2 * divisor));
}
