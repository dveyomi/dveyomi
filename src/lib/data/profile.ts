import type { SupabaseClient } from "@supabase/supabase-js";
import { isTimeZone } from "@/lib/timezone";

/**
 * Stores the device's zone as the user's home zone, once: only while the
 * profile has never been detected. Afterwards the home zone changes only in
 * Settings; travelling moves "today" through the tz cookie, not this.
 */
export async function adoptDeviceTimezone(
  supabase: SupabaseClient,
  userId: string,
  zone: string,
): Promise<void> {
  if (!isTimeZone(zone)) return;
  const { error } = await supabase
    .from("profiles")
    .update({ timezone: zone, timezone_detected: true })
    .eq("user_id", userId)
    .eq("timezone_detected", false);
  if (error) throw error;
}
