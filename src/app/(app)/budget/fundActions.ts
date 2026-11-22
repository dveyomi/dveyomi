"use server";

import { localizeError } from "@/i18n/errors";
import { getServerI18n } from "@/i18n/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  FundNameTakenError,
  FundNotFoundError,
  InsufficientFundsError,
  SameFundError,
  SavingsAlreadyMovedError,
  SplitTotalError,
  addFundMovement,
  confirmSavingsSplit,
  createFund,
  moveBetweenFunds,
  updateFund,
  withdrawFromFund,
} from "@/lib/data/funds";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { isId } from "@/lib/validation/budgetEdit";
import {
  validateConfirmSplit,
  validateFund,
  validateFundMove,
  validateMovement,
  validateWithdrawal,
  type FundField,
  type FundMoveField,
  type MovementField,
} from "@/lib/validation/funds";

/** The Saving tab's actions. Inputs are untrusted: checked here, and RLS keeps every row to the signed-in user. */

const FAILED = async () => ({ error: (await getServerI18n()).m.checks.failed });
const UNKNOWN_FUND = async () => ({ error: (await getServerI18n()).m.checks.fundNotFound });

export type FundActionResult<F extends string = never> = { error?: string; field?: F };

/** Moves a period's waiting savings into funds ("Move your savings"), dated the user's today. */
export async function confirmSavingsAction(periodId: unknown, rawSplit: unknown): Promise<FundActionResult> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(periodId)) return { error: (await getServerI18n()).m.checks.savingsNotRecognised };
  const checked = validateConfirmSplit(rawSplit, await getServerI18n());
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
      return { error: localizeError(e, await getServerI18n()) };
    }
    console.error("confirmSavingsSplit failed", e);
    return await FAILED();
  }
  revalidatePath("/", "layout");
  return {};
}

/** Creates a fund (`fundId` null) or changes one's name, target and target date. */
export async function saveFundAction(fundId: unknown, raw: unknown): Promise<FundActionResult<FundField>> {
  if (!(await getUserId())) redirect("/login");
  if (fundId !== null && !isId(fundId)) return await UNKNOWN_FUND();
  const checked = validateFund(raw, await getServerI18n());
  if (!checked.ok) return { error: checked.error, ...(checked.field ? { field: checked.field } : {}) };
  try {
    const supabase = await createClient();
    if (fundId === null) await createFund(supabase, checked.input);
    else await updateFund(supabase, fundId, checked.input);
  } catch (e) {
    if (e instanceof FundNameTakenError) return { error: localizeError(e, await getServerI18n()), field: "name" };
    if (e instanceof FundNotFoundError) return { error: localizeError(e, await getServerI18n()) };
    console.error("saveFund failed", e);
    return await FAILED();
  }
  revalidatePath("/", "layout");
  return {};
}

/** Adds money to or withdraws money from a fund. Fund-only bookkeeping: the budget is untouched. */
export async function addFundMovementAction(fundId: unknown, raw: unknown): Promise<FundActionResult<MovementField>> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(fundId)) return await UNKNOWN_FUND();
  const checked = validateMovement(raw, await getToday(), await getServerI18n());
  if (!checked.ok) return { error: checked.error, ...(checked.field ? { field: checked.field } : {}) };
  try {
    await addFundMovement(await createClient(), fundId, checked.input);
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      const { m, fmt } = await getServerI18n();
      return { error: m.errors.withdrawTooMuch(fmt.money(e.balancePence)), field: "amount" };
    }
    if (e instanceof FundNotFoundError) return { error: localizeError(e, await getServerI18n()) };
    console.error("addFundMovement failed", e);
    return await FAILED();
  }
  revalidatePath("/", "layout");
  return {};
}

/**
 * Takes money out of a fund: into this month's spending money ("spending",
 * which raises Left to spend) or just out ("out", fund-only). The balance is
 * checked in the same transaction.
 */
export async function withdrawFromFundAction(fundId: unknown, raw: unknown): Promise<FundActionResult<MovementField>> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(fundId)) return await UNKNOWN_FUND();
  const today = await getToday();
  const checked = validateWithdrawal(raw, today, await getServerI18n());
  if (!checked.ok) return { error: checked.error, ...(checked.field ? { field: checked.field } : {}) };
  try {
    await withdrawFromFund(await createClient(), today, fundId, checked.input, checked.destination);
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      const { m, fmt } = await getServerI18n();
      return { error: m.errors.withdrawTooMuch(fmt.money(e.balancePence)), field: "amount" };
    }
    if (e instanceof FundNotFoundError) return { error: localizeError(e, await getServerI18n()) };
    console.error("withdrawFromFund failed", e);
    return await FAILED();
  }
  revalidatePath("/", "layout");
  return {};
}

/** Moves money from one fund to another. Fund-only: the budget is untouched. */
export async function moveBetweenFundsAction(fromId: unknown, toId: unknown, raw: unknown): Promise<FundActionResult<FundMoveField>> {
  if (!(await getUserId())) redirect("/login");
  if (!isId(fromId) || !isId(toId)) return await UNKNOWN_FUND();
  const checked = validateFundMove(raw, await getToday(), await getServerI18n());
  if (!checked.ok) return { error: checked.error, ...(checked.field ? { field: checked.field } : {}) };
  try {
    await moveBetweenFunds(await createClient(), fromId, toId, checked.input);
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      const { m, fmt } = await getServerI18n();
      return { error: m.errors.moveTooMuch(fmt.money(e.balancePence)), field: "amount" };
    }
    if (e instanceof SameFundError) return { error: localizeError(e, await getServerI18n()), field: "to" };
    if (e instanceof FundNotFoundError) return { error: localizeError(e, await getServerI18n()) };
    console.error("moveBetweenFunds failed", e);
    return await FAILED();
  }
  revalidatePath("/", "layout");
  return {};
}
