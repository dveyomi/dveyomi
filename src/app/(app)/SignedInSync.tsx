import { redirect } from "next/navigation";
import { TimezoneSync } from "@/components/TimezoneSync";
import { tripCovering } from "@/lib/data/trips";
import { createClient, getProfile, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

/**
 * Checks the session inside the (app) shell and runs TimezoneSync (with what
 * the travelling prompt needs: the home zone, today and the trip covering
 * today). A signed-in user without a profile row is signed out by
 * /auth/no-profile; sending them straight to /login would loop, because the
 * proxy sends signed-in users on /login back to /budget.
 */
export async function SignedInSync() {
  if (!(await getUserId())) redirect("/login");
  const profile = await getProfile();
  if (!profile) redirect("/auth/no-profile");
  const [supabase, today] = await Promise.all([createClient(), getToday()]);
  const trip = await tripCovering(supabase, today);
  return (
    <TimezoneSync
      homeDetected={profile.timezoneDetected}
      homeZone={profile.timezone}
      today={today}
      currentTrip={trip && { id: trip.id, name: trip.name, end: trip.endDate }}
    />
  );
}
