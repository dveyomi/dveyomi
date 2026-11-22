import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordLeftover, raiseBudget, dismissUnassignedNudge, redirect, getUserId } = vi.hoisted(() => ({
  recordLeftover: vi.fn(),
  raiseBudget: vi.fn(),
  dismissUnassignedNudge: vi.fn(),
  getUserId: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/review")>()),
  recordLeftover,
  raiseBudget,
  dismissUnassignedNudge,
}));

import { FundShortError } from "@/lib/data/funds";
import { AlreadyReviewedError, OverspendChoiceError, RaiseRefusedError } from "@/lib/data/review";
import { applyRaiseAction, dismissNudgeAction, recordLeftoverAction } from "./actions";

const PERIOD = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  for (const f of [recordLeftover, raiseBudget, dismissUnassignedNudge]) f.mockReset().mockResolvedValue(undefined);
  getUserId.mockReset().mockResolvedValue("user-1");
  redirect.mockClear();
});

describe("recordLeftoverAction", () => {
  it("records the checked choice for the server's today, ignoring any amount sent, then confirms on /budget", async () => {
    await expect(recordLeftoverAction(PERIOD, { destination: "unassigned", amountPence: 99999999 })).rejects.toThrow(
      "NEXT_REDIRECT:/budget?reviewed=1",
    );
    expect(recordLeftover).toHaveBeenCalledWith({}, "2026-11-21", PERIOD, { destination: "unassigned" });
  });

  it("refuses a bad period id or choice without recording", async () => {
    expect(await recordLeftoverAction("nope", { destination: "unassigned" })).toEqual({
      error: "That budget wasn't found. Reload the page and try again.",
    });
    expect(await recordLeftoverAction(PERIOD, { destination: "spend" })).toEqual({ error: "Choose where your leftover goes." });
    expect(recordLeftover).not.toHaveBeenCalled();
  });

  it("shows a known refusal's message", async () => {
    recordLeftover.mockRejectedValue(new AlreadyReviewedError());
    expect(await recordLeftoverAction(PERIOD, { destination: "next_period" })).toEqual({ error: "This budget has already been reviewed." });
  });

  it("shows an overspend's refusals: a short fund, or a choice an overspend can't take", async () => {
    recordLeftover.mockRejectedValueOnce(new FundShortError("Emergency", 2000));
    expect(await recordLeftoverAction(PERIOD, { destination: "fund", fundId: PERIOD })).toEqual({ error: "Emergency only has £20.00." });
    recordLeftover.mockRejectedValueOnce(new OverspendChoiceError());
    expect(await recordLeftoverAction(PERIOD, { destination: "unassigned" })).toEqual({
      error: "Choose where the overspend comes from: next month's spending money or a savings fund.",
    });
  });

  it("sends a signed-out visitor to /login", async () => {
    getUserId.mockResolvedValue(null);
    await expect(recordLeftoverAction(PERIOD, null)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(recordLeftover).not.toHaveBeenCalled();
  });
});

describe("applyRaiseAction", () => {
  it("raises the category from the current period on", async () => {
    expect(await applyRaiseAction(PERIOD, 42100)).toEqual({});
    expect(raiseBudget).toHaveBeenCalledWith({}, "2026-11-21", PERIOD, 42100);
  });

  it("shows a refused raise's message", async () => {
    raiseBudget.mockRejectedValue(new RaiseRefusedError());
    expect(await applyRaiseAction(PERIOD, 42100)).toEqual({ error: "That budget couldn't be raised. Reload the page and try again." });
  });

  it("refuses a bad amount", async () => {
    expect((await applyRaiseAction(PERIOD, 0)).error).toMatch(/Enter an amount/);
    expect(raiseBudget).not.toHaveBeenCalled();
  });
});

describe("dismissNudgeAction", () => {
  it("dismisses the nudge", async () => {
    await dismissNudgeAction();
    expect(dismissUnassignedNudge).toHaveBeenCalledWith({});
  });
});
