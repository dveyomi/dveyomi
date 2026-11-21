import { describe, expect, it } from "vitest";
import { isApiRoute, isPublic } from "./publicPaths";

describe("isPublic", () => {
  it("lets signed-out visitors open sign-in, auth callbacks and privacy", () => {
    for (const p of ["/login", "/auth/callback", "/auth/no-profile", "/privacy"]) expect(isPublic(p), p).toBe(true);
  });

  it("lets the hourly job reach the recurring-payments route (it checks its own secret)", () => {
    expect(isPublic("/api/cron/recurring")).toBe(true);
  });

  it("protects everything else, including look-alikes and image-like paths", () => {
    for (const p of ["/", "/budget", "/design", "/expenses/new", "/x.png", "/loginx", "/authx", "/privacy/x", "/api/cron", "/api/cron/recurringx", "/api/cron/recurring/x"]) {
      expect(isPublic(p), p).toBe(false);
    }
  });
});

describe("isApiRoute", () => {
  it("is true for /api and everything under it (each route answers 401 itself)", () => {
    for (const p of ["/api", "/api/export", "/api/account/delete", "/api/cron/recurring"]) expect(isApiRoute(p), p).toBe(true);
  });
  it("is false for pages and look-alikes", () => {
    for (const p of ["/", "/apix", "/settings", "/login"]) expect(isApiRoute(p), p).toBe(false);
  });
});
