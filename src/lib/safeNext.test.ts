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
});
