/**
 * The colour theme preference: Light (the default), Dark, or Match device
 * ("system"). It lives in the `theme` cookie and is applied as
 * <html data-theme="…">; src/design/tokens.css holds the colours for each.
 */
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "theme";
export const DEFAULT_THEME: Theme = "light";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** A stored value as a theme; anything missing or unknown is light. */
export function parseTheme(value: string | null | undefined): Theme {
  return THEMES.find((t) => t === value) ?? DEFAULT_THEME;
}

/** The Set-Cookie / document.cookie string that remembers `theme` for a year. */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

/**
 * The theme a `document.cookie` string asks for. This function's source is
 * the inline script that runs before first paint (see themeScript), so it must
 * stay self-contained: no imports, no outer names, nothing but plain JS.
 */
export function themeFromCookie(cookie: string): Theme {
  const match = /(?:^|;\s*)theme=([^;]*)/.exec(cookie);
  const value = match ? match[1] : "";
  return value === "dark" || value === "system" ? value : "light";
}

/**
 * Runs in <head> before the body is parsed, so the first paint already has the
 * chosen theme. Reading the cookie here (not with cookies() in the root layout)
 * keeps every page static.
 */
export const themeScript = `try{document.documentElement.dataset.theme=(${themeFromCookie.toString()})(document.cookie)}catch(e){}`;

/** Switches the page now (no reload) and remembers the choice. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.cookie = themeCookie(theme);
}
