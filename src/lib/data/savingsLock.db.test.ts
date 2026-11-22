import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { SavingsMovedError, saveBudget, type BudgetEditInput } from "./budgetEdit";
import { raiseBudget } from "./review";
import type { Db } from "./types";

/**
 * Savings edits once this period's savings are moved (David, 2026-11-22):
 * "This month" may not change the current period's savings after its savings
 * prompt is confirmed; "From next period" may.
 */

const TODAY = "2026-11-21";
const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

const db = (u: TestUser) => u.client as unknown as Db;

/** November (current): income £3,000, savings £500, Groceries £400, and its savings prompt in `status`. */
async function seed(status: "waiting" | "confirmed") {
  const u = await createSignedInUser("savings-lock");
  users.push(u);
  const profile = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (profile.error) throw profile.error;
  const cat = await u.client.from("categories").insert({ name: "Groceries", kind: "need" }).select("id").single();
  if (cat.error) throw cat.error;
  const period = await u.client
    .from("budget_periods")
    .insert({ start_date: "2026-11-01", end_date: "2026-11-30", income_pence: 300000, savings_pence: 50000 })
    .select("id")
    .single();
  if (period.error) throw period.error;
  const alloc = await u.client.from("allocations").insert({ period_id: period.data.id, category_id: cat.data.id, amount_pence: 40000 });
  if (alloc.error) throw alloc.error;
  const prompt = await u.client.from("savings_prompts").insert({ period_id: period.data.id, status });
  if (prompt.error) throw prompt.error;
  return { u, periodId: period.data.id, categoryId: cat.data.id };
}

const edit = (categoryId: string, over: Partial<BudgetEditInput>): BudgetEditInput => ({
  incomePence: 300000,
  savingsPence: 50000,
  scope: "this",
  categories: [{ id: categoryId, name: "Groceries", kind: "need", amountPence: 40000 }],
  ...over,
});

async function periodsOf(u: TestUser) {
  const { data, error } = await admin
    .from("budget_periods")
    .select("start_date, income_pence, savings_pence")
    .eq("user_id", u.id)
    .order("start_date");
  if (error) throw error;
  return data;
}

describe("save_budget once this period's savings are moved", () => {
  it("refuses a This month change to the savings, with its own error, and changes nothing", async () => {
    const { u, categoryId } = await seed("confirmed");
    await expect(saveBudget(db(u), TODAY, edit(categoryId, { savingsPence: 60000, incomePence: 310000 }))).rejects.toBeInstanceOf(
      SavingsMovedError,
    );
    expect(await periodsOf(u)).toEqual([{ start_date: "2026-11-01", income_pence: 300000, savings_pence: 50000 }]);
  });

  it("raises PT409 from the RPC itself", async () => {
    const { u, periodId } = await seed("confirmed");
    const { error } = await u.client.rpc("save_budget", {
      p_period_id: periodId,
      p_next_end: "2026-12-31",
      p_scope: "this",
      p_income_pence: 300000,
      p_savings_pence: 0,
      p_categories: [],
    });
    expect(error?.code).toBe("PT409");
  });

  it("still saves a This month edit that leaves the savings as they are", async () => {
    const { u, categoryId } = await seed("confirmed");
    await saveBudget(db(u), TODAY, edit(categoryId, { incomePence: 320000 }));
    expect(await periodsOf(u)).toEqual([{ start_date: "2026-11-01", income_pence: 320000, savings_pence: 50000 }]);
  });

  it("lets From next period change the savings", async () => {
    const { u, categoryId } = await seed("confirmed");
    await saveBudget(db(u), TODAY, edit(categoryId, { savingsPence: 60000, scope: "next" }));
    expect(await periodsOf(u)).toEqual([
      { start_date: "2026-11-01", income_pence: 300000, savings_pence: 50000 },
      { start_date: "2026-12-01", income_pence: 300000, savings_pence: 60000 },
    ]);
  });

  it("lets This month change the savings while they are still waiting", async () => {
    const { u, categoryId } = await seed("waiting");
    await saveBudget(db(u), TODAY, edit(categoryId, { savingsPence: 60000 }));
    expect(await periodsOf(u)).toEqual([{ start_date: "2026-11-01", income_pence: 300000, savings_pence: 60000 }]);
  });

  it("a review's raise never touches the savings, moved or not", async () => {
    const { u, categoryId } = await seed("confirmed");
    await raiseBudget(db(u), TODAY, categoryId, 45000);
    expect(await periodsOf(u)).toEqual([{ start_date: "2026-11-01", income_pence: 300000, savings_pence: 50000 }]);
  });
});
