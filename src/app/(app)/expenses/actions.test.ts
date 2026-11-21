import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveExpense, deleteTransaction, redirect, getUserId } = vi.hoisted(() => ({
  saveExpense: vi.fn(),
  deleteTransaction: vi.fn(),
  getUserId: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/transactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/transactions")>()),
  saveExpense,
  deleteTransaction,
}));

import { NameTakenError } from "@/lib/data/budgetEdit";
import { MissingReferenceError, TransactionNotFoundError } from "@/lib/data/transactions";
import { deleteExpenseAction, saveExpenseAction } from "./actions";

const GROCERIES = "11111111-1111-4111-8111-111111111111";
const TXN = "22222222-2222-4222-8222-222222222222";
const valid = { name: " Tesco ", amountPence: 1250, date: "2026-11-21", category: { id: GROCERIES }, fundId: null, accountLabel: "", notes: "" };
const checked = { name: "Tesco", amountPence: 1250, date: "2026-11-21", category: { id: GROCERIES }, fundId: null };

describe("saveExpenseAction", () => {
  beforeEach(() => {
    saveExpense.mockReset().mockResolvedValue(TXN);
    getUserId.mockReset().mockResolvedValue("user-1");
  });

  it("saves the checked expense, then returns to returnTo", async () => {
    await expect(saveExpenseAction({ returnTo: "/budget/abc" }, valid)).rejects.toThrow("NEXT_REDIRECT:/budget/abc");
    expect(saveExpense).toHaveBeenCalledWith({}, null, checked);
  });

  it.each([undefined, "", "https://evil.test", "//evil.test", "/\\evil.test", "budget"])(
    "returns to /expenses when returnTo is %s",
    async (returnTo) => {
      await expect(saveExpenseAction({ returnTo }, valid)).rejects.toThrow("NEXT_REDIRECT:/expenses");
    },
  );

  it("updates the expense being edited", async () => {
    await expect(saveExpenseAction({ id: TXN }, valid)).rejects.toThrow("NEXT_REDIRECT:/expenses");
    expect(saveExpense).toHaveBeenCalledWith({}, TXN, checked);
  });

  it("refuses a malformed expense id", async () => {
    expect(await saveExpenseAction({ id: "x" }, valid)).toEqual({ error: expect.any(String) });
    expect(saveExpense).not.toHaveBeenCalled();
  });

  it("returns the first problem with its field and saves nothing", async () => {
    expect(await saveExpenseAction({}, { ...valid, amountPence: 0 })).toEqual({ error: expect.any(String), field: "amount" });
    expect(saveExpense).not.toHaveBeenCalled();
  });

  it("refuses a date outside 10 years back to a year ahead of the server's today", async () => {
    expect(await saveExpenseAction({}, { ...valid, date: "2027-11-22" })).toEqual({ error: expect.any(String), field: "date" });
    expect(await saveExpenseAction({}, { ...valid, date: "2016-11-20" })).toEqual({ error: expect.any(String), field: "date" });
    expect(saveExpense).not.toHaveBeenCalled();
  });

  it.each([
    ["a tab", "/\t/evil.test"],
    ["a newline", "/\n/evil.test"],
    ["a non-string", 42],
  ])("returns to /expenses when returnTo hides another site behind %s", async (_, returnTo) => {
    await expect(saveExpenseAction({ returnTo } as never, valid)).rejects.toThrow("NEXT_REDIRECT:/expenses");
  });

  it("sends signed-out callers to /login without saving", async () => {
    getUserId.mockResolvedValue(null);
    await expect(saveExpenseAction({}, valid)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(saveExpense).not.toHaveBeenCalled();
  });

  it("returns a taken category name on the new-category field", async () => {
    saveExpense.mockRejectedValue(new NameTakenError("Gifts"));
    expect(await saveExpenseAction({}, { ...valid, category: { name: "gifts", kind: "want" } })).toEqual({
      error: "You already have a category called Gifts.",
      field: "newCategory",
    });
  });

  it("asks for a reload when a category, fund or the expense has gone", async () => {
    saveExpense.mockRejectedValue(new MissingReferenceError());
    expect(await saveExpenseAction({}, valid)).toEqual({ error: new MissingReferenceError().message });
    saveExpense.mockRejectedValue(new TransactionNotFoundError());
    expect(await saveExpenseAction({ id: TXN }, valid)).toEqual({ error: new TransactionNotFoundError().message });
  });

  it("explains an unexpected failure without losing the form", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    saveExpense.mockRejectedValue(new Error("network"));
    expect(await saveExpenseAction({}, valid)).toEqual({ error: expect.stringMatching(/couldn't save/i) });
  });
});

describe("deleteExpenseAction", () => {
  beforeEach(() => {
    deleteTransaction.mockReset().mockResolvedValue(undefined);
    getUserId.mockReset().mockResolvedValue("user-1");
  });

  it("deletes the expense, then returns to returnTo", async () => {
    await expect(deleteExpenseAction({ id: TXN, returnTo: "/budget" })).rejects.toThrow("NEXT_REDIRECT:/budget");
    expect(deleteTransaction).toHaveBeenCalledWith({}, TXN);
  });

  it("refuses a malformed id", async () => {
    expect(await deleteExpenseAction({ id: "x" })).toEqual({ error: expect.any(String) });
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it("an expense already gone asks for a reload", async () => {
    deleteTransaction.mockRejectedValue(new TransactionNotFoundError());
    expect(await deleteExpenseAction({ id: TXN })).toEqual({ error: new TransactionNotFoundError().message });
  });
});
