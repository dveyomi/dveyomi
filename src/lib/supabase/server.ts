import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import type { Database } from "@/db/database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Create one per request; never share it between requests.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
          } catch {
            // Server Components cannot set cookies. The proxy refreshes the session instead.
          }
        },
      },
    },
  );
}

/**
 * The verified JWT claims of the signed-in user (never getSession()), or null.
 * Read once per request; getUserId and the Settings account card share it.
 */
export const getClaims = cache(async () => {
  // Verifying a token reads the clock, so this is request-time work, never prerendered.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
});

/**
 * The signed-in user's id from verified JWT claims, or null.
 * Every page, action and data function authorises itself with this (plus RLS);
 * none may rely on the proxy or the (app) layout's redirect.
 */
export const getUserId = cache(async (): Promise<string | null> => (await getClaims())?.sub ?? null);

export type Profile = { timezone: string; timezoneDetected: boolean };

/** The signed-in user's profile, or null when signed out. Read once per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone, timezone_detected")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data && { timezone: data.timezone, timezoneDetected: data.timezone_detected };
});
