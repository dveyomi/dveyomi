import { generateDue } from "@/lib/data/recurring";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getTimeZone } from "@/lib/today";

/**
 * Catches up recurring payments when the app opens (§5.8): adds any due up
 * to the user's today that the hourly job hasn't yet. It streams inside the
 * shell's Suspense, so it never holds up the page, and is idempotent.
 */
export async function RecurringCatchUp() {
  const userId = await getUserId();
  if (!userId) return null;
  try {
    await generateDue(await createClient(), userId, await getTimeZone(), new Date());
  } catch (e) {
    console.error("RecurringCatchUp: generateDue failed", e);
  }
  return null;
}
