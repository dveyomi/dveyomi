/** Settings input checks, shared by the Settings forms and the server. Client-safe. */
import { CURRENCY_CODES, LOCALES, type CurrencyCode, type Locale } from "@/lib/locale";
import { isTimeZone } from "@/lib/timezone";

/** What the user types to confirm deleting their account. */
export const DELETE_CONFIRMATION = "DELETE";

/** A budget start day: a whole number from 1 to 31 (a numeric string from a form is accepted), else null. */
export function checkStartDay(raw: unknown): number | null {
  const day = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 31 ? (day as number) : null;
}

/** An IANA time zone this runtime knows, else null. */
export function checkTimeZone(raw: unknown): string | null {
  return typeof raw === "string" && isTimeZone(raw) ? raw : null;
}

/** True only for exactly "DELETE": no other case, no spaces. */
export function isDeleteConfirmed(raw: unknown): boolean {
  return raw === DELETE_CONFIRMATION;
}

/** A language the app has, else null. */
export function checkLocale(raw: unknown): Locale | null {
  return LOCALES.find((l) => l === raw) ?? null;
}

/** A currency the app can show, else null. */
export function checkCurrency(raw: unknown): CurrencyCode | null {
  return CURRENCY_CODES.find((c) => c === raw) ?? null;
}
