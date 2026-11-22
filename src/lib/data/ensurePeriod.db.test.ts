import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import { summarise, type BudgetSummary } from "@/lib/calc";
import { loadBudgetView } from "./budget";
import { ensureCurrentPeriod } from "./ensurePeriod";

let user: TestUser | undefined;
afterEach(async () => {
  await deleteUser(user);
  user = undefined;
});

type Seed = { start: string; end: string; income?: number; savings?: number };

async function signIn(startDay = 1): Promise<TestUser> {
  user = await createSignedInUser("period");
  const { error } = await user.client.from("profiles").update({ budget_start_day: startDay }).eq("user_id", user.id);
  if (error) throw error;
  return user;
}

async function insertCategory(u: TestUser, name: string, kind: "need" | "want"): Promise<string> {
  const { data, error } = await u.client.from("categories").insert({ name, kind }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function insertPeriod(u: TestUser, p: Seed, allocations: Record<string, number> = {}): Promise<string> {
  const { data, error } = await u.client
    .from("budget_periods")
    .insert({
      start_date: p.start,
      end_date: p.end,
      income_pence: p.income ?? 300000,
      savings_pence: p.savings ?? 50000,
    })
    .select("id")
    .single();
  if (error) throw error;
  const rows = Object.entries(allocations).map(([category_id, amount_pence]) => ({
    period_id: data.id,
    category_id,
    amount_pence,
  }));
  if (rows.length) {
    const ins = await u.client.from("allocations").insert(rows);
    if (ins.error) throw ins.error;
  }
  return data.id;
}

async function periods(u: TestUser) {
  const { data, error } = await admin
    .from("budget_periods")
    .select("id, start_date, end_date, income_pence, savings_pence, unassigned_carry_pence")
    .eq("user_id", u.id)
    .order("start_date");
  if (error) throw error;
  return data;
}

async function allocationsOf(periodId: string): Promise<Record<string, number>> {
  const { data, error } = await admin.from("allocations").select("category_id, amount_pence").eq("period_id", periodId);
  if (error) throw error;
  return Object.fromEntries(data.map((a) => [a.category_id, a.amount_pence]));
}

async function promptsOf(u: TestUser) {
  const { data, error } = await admin.from("savings_prompts").select("period_id, status").eq("user_id", u.id);
  if (error) throw error;
  return data;
}

describe("renew_period", () => {
  it("runs as the caller (RLS applies) and only signed-in users may call it", () => {
    const [row] = queryAsPostgres<{ definer: boolean; anon: boolean; authenticated: boolean }>(`
      select p.prosecdef as definer,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated
      from pg_proc p where p.oid = 'public.renew_period(date, date)'::regprocedure`);
    expect(row).toEqual({ definer: false, anon: false, authenticated: true });
  });
});

describe("ensureCurrentPeriod", () => {
  it("returns null for a user who has never finished onboarding", async () => {
    const u = await signIn();
    expect(await ensureCurrentPeriod(u.client, "2026-11-21")).toBeNull();
    expect(await periods(u)).toEqual([]);
  });

  it("returns the period that already contains today without creating one", async () => {
    const u = await signIn();
    const id = await insertPeriod(u, { start: "2026-11-01", end: "2026-11-30" });
    const got = await ensureCurrentPeriod(u.client, "2026-11-21");
    expect(got?.id).toBe(id);
    expect(await periods(u)).toHaveLength(1);
  });

  it("returns the existing period containing today even after the start day changed", async () => {
    const u = await signIn(15);
    const id = await insertPeriod(u, { start: "2026-11-01", end: "2026-11-30" });
    expect((await ensureCurrentPeriod(u.client, "2026-11-21"))?.id).toBe(id);
    expect(await periods(u)).toHaveLength(1);
  });

  it("creates the new period by copying income, savings and allocations, leaving the old period untouched", async () => {
    const u = await signIn();
    const food = await insertCategory(u, "Groceries", "need");
    const fun = await insertCategory(u, "Eating out", "want");
    const oct = await insertPeriod(u, { start: "2026-10-01", end: "2026-10-31", income: 310000, savings: 40000 }, {
      [food]: 45000,
      [fun]: 12000,
    });

    const nov = await ensureCurrentPeriod(u.client, "2026-11-21");

    expect(nov).toMatchObject({
      start_date: "2026-11-01",
      end_date: "2026-11-30",
      income_pence: 310000,
      savings_pence: 40000,
      unassigned_carry_pence: 0,
    });
    expect(await allocationsOf(nov!.id)).toEqual({ [food]: 45000, [fun]: 12000 });

    // Editing the new period's allocations does not touch the old one.
    await u.client.from("allocations").update({ amount_pence: 1 }).eq("period_id", nov!.id).eq("category_id", food);
    expect(await allocationsOf(oct)).toEqual({ [food]: 45000, [fun]: 12000 });
    expect(await periods(u)).toHaveLength(2);
  });

  it("creates a waiting savings prompt for the new period when it has savings", async () => {
    const u = await signIn();
    await insertPeriod(u, { start: "2026-10-01", end: "2026-10-31", savings: 40000 });
    const nov = await ensureCurrentPeriod(u.client, "2026-11-21");
    expect(await promptsOf(u)).toEqual([{ period_id: nov!.id, status: "waiting" }]);
  });

  it("creates no savings prompt when the period saves nothing", async () => {
    const u = await signIn();
    await insertPeriod(u, { start: "2026-10-01", end: "2026-10-31", savings: 0 });
    await ensureCurrentPeriod(u.client, "2026-11-21");
    expect(await promptsOf(u)).toEqual([]);
  });

  it("calling it twice creates one period", async () => {
    const u = await signIn();
    const food = await insertCategory(u, "Groceries", "need");
    await insertPeriod(u, { start: "2026-10-01", end: "2026-10-31" }, { [food]: 45000 });

    const first = await ensureCurrentPeriod(u.client, "2026-11-21");
    const second = await ensureCurrentPeriod(u.client, "2026-11-22");

    expect(second?.id).toBe(first?.id);
    expect(await periods(u)).toHaveLength(2);
    expect(await allocationsOf(first!.id)).toEqual({ [food]: 45000 });
    expect(await promptsOf(u)).toHaveLength(1);
  });

  it("two concurrent calls create one period with one copy of the allocations", async () => {
    const u = await signIn();
    const food = await insertCategory(u, "Groceries", "need");
    const fun = await insertCategory(u, "Eating out", "want");
    await insertPeriod(u, { start: "2026-10-01", end: "2026-10-31" }, { [food]: 45000, [fun]: 12000 });

    const [a, b] = await Promise.all([
      ensureCurrentPeriod(u.client, "2026-11-21"),
      ensureCurrentPeriod(u.client, "2026-11-21"),
    ]);

    expect(a?.id).toBeDefined();
    expect(b?.id).toBe(a?.id);
    expect(await periods(u)).toHaveLength(2);
    expect(await allocationsOf(a!.id)).toEqual({ [food]: 45000, [fun]: 12000 });
    expect(await promptsOf(u)).toHaveLength(1);
  });

  it("skips a missed month: only the period containing today is created", async () => {
    const u = await signIn();
    const food = await insertCategory(u, "Groceries", "need");
    await insertPeriod(u, { start: "2026-09-01", end: "2026-09-30", income: 280000 }, { [food]: 40000 });

    const nov = await ensureCurrentPeriod(u.client, "2026-11-21");

    expect((await periods(u)).map((p) => [p.start_date, p.end_date])).toEqual([
      ["2026-09-01", "2026-09-30"],
      ["2026-11-01", "2026-11-30"],
    ]);
    expect(nov?.income_pence).toBe(280000);
    expect(await allocationsOf(nov!.id)).toEqual({ [food]: 40000 });
  });

  it("a changed start day applies from the next period: the new period starts the day after the last one ends", async () => {
    const u = await signIn(15);
    await insertPeriod(u, { start: "2026-11-01", end: "2026-11-30" });
    const next = await ensureCurrentPeriod(u.client, "2026-12-05");
    expect(next).toMatchObject({ start_date: "2026-12-01", end_date: "2026-12-14" });
  });

  it("with an unchanged gap after the start day changed, uses the computed period", async () => {
    const u = await signIn(15);
    await insertPeriod(u, { start: "2026-09-01", end: "2026-09-30" });
    const next = await ensureCurrentPeriod(u.client, "2026-11-21");
    expect(next).toMatchObject({ start_date: "2026-11-15", end_date: "2026-12-14" });
  });
});

// Category order follows row order, which the database does not fix.
function sorted(summary: BudgetSummary | null) {
  return summary && { ...summary, categories: [...summary.categories].sort((a, b) => a.categoryId.localeCompare(b.categoryId)) };
}

describe("loadBudgetView", () => {
  it("returns summary null and the computed period for a user with no periods", async () => {
    const u = await signIn();
    await insertCategory(u, "Groceries", "need");
    const view = await loadBudgetView(u.client, "2026-11-21");
    expect(view.summary).toBeNull();
    expect(view.period).toEqual({ start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" });
    expect(view.categories.map((c) => c.name)).toEqual(["Groceries"]);
  });

  it("renews the period and returns summarise() of its budget and transactions", async () => {
    const u = await signIn();
    const food = await insertCategory(u, "Groceries", "need");
    const fun = await insertCategory(u, "Eating out", "want");
    const other = await insertCategory(u, "Gifts", "want");
    const { data: fund, error: fundErr } = await u.client.from("funds").insert({ name: "Holiday" }).select("id").single();
    if (fundErr) throw fundErr;
    await insertPeriod(u, { start: "2026-10-01", end: "2026-10-31", income: 300000, savings: 50000 }, {
      [food]: 45000,
      [fun]: 12000,
    });
    const txns = [
      { name: "Tesco", amount_pence: 2500, date: "2026-11-03", category_id: food },
      { name: "Pizza", amount_pence: 1800, date: "2026-11-10", category_id: fun },
      { name: "Present", amount_pence: 900, date: "2026-11-12", category_id: other },
      { name: "Flights", amount_pence: 20000, date: "2026-11-15", category_id: fun, fund_id: fund.id },
      { name: "Old shop", amount_pence: 3000, date: "2026-10-20", category_id: food },
    ];
    const { data: inserted, error } = await u.client.from("transactions").insert(txns).select("id, date");
    if (error) throw error;
    const id = (date: string) => inserted.find((t) => t.date === date)!.id;

    const view = await loadBudgetView(u.client, "2026-11-21");

    const period = { start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" };
    expect(view.period).toEqual(period);
    expect(sorted(view.summary)).toEqual(
      sorted(summarise(
        {
          incomePence: 300000,
          savingsPence: 50000,
          unassignedCarryPence: 0,
          allocations: [
            { categoryId: food, kind: "need", amountPence: 45000 },
            { categoryId: fun, kind: "want", amountPence: 12000 },
          ],
        },
        [
          { id: id("2026-11-03"), amountPence: 2500, date: "2026-11-03", categoryId: food, fundId: null },
          { id: id("2026-11-10"), amountPence: 1800, date: "2026-11-10", categoryId: fun, fundId: null },
          { id: id("2026-11-12"), amountPence: 900, date: "2026-11-12", categoryId: other, fundId: null },
          { id: id("2026-11-15"), amountPence: 20000, date: "2026-11-15", categoryId: fun, fundId: fund.id },
        ],
        period,
        "2026-11-21",
      )),
    );
    // Sanity: fund-paid and out-of-period spending are excluded by summarise.
    expect(view.summary?.spentPence).toBe(5200);
    expect(view.categories.map((c) => c.name).sort()).toEqual(["Eating out", "Gifts", "Groceries"]);
  });

  it("uses the stored period's dates, not ones recomputed from the start day", async () => {
    const u = await signIn(15);
    await insertPeriod(u, { start: "2026-11-01", end: "2026-11-30" });
    const view = await loadBudgetView(u.client, "2026-11-21");
    expect(view.period).toEqual({ start: "2026-11-01", end: "2026-11-30", nextStart: "2026-12-01" });
  });
});

describe("budget_periods constraints", () => {
  it("refuses a period that overlaps another of the user's (exclusion constraint)", async () => {
    const u = await signIn();
    await insertPeriod(u, { start: "2026-11-01", end: "2026-11-30" });
    const { error } = await u.client
      .from("budget_periods")
      .insert({ start_date: "2026-11-15", end_date: "2026-12-14", income_pence: 1, savings_pence: 0 });
    expect(error?.code).toBe("23P01");
    // Touching ends are fine: [1 Dec, 31 Dec] starts the day after.
    await insertPeriod(u, { start: "2026-12-01", end: "2026-12-31" });
  });

  it("lets another user's periods overlap", async () => {
    const u = await signIn();
    await insertPeriod(u, { start: "2026-11-01", end: "2026-11-30" });
    const other = await createSignedInUser("period-other");
    try {
      await insertPeriod(other, { start: "2026-11-01", end: "2026-11-30" });
    } finally {
      await deleteUser(other);
    }
  });

  it("lets the unassigned carry go below zero, within ±£1bn", async () => {
    const u = await signIn();
    const id = await insertPeriod(u, { start: "2026-11-01", end: "2026-11-30" });
    const neg = await u.client.from("budget_periods").update({ unassigned_carry_pence: -5000 }).eq("id", id);
    expect(neg.error).toBeNull();
    const huge = await u.client.from("budget_periods").update({ unassigned_carry_pence: -100000000001 }).eq("id", id);
    expect(huge.error?.code).toBe("23514");
  });
});
