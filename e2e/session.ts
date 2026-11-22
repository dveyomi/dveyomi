import { execSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Stack = { url: string; anonKey: string; serviceRoleKey: string };

/** The local Supabase stack's URL and keys, or null when it isn't running. */
export function localStack(): Stack | null {
  let out: string;
  try {
    out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60_000 });
  } catch {
    return null;
  }
  const vars = Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  if (!vars.API_URL || !vars.ANON_KEY || !vars.SERVICE_ROLE_KEY) return null;
  // Only ever a local stack: these tests create and delete users with the service role.
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(vars.API_URL)) return null;
  return { url: vars.API_URL, anonKey: vars.ANON_KEY, serviceRoleKey: vars.SERVICE_ROLE_KEY };
}

export const STACK_MISSING =
  "Local Supabase stack is not running: start it with `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`, then run `npm run test:e2e` again.";

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(stack: Stack): SupabaseClient {
  return createClient(stack.url, stack.serviceRoleKey, noSession);
}

export type SeededUser = { id: string; email: string; cookies: { name: string; value: string }[] };

/**
 * A new confirmed user, signed in with a password (local stack only; the app
 * itself offers only Google), and the session cookies @supabase/ssr writes
 * for it, ready to add to a browser context.
 */
export async function seedSignedInUser(stack: Stack, admin: SupabaseClient): Promise<SeededUser> {
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;

  const jar = new Map<string, string>();
  const client = createServerClient(stack.url, stack.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  if (jar.size === 0) throw new Error("Signing in wrote no session cookies");
  return { id: created.data.user.id, email, cookies: [...jar].map(([name, value]) => ({ name, value })) };
}
