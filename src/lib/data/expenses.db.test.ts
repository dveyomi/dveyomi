import { afterEach, describe, expect, it } from "vitest";
import { createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { loadExpensesView } from "./expenses";

const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

async function signIn(label = "expenses"): Promise<TestUser> {
  const u = await createSignedInUser(label);
  users.push(u);
  const { error } = await u.client.from("profiles").update({ budget_start_day: 25 }).eq("user_id", u.id);
  if (error) throw error;
  return u;
}

async function seed() {
  const u = await signIn();
  const cats = await u.client
    .from("categories")
    .insert([
      { name: "Travel", kind: "want" },
      { name: "Groceries", kind: "need" },
    ])
    .select("id, name");
  if (cats.error) throw cats.error;
  const id = (name: string) => cats.data.find((c) => c.name === name)!.id;
  const fund = await u.client.from("funds").insert({ name: "Holiday" }).select("id").single();
  if (fund.error) throw fund.error;
  const ins = await u.client.from("transactions").insert([
    { name: "Flights", amount_pence: 30000, date: "2026-11-12", category_id: id("Travel"), fund_id: fund.data.id },
    { name: "Spotify", amount_pence: 1199, date: "2026-11-03", category_id: id("Groceries"), unchecked: true },
    { name: "Tesco", amount_pence: 2500, date: "2026-11-03", category_id: id("Groceries") },
    { name: "October shop", amount_pence: 4000, date: "2026-10-02", category_id: id("Groceries") },
    { name: "September", amount_pence: 999, date: "2026-09-30", category_id: id("Groceries") },
    { name: "December", amount_pence: 999, date: "2026-12-01", category_id: id("Groceries") },
  ], { defaultToNull: false });
  if (ins.error) throw ins.error;
  return { u, travel: id("Travel"), groceries: id("Groceries"), fundId: fund.data.id };
}

describe("loadExpensesView", () => {
  it("month range: this and last calendar month's expenses, newest first, with category, fund and unchecked", async () => {
    const { u, travel, groceries, fundId } = await seed();
    const view = await loadExpensesView(u.client, "2026-11-21", { range: "month", month: null });

    expect(view.range).toBe("month");
    expect(view.window).toEqual({
      month: "2026-11",
      current: { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" },
      previous: { start: "2026-10-01", end: "2026-10-31", nextStart: "2026-11-01" },
    });
    // Both windows (for the comparison), newest first; September and December are outside.
    expect(view.transactions.map((t) => t.date)).toEqual(["2026-11-12", "2026-11-03", "2026-11-03", "2026-10-02"]);
    expect(view.transactions[0]).toEqual({
      id: expect.any(String),
      name: "Flights",
      amountPence: 30000,
      date: "2026-11-12",
      categoryId: travel,
      categoryName: "Travel",
      categoryKind: "want",
      fundId,
      fundName: "Holiday",
      unchecked: false,
    });
    const spotify = view.transactions.find((t) => t.name === "Spotify")!;
    expect(spotify).toMatchObject({ categoryId: groceries, categoryName: "Groceries", fundName: null, unchecked: true });
    expect(view.categories).toEqual([
      { id: groceries, name: "Groceries", kind: "need" },
      { id: travel, name: "Travel", kind: "want" },
    ]);
  });

  it("period range: the budget period containing today (start day 25) and the one before", async () => {
    const { u } = await seed();
    const view = await loadExpensesView(u.client, "2026-11-21", { range: "period", month: null });
    expect(view.window.current).toEqual({ start: "2026-10-25", end: "2026-11-24", nextStart: "2026-11-25" });
    expect(view.window.previous).toEqual({ start: "2026-09-25", end: "2026-10-24", nextStart: "2026-10-25" });
    expect(view.transactions.map((t) => t.date)).toEqual([
      "2026-11-12",
      "2026-11-03",
      "2026-11-03",
      "2026-10-02",
      "2026-09-30",
    ]);
  });

  it("sees only the signed-in user's expenses", async () => {
    await seed();
    const other = await signIn("expenses-other");
    const view = await loadExpensesView(other.client, "2026-11-21", { range: "month", month: "2026-11" });
    expect(view.transactions).toEqual([]);
    expect(view.categories).toEqual([]);
  });
});
