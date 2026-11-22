import type { IsoDate } from "@/lib/calc";
import { isId } from "./budgetEdit";
import { DEFAULT_I18N, type I18n } from "@/i18n/format";
import { CURRENCIES } from "@/lib/locale";
import { amountRequiredError, checkName, firstDuplicate, isAmount, isRecord, MAX_FUNDS } from "./common";
import { expenseDateRange, isIsoDate } from "./expense";

/**
 * Checks for the Saving tab's forms: a fund's details, money added to or
 * taken from a fund, and a savings split. Client-safe: the forms run the same
 * check before sending that the server actions run on receipt.
 */

export const MAX_FUND_NOTE_LENGTH = 200;
/** Target dates a fund may have. */
const TARGET_DATE_MIN = "2000-01-01";
const TARGET_DATE_MAX = "2100-12-31";

export type FundField = "name" | "target" | "targetDate";
export type MovementField = "amount" | "date" | "note";
export type FundMoveField = MovementField | "to";
/** Where a withdrawal goes: into this month's spending money, or just out of the fund. */
export type WithdrawDestination = "spending" | "out";

export type FundDetails = { name: string; targetPence: number | null; targetDate: IsoDate | null };
export type FundMovementInput = {
  kind: "contribution" | "withdrawal";
  amountPence: number;
  date: IsoDate;
  note: string | null;
};
export type SplitInputLine =
  | { fundId: string; amountPence: number }
  | { newFund: { name: string; targetPence: number | null }; amountPence: number };

type Failure<F> = { ok: false; error: string; field?: F };
const fail = <F extends string>(error: string, field?: F): Failure<F> => ({ ok: false, error, ...(field ? { field } : {}) });

/** An optional target: empty or £0 means none; otherwise whole pence up to £10m. */
function checkTarget(raw: unknown, i18n: I18n): { ok: true; value: number | null } | { ok: false } {
  if (raw === undefined || raw === null || raw === 0) return { ok: true, value: null };
  return isAmount(raw, 1, i18n.currency) ? { ok: true, value: raw } : { ok: false };
}

const targetError = ({ m, fmt, currency }: I18n) =>
  m.validation.target(fmt.money(0), m.validation.tenMillion(CURRENCIES[currency].symbol));

/** A fund's name (trimmed, 1–50), optional target and optional target date. */
export function validateFund(raw: unknown, i18n: I18n = DEFAULT_I18N): { ok: true; input: FundDetails } | Failure<FundField> {
  if (!isRecord(raw)) return fail("Something was missing from this fund. Check it and try again.");
  const name = checkName(raw.name, "fund", i18n);
  if (!name.ok) return fail(name.error === i18n.m.names.required.fund ? "Give this fund a name." : name.error, "name");
  const target = checkTarget(raw.targetPence, i18n);
  if (!target.ok) return fail(targetError(i18n), "target");
  let targetDate: IsoDate | null = null;
  if (raw.targetDate !== undefined && raw.targetDate !== null && raw.targetDate !== "") {
    if (!isIsoDate(raw.targetDate) || raw.targetDate < TARGET_DATE_MIN || raw.targetDate > TARGET_DATE_MAX) {
      return fail("Enter a target date, e.g. 31/07/2027, or leave it empty.", "targetDate");
    }
    targetDate = raw.targetDate;
  }
  return { ok: true, input: { name: name.value, targetPence: target.value, targetDate } };
}

/**
 * Money added to or taken from a fund: an amount from 1p to £10m, a date
 * from 10 years before `today` up to `today`, and an optional note (≤200).
 */
