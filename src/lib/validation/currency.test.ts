import { describe, expect, it } from "vitest";
import { makeI18n } from "@/i18n/format";
import { validateBudgetEdit } from "./budgetEdit";
import { isAmount } from "./common";

const twd = makeI18n("en-GB", "TWD");
const input = (incomePence: number) => ({ incomePence, savingsPence: 0, scope: "this", categories: [] });

describe("amounts checked in the chosen currency", () => {
  it("TWD amounts must be whole dollars", () => {
    expect(isAmount(125000, 1, "TWD")).toBe(true);
    expect(isAmount(12550, 1, "TWD")).toBe(false);
    expect(isAmount(50, 1, "TWD")).toBe(false);
    expect(isAmount(12550, 1, "GBP")).toBe(true);
  });

  it("refuses a TWD income with cents, naming the range in NT$", () => {
    const r = validateBudgetEdit(input(12550), twd);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("Enter a monthly income between NT$1 and NT$10,000,000.");
  });

  it("the same income in GBP is fine", () => {
    expect(validateBudgetEdit(input(12550)).ok).toBe(true);
  });
});
