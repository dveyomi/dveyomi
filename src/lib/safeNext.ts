/**
 * The in-app path to return to after sign-in. Only same-origin absolute paths
 * are allowed ("/expenses?month=2026-11"); anything else falls back to /budget,
 * so the parameter cannot send the user to another site.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/budget";
  return next;
}
