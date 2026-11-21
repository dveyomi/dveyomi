import { beforeEach, describe, expect, it, vi } from "vitest";

const { endTrip, getUserId, revalidatePath } = vi.hoisted(() => ({ endTrip: vi.fn(), getUserId: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), getUserId }));
vi.mock("@/lib/today", () => ({ getToday: async () => "2026-12-03" }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/data/trips", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/trips")>()),
  endTrip,
}));

import { TripNotCurrentError, TripNotFoundError } from "@/lib/data/trips";
import { endCurrentTrip } from "./actions";

const TRIP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("endCurrentTrip", () => {
  beforeEach(() => {
    endTrip.mockReset().mockResolvedValue(undefined);
    getUserId.mockReset().mockResolvedValue("user-1");
    revalidatePath.mockReset();
  });

  it("ends the trip today and refreshes", async () => {
    expect(await endCurrentTrip(TRIP)).toEqual({});
    expect(endTrip).toHaveBeenCalledWith({}, TRIP, "2026-12-03");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("refuses a trip that doesn't cover today, in words", async () => {
    endTrip.mockRejectedValue(new TripNotCurrentError());
    expect(await endCurrentTrip(TRIP)).toEqual({ error: "This trip isn't on today, so it can't end today." });
  });

  it("reports an unknown trip and a bad id", async () => {
    endTrip.mockRejectedValue(new TripNotFoundError());
    expect((await endCurrentTrip(TRIP)).error).toMatch(/no longer exists/);
    expect(await endCurrentTrip("nope")).toEqual({ error: "This trip wasn't recognised." });
  });
});
