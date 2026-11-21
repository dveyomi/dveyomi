import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

/**
 * A service-role client: it bypasses RLS. Only for server code that acts for
 * every user (the hourly recurring-payments run), never for a signed-in
 * request, and never imported by client code ("server-only" fails the build
 * if it is). Needs SUPABASE_SERVICE_ROLE_KEY, which is never NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
