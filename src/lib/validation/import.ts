import { DEFAULT_I18N, type I18n } from "@/i18n/format";
import type { IsoDate } from "@/lib/calc";
import { MAX_FILENAME_LENGTH, MAX_IMPORT_ROWS, type ImportRow } from "@/lib/import/csv";
import { isId } from "./budgetEdit";
import { isPence, isRecord } from "./common";
import { expenseDateRange, isIsoDate, MAX_EXPENSE_NAME_LENGTH } from "./expense";

/**
 * The import's checks on the server: the wizard's rows are untrusted, so the
 * server action checks each one again (and import_expenses checks the bounds
 * once more in the database).
 */

/** A row to import, with its own category when it isn't the default. */
export type ImportInputRow = ImportRow & { categoryId?: string };
export type ImportInput = { filename: string; categoryId: string; rows: ImportInputRow[] };

const fail = (error: string) => ({ ok: false as const, error });

/** One row: a 1-based row number, a real date (within `range` when given), whole pence of 1p to £10m and a trimmed name of 1–100 characters. */
function checkRow(raw: unknown, range: { min: IsoDate; max: IsoDate } | null): ImportInputRow | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!Number.isSafeInteger(raw.row) || (raw.row as number) < 1) return null;
  if (!isIsoDate(raw.date) || (range && (raw.date < range.min || raw.date > range.max))) return null;
  if (!isPence(raw.amountPence, 1)) return null;
  if (!name || name.length > MAX_EXPENSE_NAME_LENGTH) return null;
  if (raw.categoryId !== undefined && !isId(raw.categoryId)) return null;
  return {
    row: raw.row as number,
    date: raw.date,
    amountPence: raw.amountPence,
    name,
    ...(raw.categoryId !== undefined ? { categoryId: raw.categoryId as string } : {}),
  };
}

/**
 * Checks an import: a file name (1–255 characters), a default category id,
 * and 1 to 5,000 rows, each within checkRow's bounds and the expense date
 * range for `today` (the server's today for the user).
 */
export function validateImport(
  raw: unknown,
  today: IsoDate,
  i18n: I18n = DEFAULT_I18N,
): { ok: true; input: ImportInput } | { ok: false; error: string } {
  if (!isRecord(raw)) return fail(i18n.m.importer.missing);
  const filename = typeof raw.filename === "string" ? raw.filename.trim() : "";
  if (!filename || filename.length > MAX_FILENAME_LENGTH) return fail(i18n.m.importer.badFilename);
  if (!isId(raw.categoryId)) return fail(i18n.m.importer.chooseCategory);
  if (!Array.isArray(raw.rows) || raw.rows.length === 0) return fail(i18n.m.importer.tickOne);
  if (raw.rows.length > MAX_IMPORT_ROWS) return fail(i18n.m.importer.maxRows(MAX_IMPORT_ROWS.toLocaleString("en-GB")));

  const range = expenseDateRange(today);
  const rows: ImportInputRow[] = [];
  for (const r of raw.rows) {
    const row = checkRow(r, range);
    if (!row) {
      const n = isRecord(r) && Number.isSafeInteger(r.row) ? r.row : null;
      return fail(i18n.m.importer.rowCant(typeof n === "number" ? n : null));
    }
    rows.push(row);
  }
  return { ok: true, input: { filename, categoryId: raw.categoryId, rows } };
}

/** The rows sent to check for duplicates: up to 5,000 rows with a date (in the expense date range for `today`), amount and name. Null when malformed. */
export function validateDuplicateCheck(raw: unknown, today: IsoDate): ImportRow[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_IMPORT_ROWS) return null;
  const range = expenseDateRange(today);
  const rows: ImportRow[] = [];
  for (const r of raw) {
    if (!isRecord(r) || typeof r.name !== "string") return null;
    const row = checkRow(r, range);
    if (!row) return null;
    rows.push({ row: row.row, date: row.date, amountPence: row.amountPence, name: r.name });
  }
  return rows;
}
