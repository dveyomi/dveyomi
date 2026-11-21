// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateDue, range } = vi.hoisted(() => ({ generateDue: vi.fn(), range: vi.fn() }));
const admin = { from: () => ({ select: () => ({ order: () => ({ range }) }) }) };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/data/recurring", () => ({ generateDue }));

import { POST } from "./route";

const call = (authorization?: string) =>
  POST(
    new Request("http://localhost:3000/api/cron/recurring", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );

describe("POST /api/cron/recurring", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    generateDue.mockReset().mockResolvedValue(2);
    range.mockReset().mockResolvedValue({
      data: [
        { user_id: "u1", timezone: "Europe/London" },
        { user_id: "u2", timezone: "Pacific/Auckland" },
        { user_id: "u3", timezone: "Not/AZone" },
      ],
      error: null,
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, "Bearer wrong", "s3cret-value", "Bearer s3cret-valuE", "Bearer s3cret-value-and-more"])(
    "refuses %s with 401 and generates nothing",
    async (authorization) => {
      const res = await call(authorization);
      expect(res.status).toBe(401);
      expect(generateDue).not.toHaveBeenCalled();
    },
  );

  it("refuses everyone when CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(generateDue).not.toHaveBeenCalled();
  });

  it("generates due payments for every profile in its own time zone (London when unknown)", async () => {
    const res = await call("Bearer s3cret-value");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ users: 3, added: 6, failed: 0 });
    expect(generateDue.mock.calls.map(([db, id, zone, now]) => [db, id, zone, now instanceof Date])).toEqual([
      [admin, "u1", "Europe/London", true],
      [admin, "u2", "Pacific/Auckland", true],
      [admin, "u3", "Europe/London", true],
    ]);
  });

  it("carries on past one user's failure and counts it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    generateDue.mockRejectedValueOnce(new Error("boom"));
    const res = await call("Bearer s3cret-value");
    expect(await res.json()).toEqual({ users: 3, added: 4, failed: 1 });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
