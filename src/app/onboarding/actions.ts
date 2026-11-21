"use server";

import { redirect } from "next/navigation";
import { AlreadyOnboardedError, completeOnboarding, validateOnboarding } from "@/lib/data/onboarding";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";

/**
 * Saves the onboarding wizard's answers, then opens the budget. The input is
 * untrusted: it is validated here before anything is written, and the
 * period is the one containing the user's today on the server.
 */
export async function completeOnboardingAction(raw: unknown): Promise<{ error: string }> {
  if (!(await getUserId())) redirect("/login");

  const checked = validateOnboarding(raw);
  if (!checked.ok) return { error: checked.error };

  try {
    await completeOnboarding(await createClient(), checked.input, await getToday());
  } catch (e) {
    // Already saved (a repeat or double submit): the budget is there.
    if (!(e instanceof AlreadyOnboardedError)) {
      return { error: "We couldn't save your budget. Check your connection and try again." };
    }
  }
  redirect("/budget");
}
