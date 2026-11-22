import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserId, redirect, revalidatePath, setBudgetStartDay, setHomeTimezone, setLanguage, setCurrency, cookieSet } = vi.hoisted(() => ({
  setLanguage: vi.fn(),
  setCurrency: vi.fn(),
  cookieSet: vi.fn(),
  getUserId: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
  setBudgetStartDay: vi.fn(),
  setHomeTimezone: vi.fn(),
}));
const db = { tag: "db" };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db, getUserId }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/data/profile", () => ({ setBudgetStartDay, setHomeTimezone, setLanguage, setCurrency }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, get: () => undefined }) }));

import { saveCurrency, saveHomeTimezone, saveLanguage, saveStartDay } from "./settingsActions";

beforeEach(() => {
  getUserId.mockReset().mockResolvedValue("user-1");
  setBudgetStartDay.mockReset().mockResolvedValue(undefined);
  setHomeTimezone.mockReset().mockResolvedValue(undefined);
  revalidatePath.mockReset();
  setLanguage.mockReset().mockResolvedValue(undefined);
  setCurrency.mockReset().mockResolvedValue(undefined);
  cookieSet.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveStartDay", () => {
  it("sends a signed-out caller to /login", async () => {
    getUserId.mockResolvedValue(null);
    await expect(saveStartDay(15)).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(setBudgetStartDay).not.toHaveBeenCalled();
  });

  it("refuses a day outside 1–31", async () => {
    expect(await saveStartDay(32)).toEqual({ error: "Choose a day from 1 to 31." });
    expect(setBudgetStartDay).not.toHaveBeenCalled();
  });

  it("saves the day for the signed-in user", async () => {
    expect(await saveStartDay(15)).toEqual({ ok: true });
    expect(setBudgetStartDay).toHaveBeenCalledWith(db, "user-1", 15);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("reports a failed save", async () => {
    setBudgetStartDay.mockRejectedValue(new Error("down"));
    expect(await saveStartDay(15)).toEqual({ error: "We couldn't save your start day. Check your connection and try again." });
  });
});

describe("saveHomeTimezone", () => {
  it("sends a signed-out caller to /login", async () => {
    getUserId.mockResolvedValue(null);
    await expect(saveHomeTimezone("Asia/Tokyo")).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("refuses an unknown zone", async () => {
    expect(await saveHomeTimezone("Mars/Olympus")).toEqual({ error: "Choose a time zone from the list." });
    expect(setHomeTimezone).not.toHaveBeenCalled();
  });

  it("saves the zone for the signed-in user", async () => {
    expect(await saveHomeTimezone("Asia/Tokyo")).toEqual({ ok: true });
    expect(setHomeTimezone).toHaveBeenCalledWith(db, "user-1", "Asia/Tokyo");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("reports a failed save", async () => {
    setHomeTimezone.mockRejectedValue(new Error("down"));
    expect(await saveHomeTimezone("Asia/Tokyo")).toEqual({ error: "We couldn't save your time zone. Check your connection and try again." });
  });
});

describe("saveLanguage", () => {
  it("saves the language and remembers it in the locale cookie", async () => {
    expect(await saveLanguage("zh-TW")).toEqual({ ok: true });
    expect(setLanguage).toHaveBeenCalledWith(db, "user-1", "zh-TW");
    expect(cookieSet).toHaveBeenCalledWith("locale", "zh-TW", expect.objectContaining({ path: "/" }));
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("refuses a language the app doesn't have", async () => {
    expect(await saveLanguage("fr")).toEqual({ error: "Choose a language from the list." });
    expect(setLanguage).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });
});

describe("saveCurrency", () => {
  it("saves the currency and remembers it in the currency cookie", async () => {
    expect(await saveCurrency("TWD")).toEqual({ ok: true });
    expect(setCurrency).toHaveBeenCalledWith(db, "user-1", "TWD");
    expect(cookieSet).toHaveBeenCalledWith("currency", "TWD", expect.objectContaining({ path: "/" }));
  });

  it("refuses a currency the app doesn't have", async () => {
    expect(await saveCurrency("USD")).toEqual({ error: "Choose a currency from the list." });
    expect(setCurrency).not.toHaveBeenCalled();
  });
});
