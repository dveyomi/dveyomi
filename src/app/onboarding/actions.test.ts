import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeOnboarding, redirect, getUserId } = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  getUserId: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/data/onboarding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/onboarding")>()),
  completeOnboarding,
}));

import { AlreadyOnboardedError } from "@/lib/data/onboarding";
import { completeOnboardingAction } from "./actions";

const valid = {
  incomePence: 600000,
  startDay: 25,
  savingsPence: 0,
  categories: [{ name: "Rent", kind: "need" as const, amountPence: 150000 }],
  funds: [],
};

describe("completeOnboardingAction", () => {
  beforeEach(() => {
    completeOnboarding.mockReset().mockResolvedValue(undefined);
    getUserId.mockReset().mockResolvedValue("user-1");
    redirect.mockClear();
  });

  it("saves a valid setup for today, then goes to /budget", async () => {
    await expect(completeOnboardingAction(valid)).rejects.toThrow("NEXT_REDIRECT:/budget");
    expect(completeOnboarding).toHaveBeenCalledWith({}, valid, "2026-11-21");
  });

  it("returns the validation error and saves nothing for invalid input", async () => {
    expect(await completeOnboardingAction({ ...valid, incomePence: 0 })).toEqual({
      error: expect.stringMatching(/income/i),
    });
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it("sends signed-out callers to /login without saving", async () => {
    getUserId.mockResolvedValue(null);
    await expect(completeOnboardingAction(valid)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it("a repeat submit after the budget exists just goes to /budget", async () => {
    completeOnboarding.mockRejectedValue(new AlreadyOnboardedError());
    await expect(completeOnboardingAction(valid)).rejects.toThrow("NEXT_REDIRECT:/budget");
  });

  it("any other failure returns a retryable error", async () => {
    completeOnboarding.mockRejectedValue(new Error("network"));
    expect(await completeOnboardingAction(valid)).toEqual({ error: expect.stringMatching(/try again/i) });
  });
});
