"use server";

import { localizeError } from "@/i18n/errors";
import { getServerI18n } from "@/i18n/server";
import { revalidatePath } from "next/cache";
import { adoptDeviceTimezone as adopt } from "@/lib/data/profile";
import { endTrip, TripNotCurrentError, TripNotFoundError } from "@/lib/data/trips";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { isId } from "@/lib/validation/budgetEdit";

/** First sign-in: store the device's zone as the home zone (once; see adoptDeviceTimezone). */
export async function adoptDeviceTimezone(zone: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await adopt(await createClient(), userId, zone);
}

/** "Back home? End your trip?": the trip covering today now ends today (refused for a trip not on today). */
export async function endCurrentTrip(id: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Sign in again to end this trip." };
  if (!isId(id)) return { error: "This trip wasn't recognised." };
  try {
    await endTrip(await createClient(), id, await getToday());
  } catch (e) {
    if (e instanceof TripNotFoundError || e instanceof TripNotCurrentError) return { error: localizeError(e, await getServerI18n()) };
    console.error("trips: end failed", e);
    return { error: "We couldn't end this trip. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  return {};
}
