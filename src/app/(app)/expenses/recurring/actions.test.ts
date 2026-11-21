import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  pauseRule: vi.fn(),
  resumeRule: vi.fn(),
  skipNext: vi.fn(),
  cancelRule: vi.fn(),
  changePrice: vi.fn(),
  confirmOccurrence: vi.fn(),
  acceptDetection: vi.fn(),
  dismissDetection: vi.fn(),
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
vi.mock("@/lib/data/recurring", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/recurring")>()),
  ...data,
}));

import { RuleNotFoundError } from "@/lib/data/recurring";
import {
  acceptDetectionAction,
  cancelAction,
  changeAmountAction,
  confirmOccurrenceAction,
  dismissDetectionAction,
  pauseAction,
  resumeAction,
  skipNextAction,
} from "./actions";

const RULE = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  for (const fn of Object.values(data)) fn.mockReset().mockResolvedValue(undefined);
  getUserId.mockReset().mockResolvedValue("user-1");
  revalidatePath.mockReset();
});

describe("recurring actions", () => {
  it("send a signed-out caller to /login", async () => {
    getUserId.mockResolvedValue(null);
    await expect(pauseAction(RULE, "2026-12-01")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(data.pauseRule).not.toHaveBeenCalled();
  });

  it("refuse a malformed id", async () => {
    for (const run of [() => resumeAction("x"), () => skipNextAction(1), () => cancelAction(null), () => confirmOccurrenceAction("x")]) {
      expect(await run()).toEqual({ error: expect.any(String) });
    }
    expect(data.resumeRule).not.toHaveBeenCalled();
  });

  it("pause until a real date after today", async () => {
    expect(await pauseAction(RULE, "2026-11-21")).toEqual({ error: "Choose a date after today." });
    expect(await pauseAction(RULE, "2026-02-30")).toEqual({ error: "Choose a date after today." });
    expect(await pauseAction(RULE, "2026-12-01")).toEqual({});
    expect(data.pauseRule).toHaveBeenCalledWith(db, RULE, "2026-12-01");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("skip next, resume and cancel (ends it today)", async () => {
    await skipNextAction(RULE);
    expect(data.skipNext).toHaveBeenCalledWith(db, RULE, "2026-11-21");
    await resumeAction(RULE);
    expect(data.resumeRule).toHaveBeenCalledWith(db, RULE);
    await cancelAction(RULE);
    expect(data.cancelRule).toHaveBeenCalledWith(db, RULE, "2026-11-21");
  });

  it("change amount: 1p to £10m from a real date", async () => {
    expect(await changeAmountAction(RULE, "2026-12-01", 0)).toEqual({ error: expect.stringContaining("amount") });
    expect(await changeAmountAction(RULE, "nope", 100)).toEqual({ error: expect.stringContaining("date") });
    expect(await changeAmountAction(RULE, "2026-12-01", 1299)).toEqual({});
    expect(data.changePrice).toHaveBeenCalledWith(db, RULE, "2026-12-01", 1299);
  });

  it("detection answers take a name key", async () => {
    expect(await acceptDetectionAction("")).toEqual({ error: expect.any(String) });
    await acceptDetectionAction("gym");
    expect(data.acceptDetection).toHaveBeenCalledWith(db, "gym", "2026-11-21");
    await dismissDetectionAction("gym");
    expect(data.dismissDetection).toHaveBeenCalledWith(db, "gym");
  });

  it("report a known failure in words, and log anything else", async () => {
    data.resumeRule.mockRejectedValueOnce(new RuleNotFoundError());
    expect(await resumeAction(RULE)).toEqual({ error: new RuleNotFoundError().message });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    data.resumeRule.mockRejectedValueOnce(new Error("offline"));
    expect(await resumeAction(RULE)).toEqual({ error: expect.stringContaining("couldn't") });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
