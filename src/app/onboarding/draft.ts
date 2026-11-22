import { parseAmount, parseOptionalAmount } from "@/lib/calc";
import type { CurrencyCode } from "@/lib/locale";
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

/** Pence for live figures while typing: anything not yet a valid amount counts as 0. */
export function livePence(text: string, currency: CurrencyCode = "GBP"): number {
  return parseAmount(text, currency) ?? 0;
}

/**
 * The answers in pence, for validation and saving. Amounts that do not parse
 * become NaN so validateOnboarding rejects them. Savings and funds' monthly
 * amounts are optional (empty or 0 is 0); funds' monthly amounts count only
 * when the user saves something each month.
 */
export function toInput(d: Draft, currency: CurrencyCode = "GBP"): OnboardingInput {
  const pence = (text: string) => parseAmount(text, currency) ?? Number.NaN;
  const savingsPence = parseOptionalAmount(d.savingsText, currency) ?? Number.NaN;
  return {
    incomePence: pence(d.incomeText),
    startDay: d.startDay,
    savingsPence,
    categories: d.categories.map((c) => ({ name: c.name, kind: c.kind, amountPence: pence(c.amountText) })),
    funds: d.funds.map((f) => ({
      name: f.name,
      amountPence: savingsPence > 0 ? (parseOptionalAmount(f.amountText, currency) ?? Number.NaN) : 0,
      alreadySavedPence: f.alreadySaved ? pence(f.alreadyText) : 0,
    })),
  };
}
