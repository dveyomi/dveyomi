import { describe, expect, it } from "vitest";
import { amountToInputText, divRound, formatGBP, formatMoney, formatMoneyShort, formatSignedGBP, formatSignedMoney, parseAmount, parseOptionalAmount, parsePence, parseOptionalPence, penceToInputText, sumPence } from "./money";

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

describe("penceToInputText", () => {
  it("writes pence as the text an amount field starts from", () => {
    expect(penceToInputText(1250)).toBe("12.50");
    expect(penceToInputText(5)).toBe("0.05");
    expect(penceToInputText(0)).toBe("0.00");
    expect(penceToInputText(1_000_000_000)).toBe("10000000.00");
    expect(penceToInputText(123456789)).toBe("1234567.89");
  });

  it("round-trips through parsePence", () => {
    for (const p of [1, 99, 100, 1250, 987654321]) expect(parsePence(penceToInputText(p))).toBe(p);
  });
});

describe("sumPence", () => {
  it("adds whole pence", () => {
    expect(sumPence([1250, -400, 0])).toBe(850);
  });

  it("is 0 for nothing", () => {
    expect(sumPence([])).toBe(0);
  });
});

describe("formatSignedGBP", () => {
  it("puts a plus before money in and a minus sign (−) before money out", () => {
    expect(formatSignedGBP(10000)).toBe("+£100.00");
    expect(formatSignedGBP(-4000)).toBe("−£40.00");
    expect(formatSignedGBP(123456)).toBe("+£1,234.56");
  });

  it("has no sign for £0.00", () => {
    expect(formatSignedGBP(0)).toBe("£0.00");
  });
});

describe("TWD", () => {
  it("formats whole dollars", () => {
    expect(formatMoney(125000, "TWD")).toBe("NT$1,250");
    expect(formatMoney(-125000, "TWD")).toBe("-NT$1,250");
    expect(formatMoney(0, "TWD")).toBe("NT$0");
    expect(formatSignedMoney(10000, "TWD")).toBe("+NT$100");
    expect(formatSignedMoney(-4000, "TWD")).toBe("−NT$40");
  });
  it("parses whole dollars only", () => {
    expect(parseAmount("1,250", "TWD")).toBe(125000);
    expect(parseAmount("NT$1250", "TWD")).toBe(125000);
    expect(parseAmount("12.50", "TWD")).toBeNull();
    expect(parseAmount("0", "TWD")).toBeNull();
    expect(parseOptionalAmount("", "TWD")).toBe(0);
    expect(parseOptionalAmount("NT$0", "TWD")).toBe(0);
    expect(amountToInputText(125000, "TWD")).toBe("1250");
  });
  it("shortens for tight spaces", () => {
    expect(formatMoneyShort(99900, "TWD")).toBe("NT$999");
    expect(formatMoneyShort(123400, "TWD")).toBe("NT$1.2k");
    expect(formatMoneyShort(100000, "TWD")).toBe("NT$1k");
  });
});

describe("zh-TW short", () => {
  it("uses 千 and 萬", () => {
    expect(formatMoneyShort(123400, "TWD", "zh-TW")).toBe("NT$1.2千");
    expect(formatMoneyShort(1234500, "TWD", "zh-TW")).toBe("NT$1.2萬");
    expect(formatMoneyShort(12345600, "TWD", "zh-TW")).toBe("NT$12.3萬");
    expect(formatMoneyShort(18200, "GBP", "zh-TW")).toBe("£182");
    expect(formatMoneyShort(120000, "GBP", "zh-TW")).toBe("£1.2千");
  });
});

describe("GBP defaults", () => {
  it("match the GBP helpers", () => {
    expect(formatMoney(430178)).toBe(formatGBP(430178));
    expect(parseAmount("£1,200.50")).toBe(120050);
    expect(amountToInputText(1250)).toBe("12.50");
  });
});
