import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components. The session lives in cookies the server can read. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
