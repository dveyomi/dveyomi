import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveBudget, redirect, getUserId } = vi.hoisted(() => ({
  saveBudget: vi.fn(),
  getUserId: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/budgetEdit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/budgetEdit")>()),
  saveBudget,
}));

import { NameTakenError } from "@/lib/data/budgetEdit";
import { saveBudgetAction } from "./actions";

const RENT = "11111111-1111-4111-8111-111111111111";
const valid = {
  incomePence: 300000,
  savingsPence: 50000,
  scope: "this" as const,
  categories: [
    { id: RENT, name: " Rent ", kind: "need" as const, amountPence: 150000 },
    { name: "Gym", kind: "want" as const, amountPence: 0 },
  ],
};

describe("saveBudgetAction", () => {
  beforeEach(() => {
    saveBudget.mockReset().mockResolvedValue(undefined);
    getUserId.mockReset().mockResolvedValue("user-1");
  });

  it("saves the checked edit (names trimmed) for the server's today, then confirms on /budget", async () => {
    await expect(saveBudgetAction(valid)).rejects.toThrow("NEXT_REDIRECT:/budget?saved=1");
    expect(saveBudget).toHaveBeenCalledWith({}, "2026-11-21", {
      ...valid,
      categories: [{ ...valid.categories[0], name: "Rent" }, valid.categories[1]],
    });
  });

  it.each([
    ["savings over income", { savingsPence: 300001 }],
    ["no income", { incomePence: 0 }],
    ["a bad scope", { scope: "past" }],
    ["a duplicate name, ignoring case", { categories: [...valid.categories, { name: "rent", kind: "need", amountPence: 1 }] }],
    ["a name over 50 characters", { categories: [{ name: "x".repeat(51), kind: "need", amountPence: 1 }] }],
    ["an amount over £10m", { categories: [{ name: "Rent", kind: "need", amountPence: 1_000_000_001 }] }],
    ["a fractional amount", { categories: [{ name: "Rent", kind: "need", amountPence: 1.5 }] }],
    ["a malformed id", { categories: [{ id: "x", name: "Rent", kind: "need", amountPence: 1 }] }],
    [
      "51 categories",
      { categories: Array.from({ length: 51 }, (_, i) => ({ name: `C${i}`, kind: "need", amountPence: 1 })) },
    ],
  ])("refuses %s and saves nothing", async (_, over) => {
    expect(await saveBudgetAction({ ...valid, ...over })).toEqual({ error: expect.any(String) });
    expect(saveBudget).not.toHaveBeenCalled();
  });

  it("sends signed-out callers to /login without saving", async () => {
    getUserId.mockResolvedValue(null);
    await expect(saveBudgetAction(valid)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(saveBudget).not.toHaveBeenCalled();
  });

  it("returns a taken name as a message", async () => {
    saveBudget.mockRejectedValue(new NameTakenError());
    expect(await saveBudgetAction(valid)).toEqual({ error: "Another category already has that name." });
  });
});
