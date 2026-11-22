import { getServerI18n } from "@/i18n/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/data/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserId } from "@/lib/supabase/server";
import { isDeleteConfirmed } from "@/lib/validation/settings";

const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: noStore });

/** Whether the request comes from this site: an Origin header, when sent, must match the host. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  // A proxy chain may list several forwarded hosts; the first is the one the browser used.
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host") || new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * "Delete my account". Form field `confirm` must be exactly DELETE. Deletes
 * the auth user with the service role (every table's rows cascade from
 * auth.users), then ends the session and redirects to /login?deleted=1.
 */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return fail(403, (await getServerI18n()).m.settingsPage.notFromApp);
  const userId = await getUserId();
  if (!userId) return fail(401, (await getServerI18n()).m.settingsPage.signInToDelete);

  const form = await request.formData().catch(() => null);
  if (!isDeleteConfirmed(form?.get("confirm"))) return fail(400, (await getServerI18n()).m.settingsPage.typeDeleteToConfirm);

  try {
    await deleteAccount(createAdminClient(), userId);
  } catch (e) {
    console.error("account delete failed", e);
    return fail(500, (await getServerI18n()).m.settingsPage.deleteServerFailed);
  }

  // The user is gone, so the server may refuse the sign-out call; clear the auth cookies regardless.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) if (name.startsWith("sb-")) cookieStore.delete(name);

  return NextResponse.redirect(new URL("/login?deleted=1", request.url), { status: 303, headers: noStore });
}
