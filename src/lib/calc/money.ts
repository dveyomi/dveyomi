/** Money is integer pence (hundredths) everywhere, in whichever currency the user chose. */

import { CURRENCIES, type CurrencyCode, type Locale } from "@/lib/locale";

const group = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const escape = (s: string) => s.replace(/[$]/g, "\\$");

/** Format hundredths in `currency`: "£4,301.78", or whole dollars for TWD ("NT$1,250"). */
export function formatMoney(pence: number, currency: CurrencyCode = "GBP"): string {
  if (currency === "GBP") return formatGBP(pence);
  const sign = pence < 0 ? "-" : "";
  return `${sign}${CURRENCIES[currency].symbol}${group(divRound(Math.abs(pence), 100))}`;
}

/** Like formatMoney with an explicit sign: "+" in, "−" (a minus sign) out, no sign for none. */
export function formatSignedMoney(pence: number, currency: CurrencyCode = "GBP"): string {
  if (pence === 0) return formatMoney(0, currency);
  return `${pence > 0 ? "+" : "−"}${formatMoney(Math.abs(pence), currency)}`;
}

/** A user-typed amount in `currency` as positive hundredths, or null. TWD takes whole dollars only. */
export function parseAmount(input: string, currency: CurrencyCode = "GBP"): number | null {
  if (currency === "GBP") return parsePence(input);
  const raw = input.trim().replace(new RegExp(`^(${escape(CURRENCIES[currency].symbol)}|\\$)`), "");
  if (!/^(\d{1,3}(,\d{3})+|\d+)$/.test(raw)) return null;
  const pence = Number(raw.replace(/,/g, "")) * 100;
  return Number.isSafeInteger(pence) && pence > 0 ? pence : null;
}

/** Like parseAmount for an optional amount: empty or zero is 0; invalid text is null. */
export function parseOptionalAmount(input: string, currency: CurrencyCode = "GBP"): number | null {
  if (currency === "GBP") return parseOptionalPence(input);
  const t = input.trim().replace(new RegExp(`^(${escape(CURRENCIES[currency].symbol)}|\\$)`), "");
  return t === "" || /^0+$/.test(t) ? 0 : parseAmount(t, currency);
}

/** Hundredths as the text an amount field starts from: "12.50" for GBP, "1250" for TWD. */
export function amountToInputText(pence: number, currency: CurrencyCode = "GBP"): string {
  if (currency === "GBP") return penceToInputText(pence);
  return `${pence < 0 ? "-" : ""}${divRound(Math.abs(pence), 100)}`;
}

/** One decimal, dropping ".0": 12 tenths -> "1.2", 10 -> "1". */
const tenthsText = (tenths: number) => (tenths % 10 === 0 ? `${tenths / 10}` : `${Math.floor(tenths / 10)}.${tenths % 10}`);

/**
 * A compact amount for tight spaces (calendar tiles). Under 1,000 major units
 * it is the whole amount (GBP keeps exact pence under £100); from there,
 * thousands to one decimal: "k" in English, 千 then 萬 (ten thousand) in Chinese.
 */
export function formatMoneyShort(pence: number, currency: CurrencyCode = "GBP", locale: Locale = "en-GB"): string {
  if (locale === "en-GB" && currency === "GBP") return formatGBPShort(pence);
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  const symbol = CURRENCIES[currency].symbol;
  if (currency === "GBP" && abs < 10_000) return formatGBP(pence);
  const units = divRound(abs, 100);
  if (units < 1000) return `${sign}${symbol}${units}`;
  if (locale === "zh-TW") {
    if (units < 10_000) return `${sign}${symbol}${tenthsText(divRound(abs, 10_000))}千`;
    return `${sign}${symbol}${tenthsText(divRound(abs, 100_000))}萬`;
  }
  return `${sign}${symbol}${tenthsText(divRound(abs, 10_000))}k`;
}

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

/** The total of whole-pence amounts (0 for none). */
export function sumPence(amounts: readonly number[]): number {
  return amounts.reduce((sum, a) => sum + a, 0);
}

/** Like formatGBP with an explicit sign: "+£100.00" for money in, "−£40.00" (a minus sign) for money out, "£0.00" for none. */
export function formatSignedGBP(pence: number): string {
  if (pence === 0) return formatGBP(0);
  return `${pence > 0 ? "+" : "−"}${formatGBP(Math.abs(pence))}`;
}
