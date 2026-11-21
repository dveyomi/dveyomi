import { redirect } from "next/navigation";
import { TimezoneSync } from "@/components/TimezoneSync";
import { getProfile, getUserId } from "@/lib/supabase/server";

/**
 * Checks the session inside the (app) shell and runs TimezoneSync. A signed-in
 * user without a profile row is signed out by /auth/no-profile; sending them
 * straight to /login would loop, because the proxy sends signed-in users on
 * /login back to /budget.
 */
export async function SignedInSync() {
  if (!(await getUserId())) redirect("/login");
  const profile = await getProfile();
  if (!profile) redirect("/auth/no-profile");
  return <TimezoneSync homeDetected={profile.timezoneDetected} />;
}
