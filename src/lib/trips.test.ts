import { describe, expect, it } from "vitest";
import { placeFromZone, suggestedTrip, tripPrompt } from "./trips";

describe("placeFromZone", () => {
  it("takes the city part of an IANA zone", () => {
    expect(placeFromZone("Asia/Taipei")).toBe("Taipei");
    expect(placeFromZone("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(placeFromZone("UTC")).toBe("");
  });
});

describe("suggestedTrip", () => {
  it("starts today and runs two weeks (today + 13 days)", () => {
    expect(suggestedTrip("Asia/Taipei", "2026-12-01")).toEqual({ place: "Taipei", start: "2026-12-01", end: "2026-12-14" });
  });
});

describe("tripPrompt", () => {
  const base = { homeZone: "Europe/London", today: "2026-12-03", currentTrip: null, dismissed: () => false };

  it("asks to start a trip when the device zone differs from the home zone and no trip covers today", () => {
    expect(tripPrompt({ ...base, deviceZone: "Asia/Taipei" })).toEqual({ kind: "start", zone: "Asia/Taipei" });
  });

  it("asks nothing when the device zone equals the home zone", () => {
    expect(tripPrompt({ ...base, deviceZone: "Europe/London" })).toBeNull();
  });

  it("asks nothing while travelling when a trip already covers today", () => {
    const currentTrip = { id: "t1", name: "Taiwan", end: "2026-12-15" };
    expect(tripPrompt({ ...base, deviceZone: "Asia/Taipei", currentTrip })).toBeNull();
  });

  it("asks only once per device zone: not after it was dismissed", () => {
    const dismissed = (key: string) => key === "start:Asia/Taipei";
    expect(tripPrompt({ ...base, deviceZone: "Asia/Taipei", dismissed })).toBeNull();
    expect(tripPrompt({ ...base, deviceZone: "Asia/Tokyo", dismissed })).toEqual({ kind: "start", zone: "Asia/Tokyo" });
  });

  it("back in the home zone during a trip, asks whether to end it (once per trip)", () => {
    const currentTrip = { id: "t1", name: "Taiwan", end: "2026-12-15" };
    expect(tripPrompt({ ...base, deviceZone: "Europe/London", currentTrip })).toEqual({ kind: "end", trip: currentTrip });
    expect(tripPrompt({ ...base, deviceZone: "Europe/London", currentTrip, dismissed: (k) => k === "end:t1" })).toBeNull();
  });

  it("does not ask to end a trip that already ends today", () => {
    const currentTrip = { id: "t1", name: "Taiwan", end: "2026-12-03" };
    expect(tripPrompt({ ...base, deviceZone: "Europe/London", currentTrip })).toBeNull();
  });
});
