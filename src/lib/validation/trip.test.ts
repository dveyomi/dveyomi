import { describe, expect, it } from "vitest";
import { validateTrip } from "./trip";

const ok = { name: " Taiwan ", place: " Taipei ", startDate: "2026-12-01", endDate: "2026-12-15" };

describe("validateTrip", () => {
  it("trims and accepts a name, a place and a date range", () => {
    expect(validateTrip(ok)).toEqual({
      ok: true,
      input: { name: "Taiwan", place: "Taipei", startDate: "2026-12-01", endDate: "2026-12-15" },
    });
  });
  it("allows no place (null)", () => {
    expect(validateTrip({ ...ok, place: "  " })).toMatchObject({ ok: true, input: { place: null } });
  });
  it("refuses a missing or long name", () => {
    expect(validateTrip({ ...ok, name: " " })).toMatchObject({ ok: false, field: "name" });
    expect(validateTrip({ ...ok, name: "x".repeat(51) })).toMatchObject({ ok: false, field: "name" });
  });
  it("refuses a place over 100 characters or not text", () => {
    expect(validateTrip({ ...ok, place: "x".repeat(101) })).toMatchObject({ ok: false, field: "place" });
    expect(validateTrip({ ...ok, place: { lat: 25.03, lng: 121.56 } })).toMatchObject({ ok: false, field: "place" });
  });
  it("refuses bad dates and an end before the start", () => {
    expect(validateTrip({ ...ok, startDate: "2026-02-30" })).toMatchObject({ ok: false, field: "startDate" });
    expect(validateTrip({ ...ok, endDate: "" })).toMatchObject({ ok: false, field: "endDate" });
    expect(validateTrip({ ...ok, endDate: "2026-11-30" })).toMatchObject({
      ok: false,
      field: "endDate",
      error: "The trip can't end before it starts.",
    });
  });
  it("refuses a trip longer than a year", () => {
    expect(validateTrip({ ...ok, endDate: "2027-12-15" })).toMatchObject({ ok: false, field: "endDate" });
  });
  it("refuses something that isn't a trip", () => {
    expect(validateTrip(null)).toMatchObject({ ok: false });
  });
});