export function validateMovement(
  raw: unknown,
  today: IsoDate,
  i18n: I18n = DEFAULT_I18N,
): { ok: true; input: FundMovementInput } | Failure<MovementField> {
  if (!isRecord(raw) || (raw.kind !== "contribution" && raw.kind !== "withdrawal")) {
    return fail("Something was missing. Check it and try again.");
  }
  if (!isAmount(raw.amountPence, 1, i18n.currency)) return fail(amountRequiredError(i18n, "25.00"), "amount");
  if (!isIsoDate(raw.date)) return fail("Enter a date, e.g. 21/11/2026.", "date");
  if (raw.date < expenseDateRange(today).min || raw.date > today) {
    return fail("Choose a date within the last 10 years, up to today.", "date");
  }
  let note: string | null = null;
  if (raw.note !== undefined && raw.note !== null) {
    if (typeof raw.note !== "string" || raw.note.trim().length > MAX_FUND_NOTE_LENGTH) {
      return fail(`Notes can be up to ${MAX_FUND_NOTE_LENGTH} characters.`, "note");
    }
    note = raw.note.trim() || null;
  }
  return { ok: true, input: { kind: raw.kind, amountPence: raw.amountPence, date: raw.date, note } };
}

/** A withdrawal: a movement (see validateMovement) and where the money goes. */
export function validateWithdrawal(
  raw: unknown,
  today: IsoDate,
  i18n: I18n = DEFAULT_I18N,
): { ok: true; input: FundMovementInput; destination: WithdrawDestination } | Failure<MovementField> {
  if (!isRecord(raw) || (raw.destination !== "spending" && raw.destination !== "out")) {
    return fail("Choose where the money goes.");
  }
  const checked = validateMovement({ ...raw, kind: "withdrawal" }, today, i18n);
  return checked.ok ? { ...checked, destination: raw.destination } : checked;
}

/** Money moved between funds: an amount, a date and an optional note, as validateMovement checks them. */
export function validateFundMove(
  raw: unknown,
  today: IsoDate,
  i18n: I18n = DEFAULT_I18N,
): { ok: true; input: Omit<FundMovementInput, "kind"> } | Failure<MovementField> {
  if (!isRecord(raw)) return fail("Something was missing. Check it and try again.");
  const checked = validateMovement({ ...raw, kind: "withdrawal" }, today, i18n);
  if (!checked.ok) return checked;
  const { amountPence, date, note } = checked.input;
  return { ok: true, input: { amountPence, date, note } };
}

/**
 * A savings split: 1 to 20 lines, each an existing fund (by id) or a new fund
 * (name and optional target), with £0 or more. Each fund once; new names
 * unique among themselves. The total is checked by the database against the
 * period's current savings.
 */
export function validateConfirmSplit(raw: unknown, i18n: I18n = DEFAULT_I18N): { ok: true; lines: SplitInputLine[] } | Failure<never> {
  if (!Array.isArray(raw) || raw.length === 0) return fail("Choose where your savings go.");
  if (raw.length > MAX_FUNDS) return fail(`You can split your savings across up to ${MAX_FUNDS} funds.`);
  const lines: SplitInputLine[] = [];
  for (const line of raw) {
    if (!isRecord(line) || !isAmount(line.amountPence, 0, i18n.currency)) return fail(i18n.m.validation.eachFund(i18n.fmt.money(0)));
    if (isRecord(line.newFund)) {
      const name = checkName(line.newFund.name, "fund", i18n);
      if (!name.ok) return fail(name.error === i18n.m.names.required.fund ? "Give the new fund a name." : name.error);
      const target = checkTarget(line.newFund.targetPence, i18n);
      if (!target.ok) return fail(targetError(i18n));
      lines.push({ newFund: { name: name.value, targetPence: target.value }, amountPence: line.amountPence });
    } else if (isId(line.fundId)) {
      lines.push({ fundId: line.fundId, amountPence: line.amountPence });
    } else {
      return fail("That fund wasn't found. Reload the page and try again.");
    }
  }
  const ids = lines.flatMap((l) => ("fundId" in l ? [l.fundId] : []));
  if (new Set(ids).size !== ids.length) return fail("Each fund can appear once.");
  const dup = firstDuplicate(lines.flatMap((l) => ("newFund" in l ? [l.newFund.name] : [])));
  if (dup) return fail(`You've added ${dup} twice.`);
  return { ok: true, lines };
}
