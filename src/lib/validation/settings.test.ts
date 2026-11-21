import { describe, expect, it } from "vitest";
import { checkStartDay, checkTimeZone, isDeleteConfirmed } from "./settings";

describe("checkStartDay", () => {
  it.each([[1, 1], [15, 15], [31, 31], ["28", 28]])("accepts %j", (raw, day) => {
    expect(checkStartDay(raw)).toBe(day);
  });
  it.each([0, 32, 1.5, "", "abc", null, undefined, -1])("refuses %j", (raw) => {
    expect(checkStartDay(raw)).toBeNull();
  });
});

describe("checkTimeZone", () => {
  it("accepts an IANA zone this runtime knows", () => {
    expect(checkTimeZone("Asia/Tokyo")).toBe("Asia/Tokyo");
  });
  it.each(["Mars/Olympus", "", 5, null])("refuses %j", (raw) => {
    expect(checkTimeZone(raw)).toBeNull();
  });
});

describe("isDeleteConfirmed", () => {
  it("is true only for exactly DELETE", () => {
    expect(isDeleteConfirmed("DELETE")).toBe(true);
    for (const raw of ["delete", "Delete", " DELETE", "DELETE ", "", null, undefined, 1]) {
      expect(isDeleteConfirmed(raw)).toBe(false);
    }
  });
});
