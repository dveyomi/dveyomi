// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserId, exportUserData } = vi.hoisted(() => ({ getUserId: vi.fn(), exportUserData: vi.fn() }));
const db = { tag: "user-client" };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db, getUserId }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-11-21" }));
vi.mock("@/lib/data/account", () => ({ exportUserData }));

import { GET } from "./route";

beforeEach(() => {
  getUserId.mockReset().mockResolvedValue("user-a");
  exportUserData.mockReset().mockResolvedValue({ profiles: [{ user_id: "user-a" }], transactions: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/export", () => {
  it("refuses a signed-out caller with 401 and reads nothing", async () => {
    getUserId.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(exportUserData).not.toHaveBeenCalled();
  });

  it("downloads the user's rows as a dated JSON attachment, never cached", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="personal-finance-export-2026-11-21.json"',
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(exportUserData).toHaveBeenCalledWith(db);
    const body = await res.json();
    expect(body).toMatchObject({
      app: "Personal Finance OS",
      exportedOn: "2026-11-21",
      tables: { profiles: [{ user_id: "user-a" }], transactions: [] },
    });
  });

  it("answers 500 without a partial file when a read fails", async () => {
    exportUserData.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(res.headers.get("content-disposition")).toBeNull();
  });
});
