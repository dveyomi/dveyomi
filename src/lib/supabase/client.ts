import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/db/database.types";

/** Supabase client for Client Components. The session lives in cookies the server can read. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
