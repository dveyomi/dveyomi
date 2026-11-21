import { execFileSync, execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Connection details for the local Supabase stack. Taken from SUPABASE_URL /
// SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY when set, otherwise read from
// `npx supabase status -o env` (the stack must be running: `npx supabase start`).
function localStack(): { url: string; anonKey: string; serviceRoleKey: string } {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY) {
    return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY };
  }
  let out: string;
  try {
    out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error(
      "Local Supabase stack is not running. Start it with " +
        "`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`, " +
        "or set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const vars = Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  return { url: vars.API_URL, anonKey: vars.ANON_KEY, serviceRoleKey: vars.SERVICE_ROLE_KEY };
}

const stack = localStack();
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service-role client: bypasses RLS. Use only for test setup and teardown. */
export const admin: SupabaseClient = createClient(stack.url, stack.serviceRoleKey, noSession);

export type TestUser = { id: string; email: string; client: SupabaseClient };

/** Creates a confirmed user through the admin API and returns a client signed in as them. */
export async function createSignedInUser(label: string): Promise<TestUser> {
  const email = `${label}-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;

  const client = createClient(stack.url, stack.anonKey, noSession);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  return { id: created.data.user.id, email, client };
}

/** Deletes a test user; their rows go with them (user_id cascades from auth.users). */
export async function deleteUser(user: TestUser | undefined): Promise<void> {
  if (!user) return;
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
}

/**
 * Runs SQL as the postgres superuser against the local stack (via
 * `npx supabase db query`) and returns the rows. For checks the Data API
 * cannot express, such as table privileges.
 */
export function queryAsPostgres<T>(sql: string): T[] {
  const out = execFileSync("npx", ["supabase", "db", "query", "--output-format", "json", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return (JSON.parse(out) as { rows: T[] }).rows;
}
