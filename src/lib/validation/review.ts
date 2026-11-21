import { isId } from "./budgetEdit";
import { checkName, isPence, isRecord } from "./common";

/**
 * Where an ended period's leftover goes (one whole amount, spec §5.9). The
 * amount is never part of the choice: the server works it out.
 */
export type LeftoverChoice =
  | { destination: "fund"; fundId: string }
  | { destination: "fund"; newFundName: string }
  | { destination: "next_period" }
  | { destination: "unassigned" };

export type LeftoverChoiceCheck = { ok: true; choice: LeftoverChoice | null } | { ok: false; error: string };

/**
 * Checks an untrusted leftover choice. `null` is allowed (nothing left over:
 * the review is only marked done). A fund choice names an existing fund or a
 * new one (trimmed, 1–50 characters). Anything else, an amount included, is
 * ignored.
 */
export function validateLeftoverChoice(raw: unknown): LeftoverChoiceCheck {
  if (raw === null) return { ok: true, choice: null };
  if (!isRecord(raw)) return { ok: false, error: "Choose where your leftover goes." };
  const { destination } = raw;
  if (destination === "next_period" || destination === "unassigned") return { ok: true, choice: { destination } };
  if (destination !== "fund") return { ok: false, error: "Choose where your leftover goes." };
  if (raw.newFundName !== undefined) {
    const name = checkName(raw.newFundName, "fund");
    return name.ok ? { ok: true, choice: { destination, newFundName: name.value } } : { ok: false, error: name.error };
  }
  if (!isId(raw.fundId)) return { ok: false, error: "Choose a fund, or name a new one." };
  return { ok: true, choice: { destination, fundId: raw.fundId } };
}

/** A raised budget for one category: whole pence, £0.01 to £10m. */
export function validateRaise(categoryId: unknown, amountPence: unknown): { ok: true } | { ok: false; error: string } {
  if (!isId(categoryId)) return { ok: false, error: "That category wasn't found. Reload the page and try again." };
  if (!isPence(amountPence, 1)) return { ok: false, error: "Enter an amount between £0.01 and £10,000,000.00." };
  return { ok: true };
}
