/**
 * Paths a signed-out visitor may open: sign-in, the auth round trip, the
 * privacy notice, and the hourly recurring-payments run (pg_cron has no
 * session; the route checks CRON_SECRET itself).
 */
export function isPublic(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/privacy" ||
    pathname === "/auth" ||
    pathname === "/api/cron/recurring" ||
    pathname.startsWith("/auth/")
  );
}
