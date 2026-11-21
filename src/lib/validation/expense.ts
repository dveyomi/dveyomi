import type { IsoDate } from "@/lib/calc";
import { checkCategoryName, isId, type Kind } from "./budgetEdit";
import { isPence, isRecord } from "./common";

/**
 * The add/edit expense form's input and its checks. Client-safe: the form runs
 * the same check before sending that the server action runs on receipt.
 */

export const MAX_EXPENSE_NAME_LENGTH = 100;
export const MAX_ACCOUNT_LABEL_LENGTH = 50;
export const MAX_NOTES_LENGTH = 500;
export const AMOUNT_ERROR = "Enter an amount greater than £0.00, e.g. 12.50";

/** An existing category by id, or a new one to create in the same save. */
export type ExpenseCategory = { id: string } | { name: string; kind: Kind };

/** A checked expense. Optional text is left out when empty. */
export type ExpenseInput = {
  name: string;
  amountPence: number;
  date: IsoDate;
  category: ExpenseCategory;
  fundId: string | null;
  accountLabel?: string;
  notes?: string;
};

/** The form field a problem belongs to. */
export type ExpenseField = "amount" | "name" | "category" | "newCategory" | "date" | "fund" | "accountLabel" | "notes";

export type ExpenseValidation = { ok: true; input: ExpenseInput } | { ok: false; error: string; field?: ExpenseField };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `v` is a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(v: unknown): v is IsoDate {
  if (typeof v !== "string") return false;
  const m = ISO_DATE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * The dates an expense may have: from 10 years before `today` to a year
 * after it (same day of the year). Compared as YYYY-MM-DD strings.
 */
export function expenseDateRange(today: IsoDate): { min: IsoDate; max: IsoDate } {
  const year = Number(today.slice(0, 4));
  const rest = today.slice(4);
  return { min: `${year - 10}${rest}`, max: `${year + 1}${rest}` };
}
export const DATE_RANGE_ERROR = "Choose a date within the last 10 years or the next 12 months.";

/** Optional text: trimmed, left out when empty, at most `max` characters. */
function optionalText(raw: unknown, max: number): { ok: true; value?: string } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true };
  if (typeof raw !== "string") return { ok: false };
  const value = raw.trim();
  if (value.length > max) return { ok: false };
  return value ? { ok: true, value } : { ok: true };
}

/**
 * Checks untrusted expense input: a name (trimmed, 1–100 characters), an
 * amount of whole pence from 1p to £10m, a real date within
 * `expenseDateRange(today)` (`today` comes from the server, or the page it
 * rendered), an existing category id
 * or a new category's name and kind, an optional fund id, and optional
 * account label (≤50) and notes (≤500). Returns the input cleaned, or the
 * first problem in words a person can act on, with its field.
 */
export function validateExpense(raw: unknown, today: IsoDate): ExpenseValidation {
  const fail = (error: string, field?: ExpenseField): ExpenseValidation => ({ ok: false, error, ...(field ? { field } : {}) });
  if (!isRecord(raw)) return fail("Something was missing from this expense. Check it and try again.");

  if (!isPence(raw.amountPence, 1)) return fail(AMOUNT_ERROR, "amount");
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return fail("Give this expense a name, e.g. Tesco.", "name");
  if (name.length > MAX_EXPENSE_NAME_LENGTH) return fail(`Names can be up to ${MAX_EXPENSE_NAME_LENGTH} characters.`, "name");

  let category: ExpenseCategory;
  const c = raw.category;
  if (isRecord(c) && "id" in c) {
    if (!isId(c.id)) return fail("Choose a category.", "category");
    category = { id: c.id };
  } else if (isRecord(c) && "name" in c) {
    const catName = checkCategoryName(c.name);
    if (!catName.ok) {
      const empty = typeof c.name !== "string" || !c.name.trim();
      return fail(empty ? "Give the new category a name." : catName.error, "newCategory");
    }
    if (c.kind !== "need" && c.kind !== "want") return fail(`Mark ${catName.value} as a need or a want.`, "newCategory");
    category = { name: catName.value, kind: c.kind };
  } else {
    return fail("Choose a category.", "category");
  }

  if (!isIsoDate(raw.date)) return fail("Enter a date, e.g. 21/11/2026.", "date");
  const range = expenseDateRange(today);
  if (raw.date < range.min || raw.date > range.max) return fail(DATE_RANGE_ERROR, "date");
  if (raw.fundId !== null && raw.fundId !== undefined && !isId(raw.fundId)) return fail("That fund wasn't recognised.", "fund");

  const accountLabel = optionalText(raw.accountLabel, MAX_ACCOUNT_LABEL_LENGTH);
  if (!accountLabel.ok) return fail(`Account names can be up to ${MAX_ACCOUNT_LABEL_LENGTH} characters.`, "accountLabel");
  const notes = optionalText(raw.notes, MAX_NOTES_LENGTH);
  if (!notes.ok) return fail(`Notes can be up to ${MAX_NOTES_LENGTH} characters.`, "notes");

  return {
    ok: true,
    input: {
      name,
      amountPence: raw.amountPence,
      date: raw.date,
      category,
      fundId: (raw.fundId as string | null | undefined) ?? null,
      ...(accountLabel.value ? { accountLabel: accountLabel.value } : {}),
      ...(notes.value ? { notes: notes.value } : {}),
    },
  };
}

/** The form's fields as text, before checking. `categoryId` is null until one is chosen. */
export type ExpenseFormValues = {
  name: string;
  amountText: string;
  date: IsoDate;
  categoryId: string | null;
  fundId: string | null;
  accountLabel: string;
  notes: string;
};

/**
 * A new expense's starting values: the category from ?category= when it is
 * one of the user's, and the date from ?date= when it is a real date (a
 * tapped calendar day), else today.
 */
export function newExpenseValues(
  params: { category?: string | string[]; date?: string | string[] },
  categories: { id: string }[],
  today: IsoDate,
): ExpenseFormValues {
  const category = typeof params.category === "string" ? params.category : null;
  const date = typeof params.date === "string" && isIsoDate(params.date) ? params.date : today;
  return {
    name: "",
    amountText: "",
    date,
    categoryId: categories.some((c) => c.id === category) ? category : null,
    fundId: null,
    accountLabel: "",
    notes: "",
  };
}
