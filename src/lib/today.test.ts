import { describe, expect, it } from "vitest";
import { isTimeZone } from "@/lib/timezone";
import { resolveToday, resolveZone } from "./today";

const now = new Date("2026-11-20T20:00:00Z");

describe("resolveToday", () => {
  it("uses the device zone from the tz cookie", () => {
    expect(resolveToday({ tzCookie: "Asia/Taipei", profileTimezone: "Europe/London", now })).toBe(
      "2026-11-21",
    );
  });

  it("falls back to the profile zone when the cookie is absent", () => {
    expect(resolveToday({ tzCookie: undefined, profileTimezone: "Asia/Taipei", now })).toBe("2026-11-21");
    expect(resolveToday({ tzCookie: undefined, profileTimezone: "Europe/London", now })).toBe(
      "2026-11-20",
    );
  });

  it("falls back to the profile zone when the cookie is not a real zone", () => {
    expect(resolveToday({ tzCookie: "Mars/Olympus", profileTimezone: "Asia/Taipei", now })).toBe(
      "2026-11-21",
    );
  });

  it("uses Europe/London when neither zone is usable", () => {
    expect(resolveToday({ tzCookie: "nope", profileTimezone: null, now })).toBe("2026-11-20");
  });
});

describe("isTimeZone", () => {
  it("accepts IANA zones and rejects anything else", () => {
    expect(isTimeZone("Asia/Taipei")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
    expect(isTimeZone(undefined)).toBe(false);
  });
});

describe("resolveZone", () => {
  it("is the cookie's zone, else the profile's, else Europe/London", () => {
    expect(resolveZone({ tzCookie: "Asia/Taipei", profileTimezone: "Europe/Paris" })).toBe("Asia/Taipei");
    expect(resolveZone({ tzCookie: "Mars/Olympus", profileTimezone: "Europe/Paris" })).toBe("Europe/Paris");
    expect(resolveZone({ tzCookie: null, profileTimezone: "nope" })).toBe("Europe/London");
  });
});
