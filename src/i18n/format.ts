import {
  amountToInputText,
  daysBetween,
  formatDayMonth,
  formatDayMonthYear,
  formatMoney,
  formatMoneyShort,
  formatMonth,
  formatMonthYear,
  formatPeriodRange,
  formatShortDate,
  formatSignedMoney,
  formatWeekdayDate,
  parseAmount,
  parseOptionalAmount,
  type IsoDate,
  type YearMonth,
} from "@/lib/calc";
import { DEFAULT_CURRENCY, DEFAULT_LOCALE, type CurrencyCode, type Locale } from "@/lib/locale";
import { messagesFor, type Messages } from "./messages";

/** Money and dates for one language and currency. Client-safe. */
export type Format = {
  locale: Locale;
  currency: CurrencyCode;
  money(pence: number): string;
  moneyShort(pence: number): string;
  signedMoney(pence: number): string;
  parse(text: string): number | null;
  parseOptional(text: string): number | null;
  inputText(pence: number): string;
  weekdayDate(d: IsoDate): string;
  dayMonth(d: IsoDate): string;
  dayMonthYear(d: IsoDate): string;
  shortDate(d: IsoDate): string;
  periodRange(start: IsoDate, end: IsoDate): string;
  month(m: YearMonth): string;
  monthYear(m: YearMonth): string;
  /** "Today", "Tomorrow", else the weekday and date (with the year when not this year's). */
  relativeDay(d: IsoDate, today: IsoDate): string;
  daysLeft(n: number): string;
};

export function makeFormat(locale: Locale, currency: CurrencyCode): Format {
  const m = messagesFor(locale);
  return {
    locale,
    currency,
    money: (p) => formatMoney(p, currency),
    moneyShort: (p) => formatMoneyShort(p, currency, locale),
    signedMoney: (p) => formatSignedMoney(p, currency),
    parse: (t) => parseAmount(t, currency),
    parseOptional: (t) => parseOptionalAmount(t, currency),
    inputText: (p) => amountToInputText(p, currency),
    weekdayDate: (d) => formatWeekdayDate(d, locale),
    dayMonth: (d) => formatDayMonth(d, locale),
    dayMonthYear: (d) => formatDayMonthYear(d, locale),
    shortDate: (d) => formatShortDate(d, locale),
    periodRange: (a, b) => formatPeriodRange(a, b, locale),
    month: (ym) => formatMonth(ym, locale),
    monthYear: (ym) => formatMonthYear(ym, locale),
    relativeDay: (d, today) => {
      const diff = daysBetween(today, d);
      if (diff === 0) return m.dates.today;
      if (diff === 1) return m.dates.tomorrow;
      const label = formatWeekdayDate(d, locale);
      return d.slice(0, 4) === today.slice(0, 4) ? label : m.dates.withYear(label, d.slice(0, 4));
    },
    daysLeft: (n) => m.dates.daysLeft(n),
  };
}

/** Everything a screen needs to speak the user's language. */
export type I18n = { locale: Locale; currency: CurrencyCode; m: Messages; fmt: Format };

export function makeI18n(locale: Locale, currency: CurrencyCode): I18n {
  return { locale, currency, m: messagesFor(locale), fmt: makeFormat(locale, currency) };
}

/** English and pounds: what every screen and check uses when told nothing else. */
export const DEFAULT_I18N: I18n = makeI18n(DEFAULT_LOCALE, DEFAULT_CURRENCY);
