"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APP_VERSION } from "@/lib/appVersion";
import { FeedbackLimitError, sendFeedback } from "@/lib/data/feedback";
import { createClient, getUserId } from "@/lib/supabase/server";
import { checkFeedback } from "@/lib/validation/feedback";

export type SendFeedbackResult = { ok: true } | { error: string; field?: "kind" | "message" };

/**
 * Sends a bug report or an idea. The input is untrusted: checked here
 * (kind, trimmed message length, device details' shape, a safe in-app path).
 * Who sent it comes from the session and the status is always new; the app
 * version is added here, never taken from the browser.
 */
export async function sendFeedbackAction(raw: unknown): Promise<SendFeedbackResult> {
  if (!(await getUserId())) redirect("/login");
  const checked = checkFeedback(raw);
  if (!checked.ok) return { field: checked.field, error: checked.error };
  const { kind, message, device } = checked.value;
  try {
    await sendFeedback(await createClient(), {
      kind,
      message,
      context: device ? { ...device, appVersion: APP_VERSION } : null,
    });
  } catch (e) {
    if (e instanceof FeedbackLimitError) return { error: e.message };
    console.error("sendFeedback failed", e);
    return { error: "We couldn't send that. Check your connection and try again." };
  }
  revalidatePath("/settings/feedback");
  return { ok: true };
}
