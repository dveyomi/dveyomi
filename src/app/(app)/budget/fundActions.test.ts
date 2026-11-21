import { beforeEach, describe, expect, it, vi } from "vitest";

const { confirmSavingsSplit, createFund, updateFund, addFundMovement, redirect, getUserId, revalidatePath } = vi.hoisted(() => ({
  confirmSavingsSplit: vi.fn(),
  createFund: vi.fn(),
  updateFund: vi.fn(),
  addFundMovement: vi.fn(),
  getUserId: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("@/lib/data/funds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/funds")>()),
  confirmSavingsSplit,
  createFund,
  updateFund,
  addFundMovement,
}));

import {
  FundNameTakenError,
  FundNotFoundError,
  InsufficientFundsError,
  SavingsAlreadyMovedError,
  SplitTotalError,
} from "@/lib/data/funds";
import { addFundMovementAction, confirmSavingsAction, saveFundAction } from "./fundActions";

const PERIOD = "33333333-3333-4333-8333-333333333333";
const FUND = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  for (const f of [confirmSavingsSplit, createFund, updateFund, addFundMovement, revalidatePath]) f.mockReset();
  getUserId.mockReset().mockResolvedValue("user-1");
});

describe("confirmSavingsAction", () => {
  it("confirms the checked split dated the server's today and refreshes", async () => {
    expect(await confirmSavingsAction(PERIOD, [{ fundId: FUND, amountPence: 30000 }])).toEqual({});
    expect(confirmSavingsSplit).toHaveBeenCalledWith({}, PERIOD, [{ fundId: FUND, amountPence: 30000 }], "2026-11-21");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("sends a signed-out user to log in", async () => {
    getUserId.mockResolvedValue(null);
    await expect(confirmSavingsAction(PERIOD, [])).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("refuses a malformed period or split without calling the database", async () => {
    expect(await confirmSavingsAction("x", [{ fundId: FUND, amountPence: 1 }])).toEqual({ error: expect.any(String) });
    expect(await confirmSavingsAction(PERIOD, [{ fundId: FUND, amountPence: -1 }])).toEqual({ error: expect.any(String) });
    expect(confirmSavingsSplit).not.toHaveBeenCalled();
  });

  it.each([new SplitTotalError(), new SavingsAlreadyMovedError(), new FundNotFoundError(), new FundNameTakenError()])(
    "returns %s's message",
    async (e) => {
      confirmSavingsSplit.mockRejectedValue(e);
      expect(await confirmSavingsAction(PERIOD, [{ fundId: FUND, amountPence: 1 }])).toEqual({ error: e.message });
    },
  );

  it("hides an unexpected failure behind a retry message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    confirmSavingsSplit.mockRejectedValue(new Error("boom"));
    expect(await confirmSavingsAction(PERIOD, [{ fundId: FUND, amountPence: 1 }])).toEqual({
      error: expect.stringContaining("try again"),
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("saveFundAction", () => {
  it("creates a fund when no id is given", async () => {
    expect(await saveFundAction(null, { name: " Car ", targetPence: 500000, targetDate: "" })).toEqual({});
    expect(createFund).toHaveBeenCalledWith({}, { name: "Car", targetPence: 500000, targetDate: null });
  });

  it("updates the fund given", async () => {
    expect(await saveFundAction(FUND, { name: "Car", targetPence: 0, targetDate: "2027-01-31" })).toEqual({});
    expect(updateFund).toHaveBeenCalledWith({}, FUND, { name: "Car", targetPence: null, targetDate: "2027-01-31" });
  });

  it("returns the field of a problem", async () => {
    expect(await saveFundAction(null, { name: "" })).toEqual({ error: expect.any(String), field: "name" });
    createFund.mockRejectedValue(new FundNameTakenError("Car"));
    expect(await saveFundAction(null, { name: "Car" })).toEqual({ error: "You already have a fund called Car.", field: "name" });
  });

  it("refuses a malformed id", async () => {
    expect(await saveFundAction("x", { name: "Car" })).toEqual({ error: expect.any(String) });
    expect(updateFund).not.toHaveBeenCalled();
  });
});

describe("addFundMovementAction", () => {
  it("records the checked movement", async () => {
    const raw = { kind: "withdrawal", amountPence: 5000, date: "2026-11-21", note: "" };
    expect(await addFundMovementAction(FUND, raw)).toEqual({});
    expect(addFundMovement).toHaveBeenCalledWith({}, FUND, { kind: "withdrawal", amountPence: 5000, date: "2026-11-21", note: null });
  });

  it("refuses a future date with its field", async () => {
    expect(await addFundMovementAction(FUND, { kind: "contribution", amountPence: 5000, date: "2026-11-22" })).toEqual({
      error: expect.any(String),
      field: "date",
    });
  });

  it("says how much the fund holds when a withdrawal is too large", async () => {
    addFundMovement.mockRejectedValue(new InsufficientFundsError(10000));
    expect(await addFundMovementAction(FUND, { kind: "withdrawal", amountPence: 20000, date: "2026-11-21" })).toEqual({
      error: "You can't withdraw more than the fund holds (£100.00).",
      field: "amount",
    });
  });
});
