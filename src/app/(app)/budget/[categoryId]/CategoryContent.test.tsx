import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadCategoryView, redirect, notFound, getUserId } = vi.hoisted(() => ({
  loadCategoryView: vi.fn(),
  getUserId: vi.fn(async (): Promise<string | null> => "user-1"),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("@/lib/data/category", () => ({ loadCategoryView }));
vi.mock("next/navigation", () => ({ redirect, notFound }));

import { CategoryContent } from "./CategoryContent";

const params = Promise.resolve({ categoryId: "cat-1" });
const period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };

describe("CategoryContent", () => {
  beforeEach(() => {
    loadCategoryView.mockReset();
    getUserId.mockClear();
  });

  it("sends a signed-out visitor to /login", async () => {
    getUserId.mockResolvedValueOnce(null);
    await expect(CategoryContent({ params })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(loadCategoryView).not.toHaveBeenCalled();
  });

  it("is a 404 for an unknown or another user's category", async () => {
    loadCategoryView.mockResolvedValue(null);
    await expect(CategoryContent({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadCategoryView).toHaveBeenCalledWith({}, "2026-11-21", "cat-1");
  });

  it("sends a user with no budget to /onboarding", async () => {
    loadCategoryView.mockResolvedValue({ period, category: {}, summary: null, figure: null, transactions: [] });
    await expect(CategoryContent({ params })).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });

  it("passes the summary's days left and the category's figure to the detail", async () => {
    const figure = { categoryId: "cat-1" };
    loadCategoryView.mockResolvedValue({ period, category: { id: "cat-1" }, summary: { daysLeft: 10 }, figure, transactions: [] });
    const el = await CategoryContent({ params });
    expect(el.props).toMatchObject({ figure, daysLeft: 10, period });
  });
});
