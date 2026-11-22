import { addDays, daysBetween, formatGBP, parsePence, type IsoDate } from "@/lib/calc";
import { MAX_PENCE } from "@/lib/validation/common";
import { expenseDateRange, isIsoDate, MAX_EXPENSE_NAME_LENGTH } from "@/lib/validation/expense";

/**
 * Importing expenses from a bank export, in the browser. Pure and
 * client-safe: parseCsv turns a file's text into rows, mapRows turns rows into
 * expenses (or row-numbered problems), findDuplicates flags rows already
 * recorded. Nothing here saves anything; commitImport (src/lib/data/imports.ts)
 * does, on the wizard's last click.
 */

export type DateFormat = "DD/MM/YYYY" | "YYYY-MM-DD" | "MM/DD/YYYY";
export const DATE_FORMATS: readonly DateFormat[] = ["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"];

/** Which sign a bank file uses for money going out: "negative" (most bank exports) or "positive". */
export type MoneyOut = "negative" | "positive";

/** Which columns hold what (0-based), and how to read them. */
export type ColumnMapping = {
  date: number;
  amount: number;
  name: number;
  dateFormat: DateFormat;
  /** Default "negative": negative numbers are spending and positive ones money in. */
  moneyOut?: MoneyOut;
  /** The first row is a header (it is not imported, and counts as row 1). Default false. */
  hasHeader?: boolean;
};

/** An expense read from a file: `row` is its 1-based row in the file, counting a header. */
export type ImportRow = { row: number; date: IsoDate; amountPence: number; name: string };

/** A row that isn't imported, and why, in words a person can act on. */
export type RowNote = { row: number; reason: string };

/** An expense already recorded, as findDuplicates compares it. `source` is 'manual', 'csv' or 'recurring'. */
export type ExistingExpense = { date: IsoDate; amountPence: number; name: string; source: string };

/** A file turned into rows of text fields (CSV, or an Excel sheet). */
export type FileReader = (file: File) => Promise<string[][]>;

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const MAX_FILENAME_LENGTH = 255;

/** A file the import can't use (too big, or no rows). Its message is shown as it is. */
export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

/** The import's limits: a file of at most 2 MB, with 1 to 5,000 rows to import. Null when within them. */
export function importLimitError({ bytes, dataRows }: { bytes?: number; dataRows?: number }): string | null {
  if (bytes !== undefined && bytes > MAX_FILE_BYTES) {
    return "This file is over 2 MB. Split it into smaller files and import each one.";
  }
  if (dataRows !== undefined && dataRows < 1) return "This file has no rows to import.";
  if (dataRows !== undefined && dataRows > MAX_IMPORT_ROWS) {
    return `This file has more than ${MAX_IMPORT_ROWS.toLocaleString("en-GB")} rows. Split it into smaller files and import each one.`;
  }
  return null;
}

/**
 * Comma-separated text into rows of fields. Fields may be quoted ("…"), and a
 * quoted field may hold commas, newlines and doubled quotes (""). Accepts LF,
 * CRLF and CR line endings, strips a UTF-8 byte order mark, and drops blank
 * lines and rows whose fields are all empty (",,,"). An unclosed quote runs to the end of the file.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endRow = () => {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
    row = [];
    field = "";
  };

  while (i < src.length) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += c;
      }
      i += 1;
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" || c === "\n") {
      endRow();
      if (c === "\r" && src[i + 1] === "\n") i += 1;
    } else {
      field += c;
    }
    i += 1;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Reads a .csv File into rows. Throws ImportFileError for a file over 2 MB, before reading it. */
export const readCsvFile: FileReader = async (file) => {
  const tooBig = importLimitError({ bytes: file.size });
  if (tooBig) throw new ImportFileError(tooBig);
  return parseCsv(await file.text());
};

const YMD = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
const XXY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;

