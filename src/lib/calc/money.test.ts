import { describe, expect, it } from "vitest";
import { divRound, formatGBP, parsePence, parseOptionalPence } from "./money";

describe("parsePence", () => {
  it("parses valid amounts", () => {
    expect(parsePence("£1,200.50")).toBe(120050);
    expect(parsePence("12.5")).toBe(1250);
    expect(parsePence("7")).toBe(700);
    expect(parsePence("1,000")).toBe(100000);
  });
  it.each(["12.555", "0", "0.00", "-5", "", "abc", "1e3", "12,50", "1,2,3"])("rejects %j", (s) => {
    expect(parsePence(s)).toBeNull();
  });
});

describe("formatGBP", () => {
  it("formats pence", () => {
    expect(formatGBP(430178)).toBe("£4,301.78");
    expect(formatGBP(-10000)).toBe("-£100.00");
    expect(formatGBP(0)).toBe("£0.00");
  });
});

describe("divRound", () => {
  it("rounds to nearest, halves up", () => {
    expect(divRound(430178, 5)).toBe(86036);
    expect(divRound(7, 2)).toBe(4);
    expect(divRound(-430178, 5)).toBe(-86036);
  });
});

describe("parseOptionalPence", () => {
  it("reads empty and zero as 0", () => {
    for (const t of ["", "  ", "0", "£0", "0.00", "00.0"]) expect(parseOptionalPence(t)).toBe(0);
  });
  it("parses other amounts like parsePence", () => {
    expect(parseOptionalPence("£1,200.50")).toBe(120050);
  });
  it("rejects invalid text", () => {
    expect(parseOptionalPence("abc")).toBeNull();
    expect(parseOptionalPence("-5")).toBeNull();
  });
});
