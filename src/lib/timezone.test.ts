import { describe, expect, it } from "vitest";
import { timeZoneGroups } from "./timezone";

describe("timeZoneGroups", () => {
  it("groups zones by region, sorted, with readable city names", () => {
    expect(timeZoneGroups(["Europe/London", "America/New_York", "Europe/Berlin", "America/Argentina/Buenos_Aires", "UTC"], "Europe/London")).toEqual([
      {
        label: "America",
        options: [
          { value: "America/Argentina/Buenos_Aires", label: "Argentina – Buenos Aires" },
          { value: "America/New_York", label: "New York" },
        ],
      },
      {
        label: "Europe",
        options: [
          { value: "Europe/Berlin", label: "Berlin" },
          { value: "Europe/London", label: "London" },
        ],
      },
      { label: "Other", options: [{ value: "UTC", label: "UTC" }] },
    ]);
  });

  it("keeps the saved zone even when the runtime's list lacks it", () => {
    const groups = timeZoneGroups(["Europe/London"], "Europe/Kiev");
    expect(groups[0].options.map((o) => o.value)).toEqual(["Europe/Kiev", "Europe/London"]);
  });
});