/** A date written in `format` (any of / - . as separators; a trailing time is ignored) as YYYY-MM-DD, or null. */
export function parseDate(raw: string, format: DateFormat): IsoDate | null {
  const text = raw.trim().split(/[ T]/)[0];
  let y: string, m: string, d: string;
  if (format === "YYYY-MM-DD") {
    const match = YMD.exec(text);
    if (!match) return null;
    [, y, m, d] = match;
  } else {
    const match = XXY.exec(text);
    if (!match) return null;
    [, d, m, y] = match;
    if (format === "MM/DD/YYYY") [d, m] = [m, d];
  }
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

type Amount = { ok: true; signedPence: number } | { ok: false; reason: string };

const AMOUNT = /^([+-]?)£?([+-]?)([\d.,]+)(-?)$/;

/**
 * An amount as a bank writes it: an optional sign before or after £, a
 * trailing minus, or brackets for negative; thousands commas and spaces are
 * ignored. The digits go through parsePence. Returns signed pence.
 */
export function parseAmount(raw: string | undefined): Amount {
  let text = (raw ?? "").replace(/\s+/g, "");
  if (!text) return { ok: false, reason: "Amount is missing" };
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  const match = AMOUNT.exec(text);
  const signs = match ? [match[1], match[2], match[4]].filter(Boolean) : [];
  const shown = (raw ?? "").trim();
  if (!match || signs.length > 1 || (negative && signs.length > 0)) {
    return { ok: false, reason: `Amount “${shown}” isn’t a number of pounds and pence` };
  }
  if (/^[0.,]+$/.test(match[3]) && /0/.test(match[3])) return { ok: false, reason: "Amount is £0.00" };
  const pence = parsePence(match[3]);
  if (pence === null) return { ok: false, reason: `Amount “${shown}” isn’t a number of pounds and pence` };
  if (pence > MAX_PENCE) return { ok: false, reason: `Amount is over ${formatGBP(MAX_PENCE)}` };
  return { ok: true, signedPence: negative || signs[0] === "-" ? -pence : pence };
}

/** A name as stored: runs of spaces collapsed, trimmed, and cut to 100 characters. */
export function cleanName(raw: string | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_EXPENSE_NAME_LENGTH).trim();
}

/**
 * Rows of fields into expenses. Each row is either imported (`ok`), a problem
 * (`errors`: a bad date, amount or name) or money in, which isn't spending
 * (`skipped`). Spending is negative numbers unless `moneyOut` is "positive";
 * amounts are kept as positive pence. With `today`, dates outside the range an
 * expense may have (expenseDateRange) are errors too. Row numbers are 1-based
 * and count the header when `hasHeader` is set.
 */
export function mapRows(
  rows: string[][],
  mapping: ColumnMapping,
  today?: IsoDate,
): { ok: ImportRow[]; errors: RowNote[]; skipped: RowNote[] } {
  const ok: ImportRow[] = [];
  const errors: RowNote[] = [];
  const skipped: RowNote[] = [];
  const range = today ? expenseDateRange(today) : null;
  const spendingSign = mapping.moneyOut === "positive" ? 1 : -1;

  rows.forEach((fields, index) => {
    if (mapping.hasHeader && index === 0) return;
    const row = index + 1;
    const amount = parseAmount(fields[mapping.amount]);
    if (!amount.ok) {
      errors.push({ row, reason: amount.reason });
      return;
    }
    if (Math.sign(amount.signedPence) !== spendingSign) {
      skipped.push({ row, reason: "Money in (credits aren’t imported)" });
      return;
    }
    const rawDate = (fields[mapping.date] ?? "").trim();
    const date = parseDate(rawDate, mapping.dateFormat);
    if (!date) {
      errors.push({ row, reason: rawDate ? `Date “${rawDate}” isn’t a real ${mapping.dateFormat} date` : "Date is missing" });
      return;
    }
    if (range && (date < range.min || date > range.max)) {
      errors.push({ row, reason: `Date ${rawDate} is more than 10 years ago or over a year ahead` });
      return;
    }
    const name = cleanName(fields[mapping.name]);
    if (!name) {
      errors.push({ row, reason: "Name is empty" });
      return;
    }
    ok.push({ row, date, amountPence: Math.abs(amount.signedPence), name });
  });
  return { ok, errors, skipped };
}

/** How many days either side of a row an existing expense with the same amount counts as the same payment (bank dates drift). */
export const DUPLICATE_DAYS = 2;

const rowKey = (r: ImportRow) => `${r.date}|${r.amountPence}|${r.name.replace(/\s+/g, " ").trim().toLowerCase()}`;

/** The dates existing expenses are read for: the rows' first date − 2 days to their last + 2. Null for no rows. */
export function duplicateWindow(rows: Pick<ImportRow, "date">[]): { from: IsoDate; to: IsoDate } | null {
  if (rows.length === 0) return null;
  let min = rows[0].date;
  let max = rows[0].date;
  for (const r of rows) {
    if (r.date < min) min = r.date;
    if (r.date > max) max = r.date;
  }
  return { from: addDays(min, -DUPLICATE_DAYS), to: addDays(max, DUPLICATE_DAYS) };
}

