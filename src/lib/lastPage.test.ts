import { afterEach, describe, expect, it, vi } from "vitest";
import { lastPage, rememberPage } from "./lastPage";

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("rememberPage / lastPage", () => {
  it("is null before any page", () => {
    expect(lastPage()).toBeNull();
  });

  it("keeps the latest page outside Settings", () => {
    rememberPage("/budget");
    rememberPage("/expenses");
    rememberPage("/settings");
    rememberPage("/settings/feedback");
    expect(lastPage()).toBe("/expenses");
  });

  it("gives only a safe in-app path, without a query", () => {
    sessionStorage.setItem("lastPage", "https://evil.test/x");
    expect(lastPage()).toBeNull();
    sessionStorage.setItem("lastPage", "/expenses?q=rent");
    expect(lastPage()).toBe("/expenses");
  });

  it("does nothing when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberPage("/budget")).not.toThrow();
    expect(lastPage()).toBeNull();
  });
});
