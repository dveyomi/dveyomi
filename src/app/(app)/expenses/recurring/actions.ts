"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { IsoDate } from "@/lib/calc";
import {
  acceptDetection,
  cancelRule,
  changePrice,
  confirmOccurrence,
  dismissDetection,
  NotRecurringError,
  pauseRule,
  RecurringChangedError,
  resumeRule,
  RuleNotFoundError,
  skipNext,
} from "@/lib/data/recurring";
import type { Db } from "@/lib/data/types";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getTimeZone, getToday } from "@/lib/today";
import { isId } from "@/lib/validation/budgetEdit";
import { getServerI18n } from "@/i18n/server";
import { amountRequiredError, isAmount } from "@/lib/validation/common";
import { isIsoDate } from "@/lib/validation/expense";

/**
 * The recurring payments list's actions, the Expenses tab's detection cards
 * and "Mark as checked". Every input is untrusted; RLS keeps each change to
 * the signed-in user's own rows. On success the pages are refreshed and the
 * caller stays where it is.
 */

export type RecurringActionResult = { error?: string; field?: "amount" | "from" };

const CHANGE_FROM_PAST = "Choose today or a later date. Past payments keep their amounts.";
const NOT_RECOGNISED = { error: "This recurring payment wasn't recognised." };
const known = (e: unknown) =>
  e instanceof RuleNotFoundError || e instanceof RecurringChangedError || e instanceof NotRecurringError ? e.message : null;

/** Signs in, runs `change` with the user's client and today, and turns failures into words. */
async function run(what: string, change: (db: Db, today: IsoDate) => Promise<unknown>): Promise<RecurringActionResult> {
  try {
    const [db, today] = await Promise.all([createClient(), getToday()]);
    await change(db, today);
  } catch (e) {
    const message = known(e);
    if (message) return { error: message };
    console.error(`recurring: ${what} failed`, e);
    return { error: `We couldn't ${what}. Check your connection and try again.` };
  }
  revalidatePath("/", "layout");
  return {};
}

async function signedIn() {
  if (!(await getUserId())) redirect("/login");
}

/** Pause until `until` (a date after today): payments already due are added first, then nothing before `until`. */
export async function pauseAction(id: unknown, until: unknown): Promise<RecurringActionResult> {
  await signedIn();
  if (!isId(id)) return NOT_RECOGNISED;
  const today = await getToday();
  if (!isIsoDate(until) || until <= today) return { error: "Choose a date after today." };
  const zone = await getTimeZone();
  return run("pause this payment", (db) => pauseRule(db, id, until, zone, new Date()));
}

export async function resumeAction(id: unknown): Promise<RecurringActionResult> {
  await signedIn();
  if (!isId(id)) return NOT_RECOGNISED;
  return run("resume this payment", (db) => resumeRule(db, id));
}

export async function skipNextAction(id: unknown): Promise<RecurringActionResult> {
  await signedIn();
  if (!isId(id)) return NOT_RECOGNISED;
  const zone = await getTimeZone();
  return run("skip the next payment", (db) => skipNext(db, id, zone, new Date()));
}

/** Cancel: it ends today; payments already added stay. */
export async function cancelAction(id: unknown): Promise<RecurringActionResult> {
  await signedIn();
  if (!isId(id)) return NOT_RECOGNISED;
  return run("cancel this payment", (db, today) => cancelRule(db, id, today));
}

/** Change amount: `amountPence` (1p to £10m) from `from` (today or later; past payments keep theirs) on. */
export async function changeAmountAction(id: unknown, from: unknown, amountPence: unknown): Promise<RecurringActionResult> {
  await signedIn();
  if (!isId(id)) return NOT_RECOGNISED;
  const i18n = await getServerI18n();
  if (!isAmount(amountPence, 1, i18n.currency)) return { error: amountRequiredError(i18n), field: "amount" };
  if (!isIsoDate(from)) return { error: "Enter the date it changes from, e.g. 1/12/2026.", field: "from" };
  if (from < (await getToday())) return { error: CHANGE_FROM_PAST, field: "from" };
  return run("change the amount", (db) => changePrice(db, id, from, amountPence));
}

/** "Mark as checked" on an auto-added payment. */
export async function confirmOccurrenceAction(txnId: unknown): Promise<RecurringActionResult> {
  await signedIn();
  if (!isId(txnId)) return { error: "This expense wasn't recognised." };
  return run("mark this as checked", (db) => confirmOccurrence(db, txnId));
}

const isNameKey = (v: unknown): v is string => typeof v === "string" && v.length >= 1 && v.length <= 100;

/** "Yes, repeat it" on a detection card. */
export async function acceptDetectionAction(nameKey: unknown): Promise<RecurringActionResult> {
  await signedIn();
  if (!isNameKey(nameKey)) return NOT_RECOGNISED;
  return run("make this recurring", (db, today) => acceptDetection(db, nameKey, today));
}

/** "No" on a detection card: never suggested again. */
export async function dismissDetectionAction(nameKey: unknown): Promise<RecurringActionResult> {
  await signedIn();
  if (!isNameKey(nameKey)) return NOT_RECOGNISED;
  return run("save your answer", (db) => dismissDetection(db, nameKey));
}