/**
 * Rows that look like duplicates, by index into `rows`, each with the label
 * the preview shows. A row is one when an expense already recorded (any
 * source) has the same amount within 2 days of its date, whatever its name
 * ("Looks like your Netflix", "…your recurring Netflix"; the closest date
 * wins), or when an earlier row of the same file has the same date, amount
 * and name, ignoring case and spaces ("Same as row 3 in this file").
 */
export function findDuplicates(rows: ImportRow[], existing: ExistingExpense[]): Map<number, string> {
  const byAmount = Map.groupBy(existing, (e) => e.amountPence);
  const firstRow = new Map<string, number>();
  const dupes = new Map<number, string>();
  rows.forEach((r, i) => {
    let match: ExistingExpense | null = null;
    let distance = Infinity;
    for (const e of byAmount.get(r.amountPence) ?? []) {
      const d = Math.abs(daysBetween(e.date, r.date));
      if (d <= DUPLICATE_DAYS && d < distance) {
        match = e;
        distance = d;
      }
    }
    const key = rowKey(r);
    const earlier = firstRow.get(key);
    if (match) dupes.set(i, `Looks like your ${match.source === "recurring" ? "recurring " : ""}${match.name}`);
    else if (earlier !== undefined) dupes.set(i, `Same as row ${earlier} in this file`);
    if (earlier === undefined) firstRow.set(key, r.row);
  });
  return dupes;
}

/** Whether a first row reads as a header: none of its cells is a date or an amount. */
export function looksLikeHeader(fields: string[]): boolean {
  return fields.every(
    (f) => !f.trim() || (DATE_FORMATS.every((fmt) => parseDate(f, fmt) === null) && !parseAmount(f).ok),
  );
}

const firstMatching = (header: string[], pattern: RegExp): number | null => {
  const i = header.findIndex((h) => pattern.test(h));
  return i === -1 ? null : i;
};

/** The date, amount and name columns guessed from header names (case-insensitive), or null where none fits. */
export function guessColumns(header: string[]): { date: number | null; amount: number | null; name: number | null } {
  return {
    date: firstMatching(header, /date/i),
    amount: firstMatching(header, /amount|value/i),
    name: firstMatching(header, /description|name|merchant|payee|details|narrative|memo/i),
  };
}

/** The first format every non-empty sample reads in (DD/MM/YYYY first, as UK banks write); DD/MM/YYYY when none does. */
export function guessDateFormat(samples: string[]): DateFormat {
  const values = samples.map((s) => s.trim()).filter(Boolean);
  return DATE_FORMATS.find((fmt) => values.length > 0 && values.every((v) => parseDate(v, fmt) !== null)) ?? "DD/MM/YYYY";
}

/** A starting mapping for the wizard to show; the user can change every part. */
export type GuessedMapping = {
  hasHeader: boolean;
  date: number | null;
  amount: number | null;
  name: number | null;
  dateFormat: DateFormat;
};

/** How many data rows the guesses look at. */
const SAMPLE_ROWS = 20;

/**
 * Guesses whether the first row is a header (looksLikeHeader), then each
 * column: by header name where one says (guessColumns), else by the first
 * data rows' values (the first column of dates, then of amounts, then of
 * text), and the date format from the date column's values.
 */
export function guessMapping(rows: string[][]): GuessedMapping {
  const hasHeader = rows.length > 0 && looksLikeHeader(rows[0]);
  const samples = rows.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + SAMPLE_ROWS);
  const width = Math.max(0, ...rows.slice(0, SAMPLE_ROWS + 1).map((r) => r.length));
  const column = (i: number) => samples.map((r) => (r[i] ?? "").trim()).filter(Boolean);
  const firstWhere = (taken: (number | null)[], test: (values: string[]) => boolean): number | null => {
    for (let i = 0; i < width; i += 1) {
      const values = column(i);
      if (!taken.includes(i) && values.length > 0 && test(values)) return i;
    }
    return null;
  };

  const named = hasHeader ? guessColumns(rows[0]) : { date: null, amount: null, name: null };
  const date = named.date ?? firstWhere([], (v) => DATE_FORMATS.some((fmt) => v.every((x) => parseDate(x, fmt) !== null)));
  const amount = named.amount ?? firstWhere([date], (v) => v.every((x) => parseAmount(x).ok));
  const name = named.name ?? firstWhere([date, amount], (v) => v.some((x) => !parseAmount(x).ok));
  return { hasHeader, date, amount, name, dateFormat: guessDateFormat(date === null ? [] : column(date)) };
}
