import { NextResponse, type NextRequest } from "next/server";
import { createClient, getProfile, getUserId } from "@/lib/supabase/server";

/**
 * Reached when a signed-in user has no profile row. Signs them out (a Route
 * Handler can clear the auth cookies; a Server Component cannot) and shows an
 * error on /login, instead of looping between /login and /budget. Only acts
 * when the profile really is missing.
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  if (!(await getUserId())) return NextResponse.redirect(`${origin}/login`);
  if (await getProfile()) return NextResponse.redirect(`${origin}/budget`);

  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/login?error=account`);
}
