import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignedInSync } from "./SignedInSync";

const server = vi.hoisted(() => ({
  getUserId: vi.fn<() => Promise<string | null>>(),
  getProfile: vi.fn<() => Promise<{ timezone: string; timezoneDetected: boolean } | null>>(),
  createClient: vi.fn(async () => ({})),
}));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-12-03" }));
const trips = vi.hoisted(() => ({ tripCovering: vi.fn() }));
vi.mock("@/lib/data/trips", () => trips);
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
    trips.tripCovering.mockReset().mockResolvedValue(null);
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

  it("gives TimezoneSync the home zone, today and the trip covering today, for the travelling prompt", async () => {
    server.getUserId.mockResolvedValue("user-1");
    server.getProfile.mockResolvedValue({ timezone: "Europe/London", timezoneDetected: true });
    trips.tripCovering.mockResolvedValue({ id: "t1", name: "Taiwan", place: "Taipei", startDate: "2026-12-01", endDate: "2026-12-15" });
    const el = await SignedInSync();
    expect(isValidElement(el) && el.props).toEqual({
      homeDetected: true,
      homeZone: "Europe/London",
      today: "2026-12-03",
      currentTrip: { id: "t1", name: "Taiwan", end: "2026-12-15" },
    });
    expect(trips.tripCovering).toHaveBeenCalledWith(expect.anything(), "2026-12-03");
  });
});
