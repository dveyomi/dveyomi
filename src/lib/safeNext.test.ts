import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("keeps in-app paths", () => {
    expect(safeNext("/expenses?month=2026-11")).toBe("/expenses?month=2026-11");
  });

  it("falls back to /budget for missing, external or protocol-relative targets", () => {
    for (const bad of [null, undefined, "", "https://evil.test", "//evil.test", "/\\evil.test", "budget"]) {
      expect(safeNext(bad)).toBe("/budget");
    }
  });

  it("uses the given fallback instead of /budget", () => {
    expect(safeNext("//evil.test", "/expenses")).toBe("/expenses");
    expect(safeNext(undefined, "/expenses")).toBe("/expenses");
    expect(safeNext("/budget/abc", "/expenses")).toBe("/budget/abc");
  });

  it.each([
    ["a tab", "/\t/evil.test"],
    ["a newline", "/\n/evil.test"],
    ["a carriage return", "/\r/evil.test"],
    ["a space", "/ /evil.test"],
    ["a DEL", "/\u007f/evil.test"],
    ["a backslash", "/\\evil.test"],
    ["tabs before a double slash", "/\t\t//evil.test"],
  ])("refuses a path with %s that a browser would turn into another site", (_, bad) => {
    expect(safeNext(bad, "/expenses")).toBe("/expenses");
  });

  it.each([42, {}, ["/budget"], true])("returns the fallback for a non-string (%s)", (bad) => {
    expect(safeNext(bad, "/expenses")).toBe("/expenses");
  });

  it("keeps the path, query and hash of an in-app target", () => {
    expect(safeNext("/budget/abc?x=1#top", "/expenses")).toBe("/budget/abc?x=1#top");
  });
});
