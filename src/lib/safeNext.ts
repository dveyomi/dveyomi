/**
 * The in-app path to return to (after sign-in, or after saving a form). Only same-origin absolute paths
 * are allowed ("/expenses?month=2026-11"); anything else falls back to
 * `fallback` (/budget unless given), so the parameter cannot send the user to
 * another site.
 */
export function safeNext(next: string | null | undefined, fallback = "/budget"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
