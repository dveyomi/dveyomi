"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatGBP } from "@/lib/calc";
import {
  FundNameTakenError,
  FundNotFoundError,
  InsufficientFundsError,
  SavingsAlreadyMovedError,
  SplitTotalError,
  addFundMovement,
  confirmSavingsSplit,
  createFund,
  updateFund,
} from "@/lib/data/funds";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { isId } from "@/lib/validation/budgetEdit";
import { validateConfirmSplit, validateFund, validateMovement, type FundField, type MovementField } from "@/lib/validation/funds";

/** The Saving tab's actions. Inputs are untrusted: checked here, and RLS keeps every row to the signed-in user. */

const FAILED = { error: "We couldn't save that. Check your connection and try again." };
const UNKNOWN_FUND = { error: "That fund wasn't found. Reload the page and try again." };

export type FundActionResult<F extends string = never> = { error?: string; field?: F };

/** Moves a period's waiting savings into funds ("Move your savings"), dated the user's today. */
export async function confirmSavingsAction(periodId: unknown, rawSplit: unknown): Promise<FundActionResult> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(periodId)) return { error: "These savings weren't recognised. Reload the page and try again." };
  const checked = validateConfirmSplit(rawSplit);
  if (!checked.ok) return { error: checked.error };
  try {
    await confirmSavingsSplit(await createClient(), periodId, checked.lines, await getToday());
  } catch (e) {
    if (
      e instanceof SplitTotalError ||
      e instanceof SavingsAlreadyMovedError ||
      e instanceof FundNotFoundError ||
      e instanceof FundNameTakenError
    ) {
      return { error: e.message };
    }
    console.error("confirmSavingsSplit failed", e);
    return FAILED;
  }
  revalidatePath("/", "layout");
  return {};
}

/** Creates a fund (`fundId` null) or changes one's name, target and target date. */
export async function saveFundAction(fundId: unknown, raw: unknown): Promise<FundActionResult<FundField>> {
  if (!(await getUserId())) redirect("/login");
  if (fundId !== null && !isId(fundId)) return UNKNOWN_FUND;
  const checked = validateFund(raw);
  if (!checked.ok) return { error: checked.error, ...(checked.field ? { field: checked.field } : {}) };
  try {
    const supabase = await createClient();
    if (fundId === null) await createFund(supabase, checked.input);
    else await updateFund(supabase, fundId, checked.input);
  } catch (e) {
    if (e instanceof FundNameTakenError) return { error: e.message, field: "name" };
    if (e instanceof FundNotFoundError) return { error: e.message };
    console.error("saveFund failed", e);
    return FAILED;
  }
  revalidatePath("/", "layout");
  return {};
}

/** Adds money to or withdraws money from a fund. Fund-only bookkeeping: the budget is untouched. */
export async function addFundMovementAction(fundId: unknown, raw: unknown): Promise<FundActionResult<MovementField>> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(fundId)) return UNKNOWN_FUND;
  const checked = validateMovement(raw, await getToday());
  if (!checked.ok) return { error: checked.error, ...(checked.field ? { field: checked.field } : {}) };
  try {
    await addFundMovement(await createClient(), fundId, checked.input);
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      return { error: `You can't withdraw more than the fund holds (${formatGBP(e.balancePence)}).`, field: "amount" };
    }
    if (e instanceof FundNotFoundError) return { error: e.message };
    console.error("addFundMovement failed", e);
    return FAILED;
  }
  revalidatePath("/", "layout");
  return {};
}
