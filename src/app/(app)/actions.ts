"use server";

import { DEFAULT_TIMEZONE, isTimeZone } from "@/lib/timezone";
import { createClient, getUserId } from "@/lib/supabase/server";

/**
 * First sign-in: adopt the device's zone if the profile still has the
 * default. A zone the user has chosen is never overwritten.
 */
export async function adoptDeviceTimezone(zone: string): Promise<void> {
  if (!isTimeZone(zone) || zone === DEFAULT_TIMEZONE) return;
  const userId = await getUserId();
  if (!userId) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ timezone: zone })
    .eq("user_id", userId)
    .eq("timezone", DEFAULT_TIMEZONE);
  if (error) throw error;
}
