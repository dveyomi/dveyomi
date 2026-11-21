/** Money is integer pence everywhere. */

/** Parse a user-entered GBP amount into positive integer pence, or null if invalid. */
export function parsePence(input: string): number | null {
  const raw = input.trim().replace(/^£/, "");
  // Commas are accepted only as thousands separators.
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(raw)) return null;
  const s = raw.replace(/,/g, "");
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

/** Like parsePence for an optional amount: empty or zero ("0", "£0.00") is 0; invalid text is null. */
export function parseOptionalPence(input: string): number | null {
  const t = input.trim();
  return t === "" || /^£?0+(\.0{1,2})?$/.test(t) ? 0 : parsePence(t);
}

/** Integer pence as the text an amount field starts from, e.g. 1250 -> "12.50" (no £, no separators; parsePence reads it back). */
export function penceToInputText(pence: number): string {
  const abs = Math.abs(pence);
  return `${pence < 0 ? "-" : ""}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}

/**
 * A compact GBP label for tight spaces such as a calendar tile: exact pence
 * under £100 ("£17.50"), whole pounds (halves up) from £100 to £999 ("£240"),
 * then thousands to one decimal ("£1.2k", "£1k" when the decimal is 0). Pair
 * it with the full formatGBP figure for assistive tech.
 */
export function formatGBPShort(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  if (abs < 10_000) return formatGBP(pence);
  const pounds = divRound(abs, 100);
  if (pounds < 1000) return `${sign}£${pounds}`;
  const tenths = divRound(abs, 10_000);
  const whole = Math.floor(tenths / 10);
  return tenths % 10 === 0 ? `${sign}£${whole}k` : `${sign}£${whole}.${tenths % 10}k`;
}
