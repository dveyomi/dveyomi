import { DEFAULT_I18N, type I18n } from "@/i18n/format";
import { MAX_CATEGORIES, amountLimits, checkName, firstDuplicate, isAmount, isRecord, type Check } from "./common";

/**
 * The budget editor's input and its checks. Client-safe: the editor runs the
 * same check before sending that the server action runs on receipt.
 */

export type Kind = "need" | "want";

/** A category in a budget, with its allocation in that period. */
export type EditorCategory = { id: string; name: string; kind: Kind; amountPence: number };

/** A period's income, savings and allocations, as the editor shows them. */
export type BudgetFigures = { incomePence: number; savingsPence: number; categories: EditorCategory[] };

/**
 * "this": the current period and, if it exists, the next one. "next": only
 * the next period, created now if needed. Past periods are never changed.
 */
export type BudgetEditScope = "this" | "next";

/**
 * One category row as saved. No `id` = a new category (its `kind` is used);
 * with an id, only the name can change. `removed` drops it from the budget.
 */
export type BudgetEditCategory = { id?: string; name: string; kind: Kind; amountPence: number; removed?: boolean };

export type BudgetEditInput = {
  incomePence: number;
  savingsPence: number;
  scope: BudgetEditScope;
  categories: BudgetEditCategory[];
};

export type BudgetEditValidation = { ok: true; input: BudgetEditInput } | { ok: false; error: string; field?: "income" | "savings" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `v` looks like a row id (a UUID). */
export const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** A category name: trimmed, 1–50 characters. */
export function checkCategoryName(raw: unknown): Check<string> {
  return checkName(raw, "category");
}

/**
 * Checks untrusted budget-edit input: income, savings no more than income,
 * the scope, and up to MAX_CATEGORIES categories kept in the budget, each
 * with a unique trimmed name, a kind and an amount of £0 or more. Removed
 * rows need only a known id. Returns the input with names trimmed, or the
 * first problem in words a person can act on.
 */
export function validateBudgetEdit(raw: unknown, i18n: I18n = DEFAULT_I18N): BudgetEditValidation {
  const { m, currency } = i18n;
  const fail = (error: string): BudgetEditValidation => ({ ok: false, error });
  if (!isRecord(raw)) return fail("Something was missing from your budget. Check it and try again.");
  const { incomePence, savingsPence, scope } = raw;
  if (!isAmount(incomePence, 1, currency)) {
    const { min, max } = amountLimits(i18n, 1);
    return { ok: false, field: "income", error: m.validation.incomeRange(min, max) };
  }
  if (!isAmount(savingsPence, 0, currency)) {
    return { ok: false, field: "savings", error: m.validation.savingsAmount[currency] };
  }
  if (savingsPence > incomePence) {
    return { ok: false, field: "savings", error: "Your savings can't be more than your income." };
  }
  if (scope !== "this" && scope !== "next") return fail("Choose when the changes start.");
  if (!Array.isArray(raw.categories)) return fail("Something was missing from your categories. Check each one.");

  const categories: BudgetEditCategory[] = [];
  for (const c of raw.categories as unknown[]) {
    if (!isRecord(c)) return fail("Something was missing from your categories. Check each one.");
    if (c.id !== undefined && !isId(c.id)) return fail("A category wasn't recognised.");
    const id = c.id as string | undefined;
    if (c.removed === true) {
      if (!id) continue; // a new row removed before saving: nothing to save
      if (typeof c.name !== "string" || (c.kind !== "need" && c.kind !== "want")) return fail("A category wasn't recognised.");
      categories.push({ id, name: c.name, kind: c.kind, amountPence: 0, removed: true });
      continue;
    }
    const name = checkCategoryName(c.name);
    if (!name.ok) return name;
    if (c.kind !== "need" && c.kind !== "want") return fail(`Mark ${name.value} as a need or a want.`);
    if (!isAmount(c.amountPence, 0, currency)) {
      const { min, max } = amountLimits(i18n, 0);
      return fail(m.validation.amountRangeFor(name.value, min, max));
    }
    categories.push({ ...(id ? { id } : {}), name: name.value, kind: c.kind, amountPence: c.amountPence });
  }
  const kept = categories.filter((c) => !c.removed);
  if (kept.length > MAX_CATEGORIES) return fail(`You can have up to ${MAX_CATEGORIES} categories in your budget.`);
  const dup = firstDuplicate(kept.map((c) => c.name));
  if (dup) return fail(`You already have a category called ${dup}.`);
  const ids = categories.flatMap((c) => (c.id ? [c.id] : []));
  if (new Set(ids).size !== ids.length) return fail("A category appears twice. Reload the page and try again.");

  return { ok: true, input: { incomePence, savingsPence, scope, categories } };
}
