import { afterEach, describe, expect, it } from "vitest";
import { createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { loadBudgetView } from "./budget";
import { loadCategoryView } from "./category";

const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

async function signIn(): Promise<TestUser> {
  const u = await createSignedInUser("category");
  users.push(u);
  const { error } = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (error) throw error;
  return u;
}

async function insertCategory(u: TestUser, name: string, kind: "need" | "want"): Promise<string> {
  const { data, error } = await u.client.from("categories").insert({ name, kind }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function insertPeriod(u: TestUser, allocations: Record<string, number>): Promise<void> {
  const { data, error } = await u.client
    .from("budget_periods")
    .insert({ start_date: "2026-11-01", end_date: "2026-11-30", income_pence: 300000, savings_pence: 50000 })
    .select("id")
    .single();
  if (error) throw error;
  const rows = Object.entries(allocations).map(([category_id, amount_pence]) => ({
    period_id: data.id,
    category_id,
    amount_pence,
  }));
  const ins = await u.client.from("allocations").insert(rows);
  if (ins.error) throw ins.error;
}

async function seed() {
  const u = await signIn();
  const travel = await insertCategory(u, "Travel", "want");
  const food = await insertCategory(u, "Groceries", "need");
  const { data: fund, error: fundErr } = await u.client.from("funds").insert({ name: "Holiday" }).select("id").single();
  if (fundErr) throw fundErr;
  await insertPeriod(u, { [travel]: 50000, [food]: 40000 });
  const { error } = await u.client.from("transactions").insert([
    { name: "Taxi", amount_pence: 6000, date: "2026-11-03", category_id: travel },
    { name: "Train", amount_pence: 4000, date: "2026-11-20", category_id: travel },
    { name: "Flights", amount_pence: 30000, date: "2026-11-12", category_id: travel, fund_id: fund.id },
    { name: "Last month", amount_pence: 999, date: "2026-10-30", category_id: travel },
    { name: "Tesco", amount_pence: 2500, date: "2026-11-04", category_id: food },
  ]);
  if (error) throw error;
  return { u, travel, food };
}

describe("loadCategoryView", () => {
  it("returns the category's figure from the budget summary, its period and its expenses newest first", async () => {
    const { u, travel } = await seed();
    const view = await loadCategoryView(u.client, "2026-11-21", travel);
    const budget = await loadBudgetView(u.client, "2026-11-21");

    expect(view).not.toBeNull();
    expect(view!.category.name).toBe("Travel");
    expect(view!.period).toEqual({ start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" });
    expect(view!.summary!.daysLeft).toBe(10);
    // The very figure summarise() produced for the Budget tab: fund-paid Flights excluded.
    expect(view!.figure).toEqual(budget.summary!.categories.find((c) => c.categoryId === travel));
    expect(view!.figure).toMatchObject({ allocatedPence: 50000, spentPence: 10000, leftPence: 40000 });
    // Every in-period expense, fund-paid ones included and tagged, newest first.
    expect(view!.transactions).toEqual([
      { id: expect.any(String), name: "Train", amountPence: 4000, date: "2026-11-20", fundName: null },
      { id: expect.any(String), name: "Flights", amountPence: 30000, date: "2026-11-12", fundName: "Holiday" },
      { id: expect.any(String), name: "Taxi", amountPence: 6000, date: "2026-11-03", fundName: null },
    ]);
    // It has expenses, so it can only be removed from the budget.
    expect(view!.inUse).toBe("expenses");
  });

  it("returns a null figure for a category with no allocation and no spending", async () => {
    const { u } = await seed();
    const gifts = await insertCategory(u, "Gifts", "want");
    const view = await loadCategoryView(u.client, "2026-11-21", gifts);
    expect(view!.figure).toBeNull();
    expect(view!.transactions).toEqual([]);
    expect(view!.inUse).toBeNull();
  });

  it("returns null for another user's category", async () => {
    const { travel } = await seed();
    const other = await signIn();
    expect(await loadCategoryView(other.client, "2026-11-21", travel)).toBeNull();
  });

  it("returns null for an unknown or malformed id", async () => {
    const u = await signIn();
    expect(await loadCategoryView(u.client, "2026-11-21", crypto.randomUUID())).toBeNull();
    expect(await loadCategoryView(u.client, "2026-11-21", "not-a-uuid")).toBeNull();
  });

  it("returns a null summary when the user has no budget yet", async () => {
    const u = await signIn();
    const travel = await insertCategory(u, "Travel", "want");
    const view = await loadCategoryView(u.client, "2026-11-21", travel);
    expect(view!.summary).toBeNull();
    expect(view!.figure).toBeNull();
  });
});
