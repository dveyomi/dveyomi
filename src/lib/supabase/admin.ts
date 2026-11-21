import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

/**
 * A service-role client: it bypasses RLS. It has exactly two uses:
 *   - the hourly recurring-payments run (`/api/cron/recurring`), which acts
 *     for every user;
 *   - account deletion (`POST /api/account/delete`), which deletes the
 *     signed-in user's auth record after checking their session.
 * Never use it to read or write a signed-in user's data (their own client
 * and RLS do that), and never import it from client code ("server-only"
 * fails the build). Needs SUPABASE_SERVICE_ROLE_KEY, never NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
