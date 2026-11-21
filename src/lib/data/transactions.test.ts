import { describe, expect, it, vi } from "vitest";
import { MissingReferenceError, saveExpense } from "./transactions";
import type { Db } from "./types";

/**
 * A stand-in client for the one path a real database can't easily produce:
 * the expense insert fails and then removing the new category fails too.
 */
function fakeClient() {
  const result = (value: unknown) => ({ select: () => ({ single: async () => value }) });
  return {
    from: (table: string) => ({
      insert: () =>
        table === "categories"
          ? result({ data: { id: "new-cat" }, error: null })
          : result({ data: null, error: { code: "23503", message: "fk" } }),
      delete: () => ({ eq: async () => ({ error: { message: "network down" } }) }),
    }),
  } as unknown as Db;
}

describe("saveExpense", () => {
  it("logs when the new category can't be removed after a failed save, and still throws the save's error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      saveExpense(fakeClient(), null, { name: "X", amountPence: 100, date: "2026-11-21", category: { name: "Orphan", kind: "need" }, fundId: null }),
    ).rejects.toBeInstanceOf(MissingReferenceError);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/couldn't remove the new category/), "new-cat", { message: "network down" });
    log.mockRestore();
  });
});
