/**
 * The languages and currencies the app supports. Pure and client-safe: the
 * settings, the dictionaries and the money helpers all read from here.
 */

export const LOCALES = ["en-GB", "zh-TW"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en-GB";

/** A stored value as a locale; anything missing or unknown is English. */
export function parseLocale(v: unknown): Locale {
  return LOCALES.find((l) => l === v) ?? DEFAULT_LOCALE;
}

export const CURRENCY_CODES = ["GBP", "TWD"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];
export const DEFAULT_CURRENCY: CurrencyCode = "GBP";

/** A stored value as a currency; anything missing or unknown is GBP. */
export function parseCurrency(v: unknown): CurrencyCode {
  return CURRENCY_CODES.find((c) => c === v) ?? DEFAULT_CURRENCY;
}

/**
 * How each currency is written. Amounts are always stored in hundredths; TWD
 * is shown and entered in whole dollars, as prices are in Taiwan.
 */
export const CURRENCIES: Record<CurrencyCode, { symbol: "£" | "NT$"; decimals: 2 | 0 }> = {
  GBP: { symbol: "£", decimals: 2 },
  TWD: { symbol: "NT$", decimals: 0 },
};
