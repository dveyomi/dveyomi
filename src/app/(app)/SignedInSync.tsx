import { redirect } from "next/navigation";
import { TimezoneSync } from "@/components/TimezoneSync";
import { nextTripStart, tripCovering } from "@/lib/data/trips";
import { createClient, getProfile, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

/**
 * Checks the session inside the (app) shell and runs TimezoneSync (with what
 * the travelling prompt needs: the home zone, today and the trip covering
 * today, and the next trip's start). A signed-in user without a profile row is signed out by
 * /auth/no-profile; sending them straight to /login would loop, because the
 * proxy sends signed-in users on /login back to /budget.
 */
export async function SignedInSync() {
  if (!(await getUserId())) redirect("/login");
  const tripContext = async () => {
    const [supabase, today] = await Promise.all([createClient(), getToday()]);
    const [trip, next] = await Promise.all([tripCovering(supabase, today), nextTripStart(supabase, today)]);
    return { today, trip, next };
  };
  const [profile, { today, trip, next }] = await Promise.all([getProfile(), tripContext()]);
  if (!profile) redirect("/auth/no-profile");
  return (
    <TimezoneSync
      homeDetected={profile.timezoneDetected}
      homeZone={profile.timezone}
      today={today}
      currentTrip={trip && { id: trip.id, name: trip.name, end: trip.endDate }}
      nextTripStart={next}
    />
  );
}
