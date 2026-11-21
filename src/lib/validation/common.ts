/**
 * Input checks shared by the client (forms) and the server (actions and data
 * functions). Client-safe: imports nothing from the data layer.
 */

/** Limits, matching the database's check constraints and complete_onboarding. */
export const MAX_NAME_LENGTH = 50;
export const MAX_CATEGORIES = 50;
export const MAX_FUNDS = 20;
/** £10m: the most any amount entered here may be. */
export const MAX_PENCE = 1_000_000_000;

/** One step's check: the cleaned value, or the first problem (and the field it belongs to, if one). */
export type Check<T> = { ok: true; value: T } | { ok: false; error: string; field?: "income" | "savings" };

/** Whether `v` is whole pence from `min` up to MAX_PENCE. */
export const isPence = (v: unknown, min: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= MAX_PENCE;
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A category or fund name: trimmed, 1 to MAX_NAME_LENGTH characters. */
export function checkName(raw: unknown, what: "category" | "fund"): Check<string> {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: `Give every ${what} a name.` };
  const name = raw.trim();
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `${what === "category" ? "Category" : "Fund"} names can be up to ${MAX_NAME_LENGTH} characters.` };
  }
  return { ok: true, value: name };
}

/** The first name that repeats an earlier one, ignoring case; null when all are unique. */
export function firstDuplicate(names: string[]): string | null {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) return name;
    seen.add(key);
  }
  return null;
}
