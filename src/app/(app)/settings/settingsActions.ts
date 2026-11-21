"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setBudgetStartDay, setHomeTimezone } from "@/lib/data/profile";
import { createClient, getUserId } from "@/lib/supabase/server";
import { checkStartDay, checkTimeZone } from "@/lib/validation/settings";

export type SaveResult = { ok: true } | { error: string };

/** Saves the budget start day; the current budget keeps its dates and the change applies from the next. */
export async function saveStartDay(raw: unknown): Promise<SaveResult> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const day = checkStartDay(raw);
  if (day === null) return { error: "Choose a day from 1 to 31." };
  try {
    await setBudgetStartDay(await createClient(), userId, day);
  } catch (e) {
    console.error("setBudgetStartDay failed", e);
    return { error: "We couldn't save your start day. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Saves the home time zone as the user's choice. */
export async function saveHomeTimezone(raw: unknown): Promise<SaveResult> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const zone = checkTimeZone(raw);
  if (!zone) return { error: "Choose a time zone from the list." };
  try {
    await setHomeTimezone(await createClient(), userId, zone);
  } catch (e) {
    console.error("setHomeTimezone failed", e);
    return { error: "We couldn't save your time zone. Check your connection and try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
