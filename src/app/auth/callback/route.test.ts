// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

const call = (query: string) => GET(new NextRequest(`http://localhost:3000/auth/callback${query}`));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("exchanges the code and goes to /budget by default", async () => {
    const res = await call("?code=abc");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe("http://localhost:3000/budget");
  });

  it("goes to a same-origin next path", async () => {
    const res = await call("?code=abc&next=%2Fexpenses%3Fmonth%3D2026-11");
    expect(res.headers.get("location")).toBe("http://localhost:3000/expenses?month=2026-11");
  });

  it("ignores an off-site next", async () => {
    const res = await call("?code=abc&next=%2F%2Fevil.test");
    expect(res.headers.get("location")).toBe("http://localhost:3000/budget");
  });

  it("returns to /login with an error when the code is missing", async () => {
    const res = await call("");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=signin");
  });

  it("returns to /login with an error when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    const res = await call("?code=bad");
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=signin");
  });
});
