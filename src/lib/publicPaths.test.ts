import { describe, expect, it } from "vitest";
import { isPublic } from "./publicPaths";

describe("isPublic", () => {
  it("lets signed-out visitors open sign-in, auth callbacks and privacy", () => {
    for (const p of ["/login", "/auth/callback", "/auth/no-profile", "/privacy"]) expect(isPublic(p), p).toBe(true);
  });

  it("protects everything else, including look-alikes and image-like paths", () => {
    for (const p of ["/", "/budget", "/design", "/expenses/new", "/x.png", "/loginx", "/authx", "/privacy/x"]) {
      expect(isPublic(p), p).toBe(false);
    }
  });
});
