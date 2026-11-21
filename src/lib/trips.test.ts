import { describe, expect, it } from "vitest";
import { awayTripToRecord, placeFromZone, suggestedTrip, tripPrompt } from "./trips";

describe("placeFromZone", () => {
  it("takes the city part of an IANA zone", () => {
    expect(placeFromZone("Asia/Taipei")).toBe("Taipei");
    expect(placeFromZone("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(placeFromZone("UTC")).toBe("");
  });
});

describe("suggestedTrip", () => {
  it("starts today and runs two weeks (today + 13 days)", () => {
    expect(suggestedTrip("Asia/Taipei", "2026-12-01", null)).toEqual({ place: "Taipei", start: "2026-12-01", end: "2026-12-14" });
    expect(suggestedTrip("Asia/Taipei", "2026-12-01", "2026-12-15")).toEqual({ place: "Taipei", start: "2026-12-01", end: "2026-12-14" });
  });

  it("ends the day before the next trip when two weeks would overlap it", () => {
    expect(suggestedTrip("Asia/Taipei", "2026-12-01", "2026-12-06")).toEqual({ place: "Taipei", start: "2026-12-01", end: "2026-12-05" });
    expect(suggestedTrip("Asia/Taipei", "2026-12-01", "2026-12-02")).toEqual({ place: "Taipei", start: "2026-12-01", end: "2026-12-01" });
  });
});

describe("tripPrompt", () => {
  const taiwan = { id: "t1", name: "Taiwan", end: "2026-12-15" };
  const base = { homeZone: "Europe/London", today: "2026-12-03", currentTrip: null, dismissed: () => false, wasAway: () => false };

  it("asks to start a trip when the device zone differs from the home zone and no trip covers today", () => {
    expect(tripPrompt({ ...base, deviceZone: "Asia/Taipei" })).toEqual({ kind: "start", zone: "Asia/Taipei" });
  });

  it("asks nothing when the device zone equals the home zone", () => {
    expect(tripPrompt({ ...base, deviceZone: "Europe/London" })).toBeNull();
  });

  it("asks nothing while travelling when a trip already covers today", () => {
    expect(tripPrompt({ ...base, deviceZone: "Asia/Taipei", currentTrip: taiwan })).toBeNull();
  });

  it("asks only once per device zone: not after it was dismissed", () => {
    const dismissed = (key: string) => key === "start:Asia/Taipei";
    expect(tripPrompt({ ...base, deviceZone: "Asia/Taipei", dismissed })).toBeNull();
    expect(tripPrompt({ ...base, deviceZone: "Asia/Tokyo", dismissed })).toEqual({ kind: "start", zone: "Asia/Tokyo" });
  });

  it("a trip taken in the home zone (never away on this device) never asks to end it", () => {
    const edinburgh = { id: "t2", name: "Edinburgh", end: "2026-12-06" };
    expect(tripPrompt({ ...base, deviceZone: "Europe/London", currentTrip: edinburgh })).toBeNull();
  });

  it("back in the home zone after being away during this trip, asks whether to end it (once per trip)", () => {
    const wasAway = (id: string) => id === "t1";
    expect(tripPrompt({ ...base, deviceZone: "Europe/London", currentTrip: taiwan, wasAway })).toEqual({ kind: "end", trip: taiwan });
    expect(tripPrompt({ ...base, deviceZone: "Europe/London", currentTrip: taiwan, wasAway, dismissed: (k) => k === "end:t1" })).toBeNull();
    // Dismissing one trip's end prompt says nothing about another's.
    const other = { id: "t3", name: "Japan", end: "2026-12-20" };
    expect(
      tripPrompt({ ...base, deviceZone: "Europe/London", currentTrip: other, wasAway: () => true, dismissed: (k) => k === "end:t1" }),
    ).toEqual({ kind: "end", trip: other });
  });

  it("does not ask to end a trip that already ends today", () => {
    const endsToday = { ...taiwan, end: "2026-12-03" };
    expect(tripPrompt({ ...base, deviceZone: "Europe/London", currentTrip: endsToday, wasAway: () => true })).toBeNull();
  });
});

describe("awayTripToRecord", () => {
  const taiwan = { id: "t1", name: "Taiwan", end: "2026-12-15" };
  it("is the current trip's id while the device is away from home", () => {
    expect(awayTripToRecord({ deviceZone: "Asia/Taipei", homeZone: "Europe/London", currentTrip: taiwan })).toBe("t1");
  });
  it("is null at home or with no trip", () => {
    expect(awayTripToRecord({ deviceZone: "Europe/London", homeZone: "Europe/London", currentTrip: taiwan })).toBeNull();
    expect(awayTripToRecord({ deviceZone: "Asia/Taipei", homeZone: "Europe/London", currentTrip: null })).toBeNull();
  });
});
