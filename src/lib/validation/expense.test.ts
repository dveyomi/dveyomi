import { describe, expect, it } from "vitest";
import { isIsoDate, validateExpense } from "./expense";

const GROCERIES = "11111111-1111-4111-8111-111111111111";
const HOLIDAY = "22222222-2222-4222-8222-222222222222";
const valid = {
  name: " Tesco ",
  amountPence: 1250,
  date: "2026-11-21",
  category: { id: GROCERIES },
  fundId: null,
  accountLabel: "",
  notes: "  ",
};

describe("isIsoDate", () => {
  it("accepts real calendar dates as YYYY-MM-DD", () => {
    expect(isIsoDate("2026-11-21")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-1-01", "21/11/2026", "", "2026-11-21T00:00:00Z", null, 20261121])(
    "refuses %s",
    (v) => {
      expect(isIsoDate(v)).toBe(false);
    },
  );
});

describe("validateExpense", () => {
  it("trims the name and drops empty optional text", () => {
    expect(validateExpense(valid)).toEqual({
      ok: true,
      input: { name: "Tesco", amountPence: 1250, date: "2026-11-21", category: { id: GROCERIES }, fundId: null },
    });
  });

  it("keeps a fund, an account label and notes (trimmed)", () => {
    const checked = validateExpense({ ...valid, fundId: HOLIDAY, accountLabel: " Monzo ", notes: " Flights " });
    expect(checked).toMatchObject({ ok: true, input: { fundId: HOLIDAY, accountLabel: "Monzo", notes: "Flights" } });
  });

  it("accepts a new category by name and kind (trimmed)", () => {
    const checked = validateExpense({ ...valid, category: { name: " Gifts ", kind: "want" } });
    expect(checked).toMatchObject({ ok: true, input: { category: { name: "Gifts", kind: "want" } } });
  });

  it.each([
    ["no amount", { amountPence: Number.NaN }, "amount"],
    ["a zero amount", { amountPence: 0 }, "amount"],
    ["a fractional amount", { amountPence: 12.5 }, "amount"],
    ["an amount over £10m", { amountPence: 1_000_000_001 }, "amount"],
    ["an empty name", { name: "   " }, "name"],
    ["a name over 100 characters", { name: "x".repeat(101) }, "name"],
    ["no category", { category: null }, "category"],
    ["a malformed category id", { category: { id: "x" } }, "category"],
    ["a new category with no name", { category: { name: " ", kind: "need" } }, "newCategory"],
    ["a new category name over 50 characters", { category: { name: "x".repeat(51), kind: "need" } }, "newCategory"],
    ["a new category with no kind", { category: { name: "Gifts" } }, "newCategory"],
    ["an invalid date", { date: "2026-02-30" }, "date"],
    ["a malformed fund id", { fundId: "x" }, "fund"],
    ["an account label over 50 characters", { accountLabel: "x".repeat(51) }, "accountLabel"],
    ["notes over 500 characters", { notes: "x".repeat(501) }, "notes"],
  ])("refuses %s, naming the field", (_, over, field) => {
    const checked = validateExpense({ ...valid, ...over });
    expect(checked).toEqual({ ok: false, error: expect.any(String), field });
  });

  it("refuses something that isn't an expense", () => {
    expect(validateExpense(null)).toEqual({ ok: false, error: expect.any(String) });
  });
});
