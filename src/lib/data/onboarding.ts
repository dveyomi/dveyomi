import { periodContaining, splitRemainder, type IsoDate } from "@/lib/calc";
import {
  MAX_CATEGORIES,
  MAX_FUNDS,
  checkName,
  firstDuplicate,
  isPence,
  isRecord,
  type Check,
} from "@/lib/validation/common";
import type { Db } from "./types";

export type OnboardingCategory = { name: string; kind: "need" | "want"; amountPence: number };
export type OnboardingFund = { name: string; amountPence: number; alreadySavedPence: number };

/** Everything the onboarding wizard collects. Money is integer pence. */
export type OnboardingInput = {
  incomePence: number;
  startDay: number;
  /** "Pay yourself first": the savings total for each period; 0 when skipped. */
  savingsPence: number;
  categories: OnboardingCategory[];
  /** Divide `savingsPence` between them; `alreadySavedPence` is the opening balance. */
  funds: OnboardingFund[];
};

export type Validation = { ok: true; input: OnboardingInput } | { ok: false; error: string; field?: "income" | "savings" };

/** Thrown by completeOnboarding when the user already has a budget. */
export class AlreadyOnboardedError extends Error {
  constructor() {
    super("You already have a budget.");
    this.name = "AlreadyOnboardedError";
  }
}

export { MAX_CATEGORIES, MAX_FUNDS, MAX_NAME_LENGTH, MAX_PENCE, type Check } from "@/lib/validation/common";

/** Step 1: monthly income and start day. */
export function checkBasics(incomePence: unknown, startDay: unknown): Check<{ incomePence: number; startDay: number }> {
  if (!isPence(incomePence, 1)) {
    return { ok: false, field: "income", error: "Enter a monthly income between £0.01 and £10,000,000.00." };
  }
  if (typeof startDay !== "number" || !Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
    return { ok: false, error: "Choose a start day between the 1st and the 31st." };
  }
  return { ok: true, value: { incomePence, startDay } };
}

/** Step 2: at least one category, each with a unique name, a kind and an amount; names trimmed. */
export function checkCategories(raw: unknown): Check<OnboardingCategory[]> {
  const fail = (error: string): Check<OnboardingCategory[]> => ({ ok: false, error });
  if (!Array.isArray(raw) || raw.length === 0) return fail("Add at least one category to continue.");
  if (raw.length > MAX_CATEGORIES) return fail(`You can add up to ${MAX_CATEGORIES} categories.`);
  const categories: OnboardingCategory[] = [];
  for (const c of raw as unknown[]) {
    if (!isRecord(c)) return fail("Give every category a name.");
    const checked = checkName(c.name, "category");
    if (!checked.ok) return checked;
    const name = checked.value;
    if (c.kind !== "need" && c.kind !== "want") return fail(`Mark ${name} as a need or a want.`);
    if (!isPence(c.amountPence, 1)) return fail(`Enter an amount between £0.01 and £10,000,000.00 for ${name}.`);
    categories.push({ name, kind: c.kind, amountPence: c.amountPence });
  }
  const dup = firstDuplicate(categories.map((c) => c.name));
  if (dup) return fail(`You already have a category called ${dup}.`);
  return { ok: true, value: categories };
}

/**
 * Step 3: savings (0 = skipped) no more than income, and funds. With savings,
 * the funds' monthly amounts must add up to it; a fund may still save 0 a
 * month and hold only money already saved.
 */
export function checkSavings(
  incomePence: number,
  savingsPence: unknown,
  raw: unknown,
): Check<{ savingsPence: number; funds: OnboardingFund[] }> {
  type Out = Check<{ savingsPence: number; funds: OnboardingFund[] }>;
  const fail = (error: string): Out => ({ ok: false, error });
  if (!isPence(savingsPence, 0)) {
    return { ok: false, field: "savings", error: "Enter a savings amount, e.g. 250.00, or leave it empty to skip." };
  }
  if (savingsPence > incomePence) {
    return { ok: false, field: "savings", error: "Your savings can't be more than your income." };
  }
  if (!Array.isArray(raw)) return fail("Something was missing from your funds. Check each one.");
  if (raw.length > MAX_FUNDS) return fail(`You can add up to ${MAX_FUNDS} funds.`);
  const funds: OnboardingFund[] = [];
  for (const f of raw as unknown[]) {
    if (!isRecord(f)) return fail("Give every fund a name.");
    const checked = checkName(f.name, "fund");
    if (!checked.ok) return checked;
    const name = checked.value;
    if (!isPence(f.amountPence, 0)) return fail(`Enter a monthly amount for ${name}, or leave it empty.`);
    if (!isPence(f.alreadySavedPence, 0)) return fail(`Enter how much is already saved in ${name}.`);
    funds.push({ name, amountPence: f.amountPence, alreadySavedPence: f.alreadySavedPence });
  }
  if (savingsPence > 0 && funds.length === 0) return fail("Add a fund for your savings to go into.");
  const dup = firstDuplicate(funds.map((f) => f.name));
  if (dup) return fail(`You already have a fund called ${dup}.`);
  if (splitRemainder(savingsPence, funds.map((f) => f.amountPence)) !== 0) {
    return fail("Your funds' monthly amounts must add up to your savings.");
  }
  return { ok: true, value: { savingsPence, funds } };
}

/**
 * Checks untrusted onboarding input (from the client) and returns it with
 * names trimmed, or the first problem in words a person can act on. The
 * wizard runs the same per-step checks as each step is completed.
 */
export function validateOnboarding(raw: unknown): Validation {
  if (!isRecord(raw)) return { ok: false, error: "Something was missing from your budget. Go back and check each step." };
  const basics = checkBasics(raw.incomePence, raw.startDay);
  if (!basics.ok) return basics;
  const categories = checkCategories(raw.categories);
  if (!categories.ok) return categories;
  const savings = checkSavings(basics.value.incomePence, raw.savingsPence, raw.funds);
  if (!savings.ok) return savings;
  return { ok: true, input: { ...basics.value, ...savings.value, categories: categories.value } };
}

/** Whether the user has a budget yet (any period); false means they still need onboarding. */
export async function hasBudget(supabase: Db): Promise<boolean> {
  const { data, error } = await supabase.from("budget_periods").select("id").limit(1);
  if (error) throw error;
  return data.length > 0;
}

/**
 * Saves a validated onboarding in one transaction (`complete_onboarding`):
 * the start day, the period containing `today`, categories and allocations,
 * funds with their already-saved opening balances, and a 'waiting' savings
 * split when the period saves anything. Throws AlreadyOnboardedError, saving
 * nothing, when the user already has a budget.
 */
export async function completeOnboarding(supabase: Db, input: OnboardingInput, today: IsoDate): Promise<void> {
  const period = periodContaining(today, input.startDay);
  const { error } = await supabase.rpc("complete_onboarding", {
    p_start_day: input.startDay,
    p_start: period.start,
    p_end: period.end,
    p_income_pence: input.incomePence,
    p_savings_pence: input.savingsPence,
    p_categories: input.categories.map((c) => ({ name: c.name, kind: c.kind, amount_pence: c.amountPence })),
    p_funds: input.funds.map((f) => ({
      name: f.name,
      amount_pence: f.amountPence,
      already_saved_pence: f.alreadySavedPence,
    })),
  });
  if (error?.code === "PT409") throw new AlreadyOnboardedError();
  if (error) throw error;
}
