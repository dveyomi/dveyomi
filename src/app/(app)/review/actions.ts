"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BudgetChangedError, NameTakenError, NoBudgetError } from "@/lib/data/budgetEdit";
import { FundNameTakenError, FundNotFoundError } from "@/lib/data/funds";
import {
  AlreadyReviewedError,
  dismissUnassignedNudge,
  LeftoverChangedError,
  PeriodNotEndedError,
  raiseBudget,
  recordLeftover,
  ReviewNotFoundError,
} from "@/lib/data/review";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { isId } from "@/lib/validation/budgetEdit";
import { validateLeftoverChoice, validateRaise } from "@/lib/validation/review";

/** The period-end review's actions. Inputs are untrusted: checked here; figures are worked out on the server. */

const FAILED = { error: "We couldn't save that. Check your connection and try again." };

/**
 * Records where an ended period's leftover goes (or, with none, that it was
 * reviewed), then opens the Budget tab. The amount is never taken from the
 * browser: recordLeftover works it out from the stored figures.
 */
export async function recordLeftoverAction(periodId: unknown, rawChoice: unknown): Promise<{ error: string }> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(periodId)) return { error: "That budget wasn't found. Reload the page and try again." };
  const checked = validateLeftoverChoice(rawChoice);
  if (!checked.ok) return { error: checked.error };
  try {
    await recordLeftover(await createClient(), await getToday(), periodId, checked.choice);
  } catch (e) {
    if (
      e instanceof AlreadyReviewedError ||
      e instanceof PeriodNotEndedError ||
      e instanceof ReviewNotFoundError ||
      e instanceof LeftoverChangedError ||
      e instanceof FundNotFoundError ||
      e instanceof FundNameTakenError
    ) {
      return { error: e.message };
    }
    console.error("recordLeftover failed", e);
    return FAILED;
  }
  revalidatePath("/", "layout");
  redirect("/budget?reviewed=1");
}

/** Raises a category's budget from the current period on (a review suggestion). */
export async function applyRaiseAction(categoryId: unknown, amountPence: unknown): Promise<{ error?: string }> {
  if (!(await getUserId())) redirect("/login");
  const checked = validateRaise(categoryId, amountPence);
  if (!checked.ok) return { error: checked.error };
  try {
    await raiseBudget(await createClient(), await getToday(), categoryId as string, amountPence as number);
  } catch (e) {
    if (e instanceof NameTakenError || e instanceof BudgetChangedError) return { error: e.message };
    if (e instanceof NoBudgetError) redirect("/onboarding");
    console.error("raiseBudget failed", e);
    return FAILED;
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
