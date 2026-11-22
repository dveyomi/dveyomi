import { cookies } from "next/headers";
import { cache } from "react";
import { parseCurrency, parseLocale } from "@/lib/locale";
import { CURRENCY_COOKIE, LOCALE_COOKIE } from "./cookies";
import { DEFAULT_I18N, makeI18n, type I18n } from "./format";

/**
 * The visitor's language and currency, from their cookies (request-time: call
 * it inside Suspense). Outside a request (tests, scripts) it is English and
 * pounds. Unknown cookie values count as the defaults.
 */
export const getServerI18n = cache(async (): Promise<I18n> => {
  let store: Awaited<ReturnType<typeof cookies>>;
  try {
    store = await cookies();
  } catch {
    return DEFAULT_I18N;
  }
  return makeI18n(parseLocale(store.get(LOCALE_COOKIE)?.value), parseCurrency(store.get(CURRENCY_COOKIE)?.value));
});
