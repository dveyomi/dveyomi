/** The cookies that mirror the profile's language and currency (read before first paint and at request time). */
export const LOCALE_COOKIE = "locale";
export const CURRENCY_COOKIE = "currency";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The document.cookie string that remembers a preference for a year. */
export function prefCookie(name: string, value: string): string {
  return `${name}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

/** Options for cookies().set with the same lifetime. */
export const PREF_COOKIE_OPTIONS = { path: "/", maxAge: ONE_YEAR_SECONDS, sameSite: "lax" as const };

/**
 * Sets <html lang> from the locale cookie before first paint, like themeScript.
 * Self-contained: it runs as an inline script.
 */
export const localeScript = `try{var m=/(?:^|;\\s*)locale=([^;]*)/.exec(document.cookie);document.documentElement.lang=m&&m[1]==="zh-TW"?"zh-TW":"en-GB"}catch(e){}`;
