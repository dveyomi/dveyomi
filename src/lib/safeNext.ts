const BASE = "http://in-app.invalid";
/** Control characters and space (U+0000–U+0020) and DEL: browsers strip or mangle these, e.g. "/\t/evil.test" → "//evil.test". */
const UNSAFE_CHAR = /[\u0000- \u007f]/;

/**
 * The in-app path to return to (after sign-in, or after saving a form). Only
 * same-origin paths are allowed ("/expenses?month=2026-11"); anything else,
 * including a non-string, falls back to `fallback` (/budget unless given), so
 * the parameter cannot send the user to another site. The path is parsed as
 * a browser would and returned normalised (path, query and hash).
 */
export function safeNext(next: unknown, fallback = "/budget"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\") || UNSAFE_CHAR.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
