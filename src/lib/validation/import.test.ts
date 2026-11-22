import { describe, expect, it } from "vitest";
import { validateDuplicateCheck, validateImport } from "./import";

const TODAY = "2026-11-21";
const CAT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const good = { row: 2, date: "2026-11-05", amountPence: 1250, name: "Tesco" };
const input = (over: Record<string, unknown> = {}) => ({ filename: "bank.csv", categoryId: CAT, rows: [good], ...over });

describe("validateImport", () => {
  it("accepts a file name, a default category and rows, trimming names", () => {
    expect(validateImport(input({ filename: "  bank.csv ", rows: [{ ...good, name: "  Tesco ", categoryId: OTHER }, good] }), TODAY)).toEqual({
      ok: true,
      input: {
        filename: "bank.csv",
        categoryId: CAT,
        rows: [
          { row: 2, date: "2026-11-05", amountPence: 1250, name: "Tesco", categoryId: OTHER },
          { row: 2, date: "2026-11-05", amountPence: 1250, name: "Tesco" },
        ],
      },
    });
  });

  it("refuses anything out of bounds", () => {
    const bad: Record<string, unknown>[] = [
      { filename: "" },
      { filename: "x".repeat(256) },
      { categoryId: "nope" },
      { rows: [] },
      { rows: "x" },
      { rows: Array.from({ length: 5001 }, () => good) },
      { rows: [{ ...good, name: " " }] },
      { rows: [{ ...good, name: "x".repeat(101) }] },
      { rows: [{ ...good, amountPence: 0 }] },
      { rows: [{ ...good, amountPence: 12.5 }] },
      { rows: [{ ...good, amountPence: 1_000_000_001 }] },
      { rows: [{ ...good, date: "2026-02-31" }] },
      { rows: [{ ...good, date: "2015-11-20" }] },
      { rows: [{ ...good, date: "2027-11-22" }] },
      { rows: [{ ...good, categoryId: "nope" }] },
      { rows: [null] },
    ];
    for (const over of bad) expect(validateImport(input(over), TODAY).ok, JSON.stringify(over).slice(0, 60)).toBe(false);
    expect(validateImport(null, TODAY).ok).toBe(false);
  });

  it("names the row of a bad row", () => {
    expect(validateImport(input({ rows: [good, { ...good, row: 7, amountPence: -1 }] }), TODAY)).toEqual({
      ok: false,
      error: "Row 7 can't be imported. Go back to the preview and check it.",
    });
  });
});

describe("validateDuplicateCheck", () => {
  it("accepts up to 5,000 dated rows with amounts and names", () => {
    expect(validateDuplicateCheck([good], TODAY)).toEqual([good]);
    expect(validateDuplicateCheck([], TODAY)).toEqual([]);
  });

  it("refuses malformed or too many rows", () => {
    expect(validateDuplicateCheck("x", TODAY)).toBeNull();
    expect(validateDuplicateCheck([{ ...good, date: "x" }], TODAY)).toBeNull();
    expect(validateDuplicateCheck([{ ...good, name: 3 }], TODAY)).toBeNull();
    expect(validateDuplicateCheck(Array.from({ length: 5001 }, () => good), TODAY)).toBeNull();
  });

  it("refuses dates outside the expense date range, like the import itself", () => {
    expect(validateDuplicateCheck([{ ...good, date: "2016-11-20" }], TODAY)).toBeNull();
    expect(validateDuplicateCheck([{ ...good, date: "2027-11-22" }], TODAY)).toBeNull();
    expect(validateDuplicateCheck([{ ...good, date: "2016-11-21" }], TODAY)).toEqual([{ ...good, date: "2016-11-21" }]);
  });
});

describe("a full import fits the server action body limit", () => {
  it("5,000 rows with long names stay under 2 MB as JSON and validate", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ row: i + 2, date: "2026-11-05", amountPence: 1250, name: "N".repeat(100), categoryId: CAT }));
    const body = JSON.stringify([input({ rows })]);
    expect(new TextEncoder().encode(body).length).toBeLessThan(2 * 1024 * 1024);
    expect(validateImport(input({ rows }), TODAY).ok).toBe(true);
  });
});
