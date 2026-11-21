// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const signOut = vi.fn(async () => ({ error: null }));
const server = vi.hoisted(() => ({
  getUserId: vi.fn<() => Promise<string | null>>(),
  getProfile: vi.fn<() => Promise<{ timezone: string; timezoneDetected: boolean } | null>>(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => server);

const call = () => GET(new NextRequest("http://localhost:3000/auth/no-profile"));

describe("GET /auth/no-profile", () => {
  beforeEach(() => {
    signOut.mockClear();
    server.createClient.mockResolvedValue({ auth: { signOut } });
  });

  it("signs out a user with no profile and shows the account error on /login", async () => {
    server.getUserId.mockResolvedValue("user-1");
    server.getProfile.mockResolvedValue(null);
    const res = await call();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=account");
  });

  it("does not sign out a user whose profile exists", async () => {
    server.getUserId.mockResolvedValue("user-1");
    server.getProfile.mockResolvedValue({ timezone: "Europe/London", timezoneDetected: true });
    const res = await call();
    expect(signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/budget");
  });

  it("sends a signed-out visitor to /login", async () => {
    server.getUserId.mockResolvedValue(null);
    server.getProfile.mockResolvedValue(null);
    const res = await call();
    expect(signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
