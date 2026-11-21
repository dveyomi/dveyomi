import { describe, expect, it } from "vitest";
import { validateOnboarding, type OnboardingInput } from "./onboarding";

function input(over: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    incomePence: 600000,
    startDay: 25,
    savingsPence: 50000,
    categories: [
      { name: "Rent", kind: "need", amountPence: 150000 },
      { name: "Eating out", kind: "want", amountPence: 20000 },
    ],
    funds: [{ name: "Holiday", amountPence: 50000, alreadySavedPence: 20000 }],
    ...over,
  };
}

const error = (raw: unknown) => {
  const r = validateOnboarding(raw);
  return r.ok ? null : r.error;
};

describe("validateOnboarding", () => {
  it("accepts a complete setup and trims names", () => {
    const r = validateOnboarding(input({ categories: [{ name: "  Rent ", kind: "need", amountPence: 1 }] }));
    expect(r).toEqual({ ok: true, input: input({ categories: [{ name: "Rent", kind: "need", amountPence: 1 }] }) });
  });

  it("rejects anything that is not an onboarding object", () => {
    expect(error(null)).toBeTruthy();
    expect(error("x")).toBeTruthy();
    expect(error({ ...input(), categories: "Rent" })).toBeTruthy();
  });

  it.each([0, -1, 10.5, Number.NaN, "600000"])("rejects income %s", (incomePence) => {
    expect(error({ ...input(), incomePence })).toMatch(/income/i);
  });

  it.each([0, 32, 1.5])("rejects start day %s", (startDay) => {
    expect(error(input({ startDay }))).toMatch(/start day/i);
  });

  it("accepts start days 1 and 31", () => {
    expect(error(input({ startDay: 1 }))).toBeNull();
    expect(error(input({ startDay: 31 }))).toBeNull();
  });

  it("rejects negative or fractional savings, and savings above income", () => {
    expect(error(input({ savingsPence: -1 }))).toMatch(/savings/i);
    expect(error(input({ savingsPence: 0.5 }))).toMatch(/savings/i);
    expect(error(input({ savingsPence: 600001, funds: [{ name: "A", amountPence: 600001, alreadySavedPence: 0 }] }))).toMatch(
      /savings/i,
    );
  });

  it("needs at least one category", () => {
    expect(error(input({ categories: [] }))).toMatch(/category/i);
  });

  it("rejects a blank category name, a bad kind or an amount that is not positive pence", () => {
    expect(error(input({ categories: [{ name: "  ", kind: "need", amountPence: 100 }] }))).toMatch(/name/i);
    expect(error({ ...input(), categories: [{ name: "Rent", kind: "other", amountPence: 100 }] })).toMatch(/need or a want/i);
    expect(error(input({ categories: [{ name: "Rent", kind: "need", amountPence: 0 }] }))).toMatch(/amount/i);
    expect(error(input({ categories: [{ name: "Rent", kind: "need", amountPence: 1.5 }] }))).toMatch(/amount/i);
  });

  it("rejects category names that differ only in case", () => {
    const categories = [
      { name: "Rent", kind: "need" as const, amountPence: 100 },
      { name: "rent ", kind: "want" as const, amountPence: 100 },
    ];
    expect(error(input({ categories }))).toMatch(/already/i);
  });

  it("with savings, needs a fund and fund amounts that add up to the savings", () => {
    expect(error(input({ funds: [] }))).toMatch(/fund/i);
    expect(error(input({ funds: [{ name: "Holiday", amountPence: 40000, alreadySavedPence: 0 }] }))).toMatch(/add up/i);
  });

  it("with no savings, funds are optional and their monthly amounts must be zero", () => {
    expect(error(input({ savingsPence: 0, funds: [] }))).toBeNull();
    expect(error(input({ savingsPence: 0, funds: [{ name: "Rainy day", amountPence: 0, alreadySavedPence: 90000 }] }))).toBeNull();
    expect(error(input({ savingsPence: 0, funds: [{ name: "Rainy day", amountPence: 100, alreadySavedPence: 0 }] }))).toMatch(
      /add up/i,
    );
  });

  it("rejects a blank or duplicate fund name and a negative already-saved amount", () => {
    expect(error(input({ funds: [{ name: " ", amountPence: 50000, alreadySavedPence: 0 }] }))).toMatch(/name/i);
    expect(
      error(
        input({
          funds: [
            { name: "Holiday", amountPence: 25000, alreadySavedPence: 0 },
            { name: "HOLIDAY", amountPence: 25000, alreadySavedPence: 0 },
          ],
        }),
      ),
    ).toMatch(/already/i);
    expect(error(input({ funds: [{ name: "Holiday", amountPence: 50000, alreadySavedPence: -5 }] }))).toMatch(/already saved/i);
  });
});
