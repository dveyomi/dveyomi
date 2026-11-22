"use server";

import { localizeError } from "@/i18n/errors";
import { getServerI18n } from "@/i18n/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NoBudgetError } from "@/lib/data/budgetEdit";
import { FundNameTakenError, FundNotFoundError, FundShortError } from "@/lib/data/funds";
import {
  AlreadyReviewedError,
  dismissUnassignedNudge,
  LeftoverChangedError,
  OverspendChoiceError,
  PeriodNotEndedError,
  RaiseRefusedError,
  raiseBudget,
  recordLeftover,
  ReviewNotFoundError,
} from "@/lib/data/review";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { isId } from "@/lib/validation/budgetEdit";
import { validateLeftoverChoice, validateRaise } from "@/lib/validation/review";

/** The period-end review's actions. Inputs are untrusted: checked here; figures are worked out on the server. */

const FAILED = async () => ({ error: (await getServerI18n()).m.checks.failed });

/**
 * Records where an ended period's leftover goes, or where its overspend
 * comes from (or, with neither, that it was reviewed), then opens the Budget tab. The amount is never taken from the
 * browser: recordLeftover works it out from the stored figures.
 */
export async function recordLeftoverAction(periodId: unknown, rawChoice: unknown): Promise<{ error: string }> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(periodId)) return { error: (await getServerI18n()).m.checks.budgetNotFound };
  const checked = validateLeftoverChoice(rawChoice);
  if (!checked.ok) return { error: checked.error };
  try {
    await recordLeftover(await createClient(), await getToday(), periodId, checked.choice);
  } catch (e) {
    if (e instanceof FundShortError) {
      const { m, fmt } = await getServerI18n();
      return { error: m.errors.fundShort(e.fundName, fmt.money(Math.max(0, e.balancePence))) };
    }
    if (
      e instanceof AlreadyReviewedError ||
      e instanceof PeriodNotEndedError ||
      e instanceof ReviewNotFoundError ||
      e instanceof LeftoverChangedError ||
      e instanceof FundNotFoundError ||
      e instanceof FundNameTakenError ||
      e instanceof OverspendChoiceError
    ) {
      return { error: localizeError(e, await getServerI18n()) };
    }
    console.error("recordLeftover failed", e);
    return await FAILED();
  }
  revalidatePath("/", "layout");
  redirect("/budget?reviewed=1");
}

/** Raises a category's budget from the current period on (a review suggestion). */
export async function applyRaiseAction(categoryId: unknown, amountPence: unknown): Promise<{ error?: string }> {
  if (!(await getUserId())) redirect("/login");
  const checked = validateRaise(categoryId, amountPence, await getServerI18n());
  if (!checked.ok) return { error: checked.error };
  try {
    await raiseBudget(await createClient(), await getToday(), categoryId as string, amountPence as number);
  } catch (e) {
    if (e instanceof RaiseRefusedError) return { error: localizeError(e, await getServerI18n()) };
    if (e instanceof NoBudgetError) redirect("/onboarding");
    console.error("raiseBudget failed", e);
    return await FAILED();
  }
  revalidatePath("/", "layout");
  return {};
}

/** Hides the "Give every pound a job" nudge. */
export async function dismissNudgeAction(): Promise<void> {
  if (!(await getUserId())) redirect("/login");
  await dismissUnassignedNudge(await createClient());
  revalidatePath("/budget");
}
