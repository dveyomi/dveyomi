import { periodContaining, splitRemainder, type IsoDate } from "@/lib/calc";
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

export type Validation = { ok: true; input: OnboardingInput } | { ok: false; error: string };

/** Thrown by completeOnboarding when the user already has a budget. */
export class AlreadyOnboardedError extends Error {
  constructor() {
    super("You already have a budget.");
    this.name = "AlreadyOnboardedError";
  }
}

const isPence = (v: unknown, min: number): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function firstDuplicate(names: string[]): string | null {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) return name;
    seen.add(key);
  }
  return null;
}

/**
 * Checks untrusted onboarding input (from the client) and returns it with
 * names trimmed, or the first problem in words a person can act on.
 */
export function validateOnboarding(raw: unknown): Validation {
  const fail = (error: string): Validation => ({ ok: false, error });
  if (!isRecord(raw) || !Array.isArray(raw.categories) || !Array.isArray(raw.funds)) {
    return fail("Something was missing from your budget. Go back and check each step.");
  }
  const { incomePence, startDay, savingsPence } = raw;
  if (!isPence(incomePence, 1)) return fail("Enter a monthly income greater than £0.00.");
  if (!Number.isInteger(startDay) || (startDay as number) < 1 || (startDay as number) > 31) {
    return fail("Choose a start day between the 1st and the 31st.");
  }
  if (!isPence(savingsPence, 0)) return fail("Enter a savings amount of £0.00 or more.");
  if (savingsPence > incomePence) return fail("Your savings can't be more than your income.");

  const categories: OnboardingCategory[] = [];
  for (const c of raw.categories as unknown[]) {
    if (!isRecord(c) || typeof c.name !== "string" || !c.name.trim()) return fail("Give every category a name.");
    if (c.kind !== "need" && c.kind !== "want") return fail(`Mark ${c.name.trim()} as a need or a want.`);
    if (!isPence(c.amountPence, 1)) return fail(`Enter an amount greater than £0.00 for ${c.name.trim()}.`);
    categories.push({ name: c.name.trim(), kind: c.kind, amountPence: c.amountPence });
  }
  if (categories.length === 0) return fail("Add at least one category.");
  const dupCategory = firstDuplicate(categories.map((c) => c.name));
  if (dupCategory) return fail(`You already have a category called ${dupCategory}.`);

  const funds: OnboardingFund[] = [];
  for (const f of raw.funds as unknown[]) {
    if (!isRecord(f) || typeof f.name !== "string" || !f.name.trim()) return fail("Give every fund a name.");
    const name = f.name.trim();
    if (!isPence(f.amountPence, 0)) return fail(`Enter a monthly amount for ${name}.`);
    if (!isPence(f.alreadySavedPence, 0)) return fail(`Enter how much is already saved in ${name}.`);
    funds.push({ name, amountPence: f.amountPence, alreadySavedPence: f.alreadySavedPence });
  }
  if (savingsPence > 0 && funds.length === 0) return fail("Add a fund for your savings to go into.");
  const dupFund = firstDuplicate(funds.map((f) => f.name));
  if (dupFund) return fail(`You already have a fund called ${dupFund}.`);
  if (splitRemainder(savingsPence, funds.map((f) => f.amountPence)) !== 0) {
    return fail("Your funds' monthly amounts must add up to your savings.");
  }

  return { ok: true, input: { incomePence, startDay: startDay as number, savingsPence, categories, funds } };
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
