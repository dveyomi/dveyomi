import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadBudgetView, loadSavingView, redirect, getUserId } = vi.hoisted(() => ({
  loadBudgetView: vi.fn(),
  loadSavingView: vi.fn(),
  getUserId: vi.fn(async (): Promise<string | null> => "user-1"),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("@/lib/data/budget", () => ({ loadBudgetView }));
vi.mock("@/lib/data/funds", () => ({ loadSavingView }));
vi.mock("next/navigation", () => ({ redirect }));

import { BudgetContent } from "./BudgetContent";

const period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
const params = (tab?: string) => Promise.resolve(tab ? { tab } : {});

describe("BudgetContent", () => {
  beforeEach(() => {
    loadBudgetView.mockReset();
    loadSavingView.mockReset().mockResolvedValue({ funds: [], waiting: [] });
    redirect.mockClear();
    getUserId.mockClear();
  });

  it("sends a signed-out visitor to /login before loading anything", async () => {
    getUserId.mockResolvedValueOnce(null);
    await expect(BudgetContent({ searchParams: params() })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(loadBudgetView).not.toHaveBeenCalled();
  });

  it("sends a user with no budget to /onboarding", async () => {
    loadBudgetView.mockResolvedValue({ period, summary: null, categories: [] });
    await expect(BudgetContent({ searchParams: params() })).rejects.toThrow("NEXT_REDIRECT:/onboarding");
    expect(loadBudgetView).toHaveBeenCalledWith({}, "2026-11-21");
    expect(loadSavingView).not.toHaveBeenCalled();
  });

  it("renders the budget, on the tab the URL names", async () => {
    const summary = { categories: [] };
    loadBudgetView.mockResolvedValue({ period, summary, categories: [] });
    const saving = await BudgetContent({ searchParams: params("saving") });
    expect(saving.props).toMatchObject({ summary, tab: "saving", saving: { funds: [], waiting: [] }, today: "2026-11-21" });
    expect(loadSavingView).toHaveBeenCalledWith({}, "2026-11-21");
    const other = await BudgetContent({ searchParams: params("nonsense") });
    expect(other.props.tab).toBe("spending");
    expect(redirect).not.toHaveBeenCalled();
  });
});
