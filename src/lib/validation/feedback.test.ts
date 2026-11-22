import { describe, expect, it } from "vitest";
import { checkFeedback, checkFromPath, MESSAGE_MAX, MESSAGE_MIN } from "./feedback";

const device = { from: "/budget", viewport: "phone", browser: "Mozilla/5.0 (iPhone)", theme: "dark", timeZone: "Europe/London" };
const bug = { kind: "bug", message: "  The calendar skips a day.  ", includeDevice: true, device };

describe("checkFeedback", () => {
  it("accepts a bug with device details, trimming the message", () => {
    expect(checkFeedback(bug)).toEqual({
      ok: true,
      value: { kind: "bug", message: "The calendar skips a day.", device },
    });
  });

  it("keeps no device details when they're not included, or for an idea", () => {
    expect(checkFeedback({ ...bug, includeDevice: false })).toMatchObject({ ok: true, value: { device: null } });
    expect(checkFeedback({ ...bug, kind: "idea" })).toMatchObject({ ok: true, value: { kind: "idea", device: null } });
  });

  it("refuses an unknown kind", () => {
    expect(checkFeedback({ ...bug, kind: "praise" })).toEqual({ ok: false, field: "kind", error: "Choose Bug or Idea." });
    expect(checkFeedback(null)).toMatchObject({ ok: false, field: "kind" });
  });

  it("counts the message's length after trimming: 10 to 2,000 characters", () => {
    const short = { ok: false, field: "message", error: "Tell us a little more: at least 10 characters." };
    expect(checkFeedback({ ...bug, message: "   too short   " })).toEqual(short);
    expect(checkFeedback({ ...bug, message: 42 })).toEqual(short);
    expect(checkFeedback({ ...bug, message: ` ${"x".repeat(MESSAGE_MIN)} ` })).toMatchObject({ ok: true });
    expect(checkFeedback({ ...bug, message: "x".repeat(MESSAGE_MAX) })).toMatchObject({ ok: true });
    expect(checkFeedback({ ...bug, message: "x".repeat(MESSAGE_MAX + 1) })).toEqual({
      ok: false,
      field: "message",
      error: "That's over 2,000 characters. Please shorten it.",
    });
  });

  it("keeps only the known device fields, each checked; anything else is dropped", () => {
    const result = checkFeedback({
      ...bug,
      device: {
        from: "https://evil.test/phish",
        viewport: "tablet",
        browser: "B".repeat(400),
        theme: "neon",
        timeZone: "Mars/Olympus",
        expenses: [{ name: "Rent", amount_pence: 90000 }],
      },
    });
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "bug",
        message: "The calendar skips a day.",
        device: { from: null, viewport: null, browser: "B".repeat(300), theme: null, timeZone: null },
      },
    });
  });

  it("treats a device that isn't an object as empty", () => {
    expect(checkFeedback({ ...bug, device: "lots of data" })).toMatchObject({
      ok: true,
      value: { device: { from: null, viewport: null, browser: null, theme: null, timeZone: null } },
    });
  });
});

describe("checkFromPath", () => {
  it("keeps a same-origin path, without its query or hash", () => {
    expect(checkFromPath("/expenses")).toBe("/expenses");
    expect(checkFromPath("/expenses?month=2026-11&q=rent#top")).toBe("/expenses");
  });

  it("refuses anything that isn't an in-app path", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "budget", "", null, 7, `/${"a".repeat(300)}`]) {
      expect(checkFromPath(bad), String(bad)).toBeNull();
    }
  });
});
