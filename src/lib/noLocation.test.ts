import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("no location data", () => {
  it("no code path or migration mentions latitude, longitude or geolocation (tests and docs aside)", () => {
    let out = "";
    try {
      out = execFileSync(
        "git",
        ["grep", "--untracked", "-n", "-i", "-E", "latitude|longitude|geolocation", "--", "src", "supabase", ":!*.test.ts", ":!*.test.tsx", ":!*.md"],
        { encoding: "utf8" },
      );
    } catch (e) {
      // git grep exits 1 when nothing matches.
      if ((e as { status?: number }).status !== 1) throw e;
    }
    expect(out).toBe("");
  });
});
