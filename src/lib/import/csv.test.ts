import { describe, expect, it } from "vitest";
import {
  findDuplicates,
  guessColumns,
  guessDateFormat,
  guessMapping,
  importLimitError,
  looksLikeHeader,
  mapRows,
  MAX_FILE_BYTES,
  MAX_IMPORT_ROWS,
  parseCsv,
  readCsvFile,
  type ImportRow,
} from "./csv";

describe("parseCsv", () => {
  it("splits rows and keeps commas inside quoted fields", () => {
    expect(parseCsv('a,"b,c"\n1,2')).toEqual([
      ["a", "b,c"],
      ["1", "2"],
    ]);
  });

  it("keeps newlines inside quoted fields", () => {
    expect(parseCsv('name,notes\nTesco,"line one\nline two"\n')).toEqual([
      ["name", "notes"],
      ["Tesco", "line one\nline two"],
    ]);
  });

  it("reads doubled quotes as one quote", () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', "x"]]);
  });

  it("accepts CRLF and lone CR line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n3,4\r5,6")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("strips a UTF-8 byte order mark", () => {
    expect(parseCsv("﻿Date,Amount\n01/11/2026,-1.00")).toEqual([
      ["Date", "Amount"],
      ["01/11/2026", "-1.00"],
    ]);
  });

  it("drops blank lines, including the trailing newline", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,,c\n,,")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });

  it("returns no rows for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("﻿")).toEqual([]);
  });
});

