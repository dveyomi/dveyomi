import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { ensureCurrentPeriod } from "./ensurePeriod";
import { loadSettings, setBudgetStartDay, setHomeTimezone } from "./profile";
import type { Db } from "./types";

let user: TestUser | undefined;
afterEach(async () => {
  await deleteUser(user);
  user = undefined;
});

const db = (u: TestUser) => u.client as unknown as Db;

/** A user on start day 1 with a November budget (1–30 Nov). */
async function withNovemberBudget(): Promise<TestUser> {
  user = await createSignedInUser("settings");
  const cat = await user.client.from("categories").insert({ name: "Groceries", kind: "need" }).select("id").single();
  if (cat.error) throw cat.error;
  const period = await user.client
    .from("budget_periods")
    .insert({ start_date: "2026-11-01", end_date: "2026-11-30", income_pence: 300000, savings_pence: 0 })
    .select("id")
    .single();
  if (period.error) throw period.error;
  const alloc = await user.client.from("allocations").insert({ period_id: period.data.id, category_id: cat.data.id, amount_pence: 40000 });
  if (alloc.error) throw alloc.error;
  return user;
}

async function profileOf(u: TestUser) {
  const { data, error } = await admin
    .from("profiles")
    .select("timezone, timezone_detected, budget_start_day, currency")
    .eq("user_id", u.id)
    .single();
  if (error) throw error;
  return data;
}

describe("loadSettings", () => {
  it("returns the profile's settings and when the next budget starts", async () => {
    const u = await withNovemberBudget();
    expect(await loadSettings(db(u), "2026-11-21")).toEqual({
      startDay: 1,
      timezone: "Europe/London",
      currency: "GBP",
      nextBudgetStart: "2026-12-01",
    });
  });

  it("has no next budget date before the user has a budget", async () => {
    user = await createSignedInUser("settings-new");
    expect((await loadSettings(db(user), "2026-11-21")).nextBudgetStart).toBeNull();
  });

  it("counts from a next budget that already exists", async () => {
    const u = await withNovemberBudget();
    const next = await u.client
      .from("budget_periods")
      .insert({ start_date: "2026-12-01", end_date: "2026-12-31", income_pence: 300000, savings_pence: 0 });
    if (next.error) throw next.error;
    expect((await loadSettings(db(u), "2026-11-21")).nextBudgetStart).toBe("2027-01-01");
  });
});

describe("setBudgetStartDay", () => {
  it("saves the start day and keeps the current budget as it is", async () => {
    const u = await withNovemberBudget();
    const before = await ensureCurrentPeriod(db(u), "2026-11-21");
    await setBudgetStartDay(db(u), u.id, 15);
    expect((await profileOf(u)).budget_start_day).toBe(15);
    const after = await ensureCurrentPeriod(db(u), "2026-11-21");
    expect(after).toEqual(before);
    expect(after).toMatchObject({ start_date: "2026-11-01", end_date: "2026-11-30" });
  });

  it("applies from the next budget: 1 Dec to 14 Dec, then from the 15th", async () => {
    const u = await withNovemberBudget();
    await setBudgetStartDay(db(u), u.id, 15);
    expect(await ensureCurrentPeriod(db(u), "2026-12-01")).toMatchObject({ start_date: "2026-12-01", end_date: "2026-12-14" });
    expect(await ensureCurrentPeriod(db(u), "2026-12-15")).toMatchObject({ start_date: "2026-12-15", end_date: "2027-01-14" });
  });

  it("refuses a day outside 1–31 (the database's check)", async () => {
    const u = await withNovemberBudget();
    await expect(setBudgetStartDay(db(u), u.id, 32)).rejects.toThrow();
    expect((await profileOf(u)).budget_start_day).toBe(1);
  });
});

describe("setHomeTimezone", () => {
  it("saves the zone and marks it chosen, so device detection won't replace it", async () => {
    const u = await withNovemberBudget();
    await setHomeTimezone(db(u), u.id, "America/New_York");
    expect(await profileOf(u)).toMatchObject({ timezone: "America/New_York", timezone_detected: true });
  });
});
