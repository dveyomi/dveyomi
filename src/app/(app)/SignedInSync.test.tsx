import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignedInSync } from "./SignedInSync";

const server = vi.hoisted(() => ({
  getUserId: vi.fn<() => Promise<string | null>>(),
  getProfile: vi.fn<() => Promise<{ timezone: string; timezoneDetected: boolean } | null>>(),
}));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("@/components/TimezoneSync", () => ({ TimezoneSync: () => null }));

/** redirect() throws an error whose digest carries the target URL. */
async function redirectTarget(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    throw e;
  }
  throw new Error("expected a redirect");
}

describe("SignedInSync", () => {
  beforeEach(() => {
    server.getUserId.mockReset();
    server.getProfile.mockReset();
  });

  it("sends a signed-out visitor to /login", async () => {
    server.getUserId.mockResolvedValue(null);
    server.getProfile.mockResolvedValue(null);
    expect(await redirectTarget(SignedInSync)).toBe("/login");
  });

  it("signs out a user with no profile instead of looping between /login and /budget", async () => {
    server.getUserId.mockResolvedValue("user-1");
    server.getProfile.mockResolvedValue(null);
    expect(await redirectTarget(SignedInSync)).toBe("/auth/no-profile");
  });

  it("renders TimezoneSync with the home-zone flag when the profile exists", async () => {
    server.getUserId.mockResolvedValue("user-1");
    server.getProfile.mockResolvedValue({ timezone: "Asia/Taipei", timezoneDetected: true });
    const el = await SignedInSync();
    expect(isValidElement(el) && (el.props as { homeDetected: boolean }).homeDetected).toBe(true);
  });
});
