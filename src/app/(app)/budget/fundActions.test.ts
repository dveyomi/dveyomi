import { beforeEach, describe, expect, it, vi } from "vitest";

const { confirmSavingsSplit, createFund, updateFund, addFundMovement, withdrawFromFund, moveBetweenFunds, redirect, getUserId, revalidatePath } = vi.hoisted(() => ({
  withdrawFromFund: vi.fn(),
  moveBetweenFunds: vi.fn(),
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
  withdrawFromFund,
  moveBetweenFunds,
}));

import {
  FundNameTakenError,
  FundNotFoundError,
  InsufficientFundsError,
  SameFundError,
  SavingsAlreadyMovedError,
  SplitTotalError,
} from "@/lib/data/funds";
import { addFundMovementAction, confirmSavingsAction, moveBetweenFundsAction, saveFundAction, withdrawFromFundAction } from "./fundActions";

const PERIOD = "33333333-3333-4333-8333-333333333333";
const FUND = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  for (const f of [confirmSavingsSplit, createFund, updateFund, addFundMovement, withdrawFromFund, moveBetweenFunds, revalidatePath]) f.mockReset();
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

const OTHER = "22222222-2222-4222-8222-222222222222";

describe("withdrawFromFundAction", () => {
  it("withdraws into this month's spending money, dated as checked, and refreshes", async () => {
    const raw = { amountPence: 10000, date: "2026-11-21", note: " Car ", destination: "spending" };
    expect(await withdrawFromFundAction(FUND, raw)).toEqual({});
    expect(withdrawFromFund).toHaveBeenCalledWith(
      {},
      "2026-11-21",
      FUND,
      { kind: "withdrawal", amountPence: 10000, date: "2026-11-21", note: "Car" },
      "spending",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("just takes it out", async () => {
    expect(await withdrawFromFundAction(FUND, { amountPence: 100, date: "2026-11-21", destination: "out" })).toEqual({});
    expect(withdrawFromFund).toHaveBeenCalledWith({}, "2026-11-21", FUND, expect.anything(), "out");
  });

  it("refuses an unknown destination, fund or amount without calling the database", async () => {
    expect(await withdrawFromFundAction(FUND, { amountPence: 100, date: "2026-11-21", destination: "bank" })).toEqual({ error: expect.any(String) });
    expect(await withdrawFromFundAction("x", { amountPence: 100, date: "2026-11-21", destination: "out" })).toEqual({ error: expect.any(String) });
    expect(await withdrawFromFundAction(FUND, { amountPence: 0, date: "2026-11-21", destination: "out" })).toEqual({
      error: expect.any(String),
      field: "amount",
    });
    expect(withdrawFromFund).not.toHaveBeenCalled();
  });

  it("puts a refusal for the balance on the amount", async () => {
    withdrawFromFund.mockRejectedValue(new InsufficientFundsError(10000));
    expect(await withdrawFromFundAction(FUND, { amountPence: 20000, date: "2026-11-21", destination: "spending" })).toEqual({
      error: "You can't withdraw more than the fund holds (£100.00).",
      field: "amount",
    });
  });

  it("sends a signed-out user to log in", async () => {
    getUserId.mockResolvedValue(null);
    await expect(withdrawFromFundAction(FUND, {})).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

describe("moveBetweenFundsAction", () => {
  it("moves the checked amount and refreshes", async () => {
    expect(await moveBetweenFundsAction(FUND, OTHER, { amountPence: 5000, date: "2026-11-21", note: "" })).toEqual({});
    expect(moveBetweenFunds).toHaveBeenCalledWith({}, FUND, OTHER, { amountPence: 5000, date: "2026-11-21", note: null });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuses a malformed fund or amount without calling the database", async () => {
    expect(await moveBetweenFundsAction(FUND, "x", { amountPence: 5000, date: "2026-11-21" })).toEqual({ error: expect.any(String) });
    expect(await moveBetweenFundsAction(FUND, OTHER, { amountPence: -1, date: "2026-11-21" })).toEqual({
      error: expect.any(String),
      field: "amount",
    });
    expect(moveBetweenFunds).not.toHaveBeenCalled();
  });

  it("explains each refusal", async () => {
    moveBetweenFunds.mockRejectedValueOnce(new InsufficientFundsError(23000));
    expect(await moveBetweenFundsAction(FUND, OTHER, { amountPence: 50000, date: "2026-11-21" })).toEqual({
      error: "You can't move more than this fund holds (£230.00).",
      field: "amount",
    });
    moveBetweenFunds.mockRejectedValueOnce(new SameFundError());
    expect(await moveBetweenFundsAction(FUND, FUND, { amountPence: 100, date: "2026-11-21" })).toEqual({
      error: "Choose a different fund to move the money to.",
      field: "to",
    });
    moveBetweenFunds.mockRejectedValueOnce(new FundNotFoundError());
    expect(await moveBetweenFundsAction(FUND, OTHER, { amountPence: 100, date: "2026-11-21" })).toEqual({
      error: "That fund wasn't found. Reload the page and try again.",
    });
  });
});
