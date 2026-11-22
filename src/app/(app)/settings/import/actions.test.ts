import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  commitImport: vi.fn(),
  existingExpensesFor: vi.fn(),
  undoImport: vi.fn(),
}));
const { getUserId, redirect, revalidatePath } = vi.hoisted(() => ({
  getUserId: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
}));
const db = { tag: "db" };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db, getUserId }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("@/lib/data/imports", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/imports")>()),
  ...data,
}));

import { ImportBatchNotFoundError } from "@/lib/data/imports";
import { MissingReferenceError } from "@/lib/data/transactions";
import { findDuplicatesAction, importAction, undoImportAction } from "./actions";

const CAT = "11111111-1111-4111-8111-111111111111";
const BATCH = "33333333-3333-4333-8333-333333333333";
const row = { row: 2, date: "2026-11-05", amountPence: 1250, name: "Tesco" };

beforeEach(() => {
  for (const fn of Object.values(data)) fn.mockReset();
  getUserId.mockReset().mockResolvedValue("user-1");
  revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("import actions", () => {
  it("send a signed-out caller to /login", async () => {
    getUserId.mockResolvedValue(null);
    await expect(importAction({ filename: "a.csv", categoryId: CAT, rows: [row] })).rejects.toThrow("NEXT_REDIRECT:/login");
    await expect(findDuplicatesAction([row])).rejects.toThrow("NEXT_REDIRECT:/login");
    await expect(undoImportAction(BATCH)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(data.commitImport).not.toHaveBeenCalled();
  });
});

describe("findDuplicatesAction", () => {
  it("returns each likely duplicate's index and label: an existing expense's amount nearby, or an earlier row", async () => {
    data.existingExpensesFor.mockResolvedValue([{ date: "2026-11-04", amountPence: 1250, name: "TESCO", source: "manual" }]);
    const pret = { row: 3, date: "2026-11-09", amountPence: 499, name: "Pret" };
    const result = await findDuplicatesAction([row, pret, { ...pret, row: 4 }]);
    expect(result).toEqual({
      duplicates: [
        { index: 0, label: "Looks like your TESCO" },
        { index: 2, label: "Same as row 3 in this file" },
      ],
    });
    expect(data.existingExpensesFor).toHaveBeenCalledWith(db, expect.any(Array));
  });

  it("refuses malformed rows", async () => {
    expect(await findDuplicatesAction([{ ...row, date: "nope" }])).toEqual({ error: expect.any(String) });
    expect(data.existingExpensesFor).not.toHaveBeenCalled();
  });
});

describe("importAction", () => {
  it("checks the rows, saves them with the server's today and refreshes every page", async () => {
    data.commitImport.mockResolvedValue({ batchId: BATCH, inserted: 1 });
    const result = await importAction({ filename: "bank.csv", categoryId: CAT, rows: [{ ...row, name: " Tesco " }] });
    expect(result).toEqual({ batchId: BATCH, inserted: 1 });
    expect(data.commitImport).toHaveBeenCalledWith(db, [row], CAT, { filename: "bank.csv", today: "2026-11-21" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuses rows outside the rules without saving", async () => {
    const result = await importAction({ filename: "bank.csv", categoryId: CAT, rows: [{ ...row, date: "2030-01-01" }] });
    expect(result).toEqual({ error: "Row 2 can't be imported. Go back to the preview and check it." });
    expect(data.commitImport).not.toHaveBeenCalled();
  });

  it("explains a missing category and hides other failures", async () => {
    data.commitImport.mockRejectedValueOnce(new MissingReferenceError());
    expect(await importAction({ filename: "a.csv", categoryId: CAT, rows: [row] })).toEqual({ error: new MissingReferenceError().message });
    data.commitImport.mockRejectedValueOnce(new Error("boom"));
    expect(await importAction({ filename: "a.csv", categoryId: CAT, rows: [row] })).toEqual({
      error: "We couldn't import these expenses. Nothing was saved. Check your connection and try again.",
    });
  });
});

describe("undoImportAction", () => {
  it("undoes the import and refreshes every page", async () => {
    data.undoImport.mockResolvedValue(3);
    expect(await undoImportAction(BATCH)).toEqual({ removed: 3 });
    expect(data.undoImport).toHaveBeenCalledWith(db, BATCH);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuses a malformed id and explains a missing import", async () => {
    expect(await undoImportAction("x")).toEqual({ error: expect.any(String) });
    data.undoImport.mockRejectedValueOnce(new ImportBatchNotFoundError());
    expect(await undoImportAction(BATCH)).toEqual({ error: new ImportBatchNotFoundError().message });
  });
});
