/**
 * Whether `url` is a local Supabase stack (http://127.0.0.1:<port> or
 * http://localhost:<port>). The DB and e2e tests create and delete users with
 * the service role, so they refuse any other URL.
 */
export function isLocalStackUrl(url: string | undefined): boolean {
  return typeof url === "string" && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url);
}