describe("mapRows", () => {
  const mapping = { date: 0, amount: 1, name: 2, dateFormat: "DD/MM/YYYY" } as const;

  it("converts a DD/MM/YYYY date and a negative amount into pence", () => {
    const { ok, errors } = mapRows([["05/11/2026", "-12.50", "Tesco"]], mapping);
    expect(errors).toEqual([]);
    expect(ok).toEqual([{ row: 1, date: "2026-11-05", amountPence: 1250, name: "Tesco" }]);
  });

  it("reads YYYY-MM-DD and MM/DD/YYYY dates", () => {
    expect(mapRows([["2026-11-05", "-1", "A"]], { ...mapping, dateFormat: "YYYY-MM-DD" }).ok[0].date).toBe("2026-11-05");
    expect(mapRows([["11/05/2026", "-1", "A"]], { ...mapping, dateFormat: "MM/DD/YYYY" }).ok[0].date).toBe("2026-11-05");
  });

  it("accepts single-digit days and months, dashes or dots, and a trailing time", () => {
    const { ok } = mapRows(
      [
        ["5/1/2026", "-1", "A"],
        ["05-01-2026", "-1", "B"],
        ["05.01.2026 14:32", "-1", "C"],
      ],
      mapping,
    );
    expect(ok.map((r) => r.date)).toEqual(["2026-01-05", "2026-01-05", "2026-01-05"]);
  });

  it("lists a bad date in errors with its row number", () => {
    const { ok, errors } = mapRows(
      [
        ["05/11/2026", "-1.00", "Tesco"],
        ["31/02/2026", "-2.00", "Boots"],
        ["yesterday", "-3.00", "Pret"],
      ],
      mapping,
    );
    expect(ok).toHaveLength(1);
    expect(errors).toEqual([
      { row: 2, reason: "Date “31/02/2026” isn’t a real DD/MM/YYYY date" },
      { row: 3, reason: "Date “yesterday” isn’t a real DD/MM/YYYY date" },
    ]);
  });

  it("counts the header as row 1 when there is one", () => {
    const { ok, errors } = mapRows(
      [
        ["Date", "Amount", "Name"],
        ["05/11/2026", "-1.00", "Tesco"],
        ["bad", "-1.00", "Tesco"],
      ],
      { ...mapping, hasHeader: true },
    );
    expect(ok.map((r) => r.row)).toEqual([2]);
    expect(errors.map((e) => e.row)).toEqual([3]);
  });

  it("strips £, thousands commas, spaces and signs before parsing pence", () => {
    const { ok } = mapRows(
      [
        ["01/11/2026", "-£1,234.56", "A"],
        ["01/11/2026", "£-7.5", "B"],
        ["01/11/2026", " - 3 ", "C"],
        ["01/11/2026", "(4.20)", "D"],
        ["01/11/2026", "9.99-", "E"],
      ],
      mapping,
    );
    expect(ok.map((r) => r.amountPence)).toEqual([123456, 750, 300, 420, 999]);
  });

  it("skips money in (credits) with a note, by default the positive numbers", () => {
    const { ok, errors, skipped } = mapRows(
      [
        ["01/11/2026", "-5.00", "Coffee"],
        ["02/11/2026", "2500.00", "Salary"],
        ["03/11/2026", "+10.00", "Refund"],
      ],
      mapping,
    );
    expect(ok.map((r) => r.name)).toEqual(["Coffee"]);
    expect(errors).toEqual([]);
    expect(skipped).toEqual([
      { row: 2, reason: "Money in (credits aren’t imported)" },
      { row: 3, reason: "Money in (credits aren’t imported)" },
    ]);
  });

  it("treats positive numbers as spending when money out is positive", () => {
    const { ok, skipped } = mapRows(
      [
        ["01/11/2026", "5.00", "Coffee"],
        ["02/11/2026", "-20.00", "Refund"],
      ],
      { ...mapping, moneyOut: "positive" },
    );
    expect(ok.map((r) => [r.name, r.amountPence])).toEqual([["Coffee", 500]]);
    expect(skipped.map((s) => s.row)).toEqual([2]);
  });

  it("lists zero, unreadable and too-large amounts as errors", () => {
    const { ok, errors } = mapRows(
      [
        ["01/11/2026", "0.00", "A"],
        ["01/11/2026", "abc", "B"],
        ["01/11/2026", "", "C"],
        ["01/11/2026", "-1.234", "D"],
        ["01/11/2026", "-10000000.01", "E"],
      ],
      mapping,
    );
    expect(ok).toEqual([]);
    expect(errors).toEqual([
      { row: 1, reason: "Amount is £0.00" },
      { row: 2, reason: "Amount “abc” isn’t a number of pounds and pence" },
      { row: 3, reason: "Amount is missing" },
      { row: 4, reason: "Amount “-1.234” isn’t a number of pounds and pence" },
      { row: 5, reason: "Amount is over £10,000,000.00" },
    ]);
  });

  it("trims and collapses spaces in the name, cuts it to 100 characters, and refuses an empty one", () => {
    const long = "x".repeat(120);
    const { ok, errors } = mapRows(
      [
        ["01/11/2026", "-1", "  CARD   PAYMENT  TO TESCO "],
        ["01/11/2026", "-1", long],
        ["01/11/2026", "-1", "   "],
      ],
      mapping,
    );
    expect(ok.map((r) => r.name)).toEqual(["CARD PAYMENT TO TESCO", "x".repeat(100)]);
    expect(errors).toEqual([{ row: 3, reason: "Name is empty" }]);
  });

  it("lists a row that is missing a mapped column", () => {
    const { errors } = mapRows([["01/11/2026", "-1"]], mapping);
    expect(errors).toEqual([{ row: 1, reason: "Name is empty" }]);
  });

  it("lists dates outside the allowed range when today is given", () => {
    const { ok, errors } = mapRows(
      [
        ["01/11/2015", "-1", "Too old"],
        ["22/11/2027", "-1", "Too far ahead"],
        ["21/11/2016", "-1", "Just in"],
      ],
      mapping,
      "2026-11-21",
    );
    expect(ok.map((r) => r.name)).toEqual(["Just in"]);
    expect(errors).toEqual([
      { row: 1, reason: "Date 01/11/2015 is more than 10 years ago or over a year ahead" },
      { row: 2, reason: "Date 22/11/2027 is more than 10 years ago or over a year ahead" },
    ]);
  });
});

describe("findDuplicates", () => {
  const row = (over: Partial<ImportRow>): ImportRow => ({ row: 1, date: "2026-11-05", amountPence: 1250, name: "Tesco", ...over });

  it("flags a row with the same date, amount and name (any case, trimmed) as an existing expense", () => {
    const rows = [row({}), row({ name: "Boots" }), row({ amountPence: 1251 }), row({ date: "2026-11-06" })];
    const dupes = findDuplicates(rows, [{ date: "2026-11-05", amountPence: 1250, name: "  TESCO " }]);
    expect([...dupes]).toEqual([0]);
  });

  it("flags a repeat of an earlier row in the same file, but not the first", () => {
    const rows = [row({ row: 2 }), row({ row: 3, name: "tesco" }), row({ row: 4, name: "Pret" })];
    expect([...findDuplicates(rows, [])]).toEqual([1]);
  });

  it("flags nothing when nothing matches", () => {
    expect(findDuplicates([row({})], []).size).toBe(0);
  });
});

