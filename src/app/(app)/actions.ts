"use server";

import { adoptDeviceTimezone as adopt } from "@/lib/data/profile";
import { createClient, getUserId } from "@/lib/supabase/server";

/** First sign-in: store the device's zone as the home zone (once; see adoptDeviceTimezone). */
export async function adoptDeviceTimezone(zone: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await adopt(await createClient(), userId, zone);
}
