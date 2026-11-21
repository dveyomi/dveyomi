import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
  removeFromBudget: vi.fn(),
  getUserId: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId: data.getUserId }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("next/navigation", () => ({ redirect: data.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/budgetEdit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/budgetEdit")>()),
  renameCategory: data.renameCategory,
  deleteCategory: data.deleteCategory,
  removeFromBudget: data.removeFromBudget,
}));

import { CategoryInUseError, NameTakenError } from "@/lib/data/budgetEdit";
import { deleteCategoryAction, removeFromBudgetAction, renameCategoryAction } from "./actions";

const ID = "11111111-1111-4111-8111-111111111111";

describe("category actions", () => {
  beforeEach(() => {
    for (const f of [data.renameCategory, data.deleteCategory, data.removeFromBudget]) f.mockReset().mockResolvedValue(undefined);
    data.getUserId.mockReset().mockResolvedValue("user-1");
  });

  it("rename trims the name and saves it", async () => {
    expect(await renameCategoryAction(ID, "  Trains ")).toBeUndefined();
    expect(data.renameCategory).toHaveBeenCalledWith({}, ID, "Trains");
  });

  it.each([
    ["a blank name", ID, "  "],
    ["a name over 50 characters", ID, "x".repeat(51)],
    ["a malformed id", "travel", "Trains"],
  ])("rename refuses %s and saves nothing", async (_, id, name) => {
    expect(await renameCategoryAction(id, name)).toEqual({ error: expect.any(String) });
    expect(data.renameCategory).not.toHaveBeenCalled();
  });

  it("rename returns a taken name as a message", async () => {
    data.renameCategory.mockRejectedValue(new NameTakenError("Rent"));
    expect(await renameCategoryAction(ID, "rent")).toEqual({ error: "You already have a category called Rent." });
  });

  it("delete goes to the budget with a confirmation, or explains a category in use", async () => {
    await expect(deleteCategoryAction(ID)).rejects.toThrow("NEXT_REDIRECT:/budget?deleted=1");
    expect(data.deleteCategory).toHaveBeenCalledWith({}, "2026-11-21", ID);
    data.deleteCategory.mockRejectedValue(new CategoryInUseError());
    expect(await deleteCategoryAction(ID)).toEqual({ error: expect.stringMatching(/in use/) });
  });

  it("remove from budget applies from this period, for the server's today", async () => {
    expect(await removeFromBudgetAction(ID)).toBeUndefined();
    expect(data.removeFromBudget).toHaveBeenCalledWith({}, "2026-11-21", ID, "this");
  });

  it("sends signed-out callers to /login", async () => {
    data.getUserId.mockResolvedValue(null);
    await expect(renameCategoryAction(ID, "Trains")).rejects.toThrow("NEXT_REDIRECT:/login");
    await expect(deleteCategoryAction(ID)).rejects.toThrow("NEXT_REDIRECT:/login");
    await expect(removeFromBudgetAction(ID)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(data.deleteCategory).not.toHaveBeenCalled();
  });
});
