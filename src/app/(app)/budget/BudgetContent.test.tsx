import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureCurrentPeriod, redirect } = vi.hoisted(() => ({
  ensureCurrentPeriod: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId: async () => "user-1" }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("@/lib/data/ensurePeriod", () => ({ ensureCurrentPeriod }));
vi.mock("next/navigation", () => ({ redirect }));

import { BudgetContent } from "./BudgetContent";

describe("BudgetContent", () => {
  beforeEach(() => {
    ensureCurrentPeriod.mockReset();
    redirect.mockClear();
  });

  it("sends a user with no budget period to /onboarding", async () => {
    ensureCurrentPeriod.mockResolvedValue(null);
    await expect(BudgetContent()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
    expect(ensureCurrentPeriod).toHaveBeenCalledWith({}, "2026-11-21");
  });

  it("renders for a user with a budget period", async () => {
    ensureCurrentPeriod.mockResolvedValue({ id: "p1" });
    await expect(BudgetContent()).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
