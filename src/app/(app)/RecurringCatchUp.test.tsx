import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { tag: "user client" };
const { getUserId, generateDue } = vi.hoisted(() => ({ getUserId: vi.fn(), generateDue: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getUserId, createClient: async () => client }));
vi.mock("@/lib/today", () => ({ getTimeZone: async () => "Pacific/Auckland" }));
vi.mock("@/lib/data/recurring", () => ({ generateDue }));

import { RecurringCatchUp } from "./RecurringCatchUp";

describe("RecurringCatchUp", () => {
  beforeEach(() => {
    getUserId.mockReset().mockResolvedValue("user-1");
    generateDue.mockReset().mockResolvedValue(0);
  });

  it("adds the signed-in user's due payments with their own client, in their zone, and renders nothing", async () => {
    expect(await RecurringCatchUp()).toBeNull();
    expect(generateDue).toHaveBeenCalledWith(client, "user-1", "Pacific/Auckland", expect.any(Date));
  });

  it("does nothing when signed out", async () => {
    getUserId.mockResolvedValue(null);
    expect(await RecurringCatchUp()).toBeNull();
    expect(generateDue).not.toHaveBeenCalled();
  });

  it("never breaks the page: a failure is logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    generateDue.mockRejectedValue(new Error("offline"));
    expect(await RecurringCatchUp()).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
