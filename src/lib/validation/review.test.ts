import { describe, expect, it } from "vitest";
import { validateLeftoverChoice, validateRaise } from "./review";

const ID = "6f1c2e2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("validateLeftoverChoice", () => {
  it("accepts next period and keep unassigned, dropping anything else sent (an amount included)", () => {
    expect(validateLeftoverChoice({ destination: "next_period", amountPence: 999 })).toEqual({
      ok: true,
      choice: { destination: "next_period" },
    });
    expect(validateLeftoverChoice({ destination: "unassigned" })).toEqual({ ok: true, choice: { destination: "unassigned" } });
  });
  it("accepts null: nothing left over", () => {
    expect(validateLeftoverChoice(null)).toEqual({ ok: true, choice: null });
  });
  it("accepts a fund by id, or a new fund by trimmed name", () => {
    expect(validateLeftoverChoice({ destination: "fund", fundId: ID })).toEqual({ ok: true, choice: { destination: "fund", fundId: ID } });
    expect(validateLeftoverChoice({ destination: "fund", newFundName: "  Rainy day " })).toEqual({
      ok: true,
      choice: { destination: "fund", newFundName: "Rainy day" },
    });
  });
  it("refuses an unknown destination, a fund without a valid id, and a blank or long new name", () => {
    expect(validateLeftoverChoice({ destination: "spend" }).ok).toBe(false);
    expect(validateLeftoverChoice(undefined).ok).toBe(false);
    expect(validateLeftoverChoice({ destination: "fund", fundId: "x" }).ok).toBe(false);
    expect(validateLeftoverChoice({ destination: "fund", newFundName: "  " })).toEqual({ ok: false, error: "Give every fund a name." });
    expect(validateLeftoverChoice({ destination: "fund", newFundName: "a".repeat(51) }).ok).toBe(false);
  });
});

describe("validateRaise", () => {
  it("needs a category id and an amount of at least 1p", () => {
    expect(validateRaise(ID, 42100)).toEqual({ ok: true });
    expect(validateRaise("nope", 42100).ok).toBe(false);
    expect(validateRaise(ID, 0).ok).toBe(false);
    expect(validateRaise(ID, 10.5).ok).toBe(false);
  });
});