describe("limits", () => {
  it("refuses a file over 2 MB", () => {
    expect(MAX_FILE_BYTES).toBe(2 * 1024 * 1024);
    expect(importLimitError({ bytes: MAX_FILE_BYTES })).toBeNull();
    expect(importLimitError({ bytes: MAX_FILE_BYTES + 1 })).toBe("This file is over 2 MB. Split it into smaller files and import each one.");
  });

  it("refuses more than 5,000 data rows", () => {
    expect(MAX_IMPORT_ROWS).toBe(5000);
    expect(importLimitError({ dataRows: 5000 })).toBeNull();
    expect(importLimitError({ dataRows: 5001 })).toBe(
      "This file has more than 5,000 rows. Split it into smaller files and import each one.",
    );
  });

  it("refuses an empty file", () => {
    expect(importLimitError({ dataRows: 0 })).toBe("This file has no rows to import.");
  });

  it("readCsvFile refuses an oversized file before reading it", async () => {
    const big = new File(["x".repeat(MAX_FILE_BYTES + 1)], "big.csv", { type: "text/csv" });
    await expect(readCsvFile(big)).rejects.toThrow("over 2 MB");
  });

  it("readCsvFile parses a file's text", async () => {
    const file = new File(["﻿Date,Amount\r\n01/11/2026,-1.00\r\n"], "bank.csv", { type: "text/csv" });
    await expect(readCsvFile(file)).resolves.toEqual([
      ["Date", "Amount"],
      ["01/11/2026", "-1.00"],
    ]);
  });
});

describe("guesses", () => {
  it("spots a header row: no cell is a date or an amount", () => {
    expect(looksLikeHeader(["Date", "Description", "Amount"])).toBe(true);
    expect(looksLikeHeader(["05/11/2026", "Tesco", "-12.50"])).toBe(false);
  });

  it("guesses the date, amount and name columns from header names", () => {
    expect(guessColumns(["Transaction Date", "Type", "Description", "Paid out", "Balance"])).toEqual({ date: 0, amount: null, name: 2 });
    expect(guessColumns(["date", "Merchant", "AMOUNT"])).toEqual({ date: 0, amount: 2, name: 1 });
    expect(guessColumns(["When", "Payee", "Value (£)"])).toEqual({ date: null, amount: 2, name: 1 });
  });

  it("guesses the date format from sample values, preferring DD/MM/YYYY when either fits", () => {
    expect(guessDateFormat(["05/11/2026", "06/11/2026"])).toBe("DD/MM/YYYY");
    expect(guessDateFormat(["2026-11-05"])).toBe("YYYY-MM-DD");
    expect(guessDateFormat(["11/25/2026", "11/05/2026"])).toBe("MM/DD/YYYY");
    expect(guessDateFormat(["25/11/2026", "05/11/2026"])).toBe("DD/MM/YYYY");
  });
});

describe("guessMapping", () => {
  it("reads a header file: columns by name, date format from the data rows", () => {
    expect(
      guessMapping([
        ["Date", "Description", "Amount", "Balance"],
        ["11/25/2026", "TESCO", "-12.50", "100.00"],
      ]),
    ).toEqual({ hasHeader: true, date: 0, amount: 2, name: 1, dateFormat: "MM/DD/YYYY" });
  });

  it("reads a file without a header by its values: the first date, amount and text columns", () => {
    expect(guessMapping([["Card", "2026-11-05", "TESCO", "-12.50"]])).toEqual({
      hasHeader: false,
      date: 1,
      amount: 3,
      name: 0,
      dateFormat: "YYYY-MM-DD",
    });
  });

  it("falls back to the values when a header name doesn't say", () => {
    expect(
      guessMapping([
        ["When", "Who", "Paid out"],
        ["05/11/2026", "TESCO", "12.50"],
      ]),
    ).toEqual({ hasHeader: true, date: 0, amount: 2, name: 1, dateFormat: "DD/MM/YYYY" });
  });

  it("leaves columns unset when nothing fits", () => {
    expect(guessMapping([])).toEqual({ hasHeader: false, date: null, amount: null, name: null, dateFormat: "DD/MM/YYYY" });
  });
});
