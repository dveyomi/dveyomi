import { parsePence } from "@/lib/calc";
import type { OnboardingInput } from "@/lib/data/onboarding";

/** The wizard's answers as typed. Nothing is saved until the last step. */
export type CategoryDraft = { id: number; name: string; kind: "need" | "want"; amountText: string };
export type FundDraft = { id: number; name: string; amountText: string; alreadySaved: boolean; alreadyText: string };
export type Draft = {
  startDay: number;
  incomeText: string;
  savingsText: string;
  categories: CategoryDraft[];
  funds: FundDraft[];
};

/** Pence for an optional amount: empty is 0, an invalid amount is null. */
export function optionalPence(text: string): number | null {
  return text.trim() === "" ? 0 : parsePence(text);
}

/** Pence for live figures while typing: anything not yet a valid amount counts as 0. */
export function livePence(text: string): number {
  return parsePence(text) ?? 0;
}

/**
 * The answers in pence, for validation and saving. Amounts that do not parse
 * become NaN so validateOnboarding rejects them. Funds' monthly amounts count
 * only when the user saves something each month.
 */
export function toInput(d: Draft): OnboardingInput {
  const pence = (text: string) => parsePence(text) ?? Number.NaN;
  const savingsPence = optionalPence(d.savingsText) ?? Number.NaN;
  return {
    incomePence: pence(d.incomeText),
    startDay: d.startDay,
    savingsPence,
    categories: d.categories.map((c) => ({ name: c.name, kind: c.kind, amountPence: pence(c.amountText) })),
    funds: d.funds.map((f) => ({
      name: f.name,
      amountPence: savingsPence > 0 ? pence(f.amountText) : 0,
      alreadySavedPence: f.alreadySaved ? pence(f.alreadyText) : 0,
    })),
  };
}
