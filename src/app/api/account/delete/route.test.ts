// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserId, deleteAccount, signOut, cookieStore } = vi.hoisted(() => ({
  getUserId: vi.fn(),
  deleteAccount: vi.fn(),
  signOut: vi.fn(),
  cookieStore: { getAll: vi.fn(), delete: vi.fn() },
}));
const admin = { tag: "service-role" };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signOut } }), getUserId }));
vi.mock("@/lib/data/account", () => ({ deleteAccount }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

import { POST } from "./route";

const call = (confirm?: string, headers: Record<string, string> = {}) => {
  const body = new FormData();
  if (confirm !== undefined) body.set("confirm", confirm);
  return POST(
    new Request("http://localhost:3000/api/account/delete", {
      method: "POST",
      body,
      headers: { host: "localhost:3000", origin: "http://localhost:3000", ...headers },
    }),
  );
};

beforeEach(() => {
  getUserId.mockReset().mockResolvedValue("user-a");
  deleteAccount.mockReset().mockResolvedValue(undefined);
  signOut.mockReset().mockResolvedValue({ error: null });
  cookieStore.getAll.mockReset().mockReturnValue([{ name: "sb-127-auth-token", value: "x" }, { name: "theme", value: "dark" }]);
  cookieStore.delete.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/account/delete", () => {
  it("refuses a signed-out caller with 401 and deletes nothing", async () => {
    getUserId.mockResolvedValue(null);
    const res = await call("DELETE");
    expect(res.status).toBe(401);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "delete", "Delete", " DELETE", "DELETE "])(
    "answers 400 when the confirmation is %j, and deletes nothing",
    async (confirm) => {
      const res = await call(confirm);
      expect(res.status).toBe(400);
      expect(deleteAccount).not.toHaveBeenCalled();
    },
  );

  it("refuses a request from another site with 403", async () => {
    const res = await call("DELETE", { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("compares the origin with the first host of a comma-separated x-forwarded-host", async () => {
    const ok = await call("DELETE", { origin: "https://app.example.com", "x-forwarded-host": "app.example.com, internal:3000" });
    expect(ok.status).toBe(303);
    deleteAccount.mockClear();
    const bad = await call("DELETE", { origin: "https://internal:3000", "x-forwarded-host": "app.example.com, internal:3000" });
    expect(bad.status).toBe(403);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the signed-in user with the service role, signs out, then sends them to /login?deleted=1", async () => {
    const res = await call("DELETE");
    expect(deleteAccount).toHaveBeenCalledWith(admin, "user-a");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(deleteAccount.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0]);
    expect(cookieStore.delete).toHaveBeenCalledWith("sb-127-auth-token");
    expect(cookieStore.delete).not.toHaveBeenCalledWith("theme");
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname + new URL(res.headers.get("location")!).search).toBe(
      "/login?deleted=1",
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 500 and keeps the session when the delete fails", async () => {
    deleteAccount.mockRejectedValue(new Error("auth down"));
    const res = await call("DELETE");
    expect(res.status).toBe(500);
    expect(signOut).not.toHaveBeenCalled();
  });
});
