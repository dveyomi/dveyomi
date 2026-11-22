import { describe, expect, it } from "vitest";
import { isLocalStackUrl } from "./localStack";

describe("isLocalStackUrl (the DB tests run only against a local stack)", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321"])("accepts %s", (url) => {
    expect(isLocalStackUrl(url)).toBe(true);
  });

  it.each([
    "https://abcd.supabase.co",
    "http://127.0.0.1",
    "http://127.0.0.1:54321/rest/v1",
    "https://127.0.0.1:54321",
    "http://localhost.evil.com:54321",
    "http://10.0.0.5:54321",
    "",
    undefined,
  ])("refuses %s", (url) => {
    expect(isLocalStackUrl(url)).toBe(false);
  });
});
