import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import type { IsoDate } from "@/lib/calc";
import { loadBudgetView } from "./budget";
import { FundShortError } from "./funds";
import { loadReview, loadReviewStatus, OverspendChoiceError, recordLeftover } from "./review";
import { createTransaction, deleteTransaction } from "./transactions";
import type { Db } from "./types";

/**
 * Overspend at month end (David, 2026-11-22, reversing "never carried
 * forward"): the review settles the whole overspend either from the next
 * month's spending money (its unassigned carry, with an 'overspend'
 * adjustment) or from a savings fund (a withdrawal dated today).
 */

const TODAY = "2026-11-21";
const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

const db = (u: TestUser) => u.client as unknown as Db;

async function insertPeriod(u: TestUser, start: IsoDate, end: IsoDate, categoryId: string): Promise<string> {
  const { data, error } = await u.client
    .from("budget_periods")
    .insert({ start_date: start, end_date: end, income_pence: 300000, savings_pence: 50000 })
    .select("id")
    .single();
  if (error) throw error;
  const a = await u.client.from("allocations").insert({ period_id: data.id, category_id: categoryId, amount_pence: 250000 });
  if (a.error) throw a.error;
  return data.id;
}

/** October (ended, £2,500 pool, £2,530 spent: £30 over) and November (current); Emergency holds `fundPence`. */
async function seed(fundPence = 10000) {
  const u = await createSignedInUser("overspend");
  users.push(u);
  const p = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (p.error) throw p.error;
  const cat = await u.client.from("categories").insert({ name: "Groceries", kind: "need" }).select("id").single();
  if (cat.error) throw cat.error;
  const october = await insertPeriod(u, "2026-10-01", "2026-10-31", cat.data.id);
  const november = await insertPeriod(u, "2026-11-01", "2026-11-30", cat.data.id);
  await createTransaction(db(u), { name: "Shop", amountPence: 253000, date: "2026-10-03", categoryId: cat.data.id });
  const fund = await u.client.from("funds").insert({ name: "Emergency", opening_pence: fundPence }).select("id").single();
  if (fund.error) throw fund.error;
  return { u, categoryId: cat.data.id, october, november, fundId: fund.data.id };
}

const left = async (u: TestUser) => (await loadBudgetView(db(u), TODAY)).summary!.leftToSpendPence;
const carry = async (u: TestUser, id: string) =>
  (await u.client.from("budget_periods").select("unassigned_carry_pence").eq("id", id).single()).data!.unassigned_carry_pence;
const reviewedAt = async (u: TestUser, id: string) =>
  (await u.client.from("budget_periods").select("reviewed_at").eq("id", id).single()).data!.reviewed_at;

describe("an overspent month's review", () => {
  it("shows the whole overspend, with nothing left over", async () => {
    const { u } = await seed();
    const review = (await loadReview(db(u), TODAY))!;
    expect(review.breakdown.totalPence).toBe(0);
    expect(review.overspendPence).toBe(3000);
  });

  it("take it from next month: November's spending money goes down by it, with an adjustment line", async () => {
    const { u, october, november } = await seed();
    const before = await left(u);
    await recordLeftover(db(u), TODAY, october, { destination: "next_period" });
    expect(await carry(u, november)).toBe(-3000);
    expect(await left(u)).toBe(before - 3000);
    expect(await reviewedAt(u, october)).not.toBeNull();
    const adj = await u.client.from("carry_adjustments").select("period_id, source_period_id, fund_id, amount_pence, reason");
    expect(adj.data).toEqual([{ period_id: november, source_period_id: october, fund_id: null, amount_pence: -3000, reason: "overspend" }]);
    const moves = await u.client.from("leftover_movements").select("kind, destination, amount_pence, fund_id, carried_to_period_id");
    expect(moves.data).toEqual([
      { kind: "overspend", destination: "next_period", amount_pence: 3000, fund_id: null, carried_to_period_id: november },
    ]);
    expect(await loadReviewStatus(db(u), TODAY)).toEqual({
      pending: null,
      carried: [],
      nudgePence: null,
      adjustments: [{ kind: "overspend", label: "October overspend", amountPence: -3000 }],
    });
  });

  it("cover it from a fund: a withdrawal dated today, the budget untouched", async () => {
    const { u, october, november, fundId } = await seed();
    const before = await left(u);
    await recordLeftover(db(u), TODAY, october, { destination: "fund", fundId });
    expect(await carry(u, november)).toBe(0);
    expect(await left(u)).toBe(before);
    const m = await u.client.from("fund_movements").select("fund_id, date, kind, amount_pence, note");
    expect(m.data).toEqual([{ fund_id: fundId, date: TODAY, kind: "withdrawal", amount_pence: 3000, note: "Covered October overspend" }]);
    const moves = await u.client.from("leftover_movements").select("kind, destination, fund_id, amount_pence");
    expect(moves.data).toEqual([{ kind: "overspend", destination: "fund", fund_id: fundId, amount_pence: 3000 }]);
    expect((await u.client.from("carry_adjustments").select("id")).data).toEqual([]);
  });

  it("refuses a fund that holds too little, naming its balance, and records nothing", async () => {
    const { u, october, fundId } = await seed(2000);
    const err = await recordLeftover(db(u), TODAY, october, { destination: "fund", fundId }).catch((e) => e);
    expect(err).toBeInstanceOf(FundShortError);
    expect((err as Error).message).toBe("Emergency only has £20.00.");
    expect(await reviewedAt(u, october)).toBeNull();
    expect((await u.client.from("fund_movements").select("id")).data).toEqual([]);
  });

  it("needs a choice, and only next month or an existing fund", async () => {
    const { u, october } = await seed();
    await expect(recordLeftover(db(u), TODAY, october, null)).rejects.toBeInstanceOf(OverspendChoiceError);
    await expect(recordLeftover(db(u), TODAY, october, { destination: "unassigned" })).rejects.toBeInstanceOf(OverspendChoiceError);
    await expect(recordLeftover(db(u), TODAY, october, { destination: "fund", newFundName: "New" })).rejects.toBeInstanceOf(
      OverspendChoiceError,
    );
    expect(await reviewedAt(u, october)).toBeNull();
  });

  it("the database checks the signed figure: the wrong overspend, £0, or a destination it can't take", async () => {
    const { u, october } = await seed();
    const call = (args: Record<string, unknown>) =>
      u.client.rpc("record_leftover", { p_period_id: october, p_today: TODAY, p_amount_pence: -3000, ...args });
    expect((await call({ p_amount_pence: -2999, p_destination: "next_period" })).error?.code).toBe("PT422");
    expect((await call({ p_amount_pence: 0 })).error?.code).toBe("PT422");
    expect((await call({ p_destination: "unassigned" })).error?.code).toBe("22023");
    expect((await call({ p_destination: "fund", p_new_fund_name: "New" })).error?.code).toBe("22023");
    expect(await reviewedAt(u, october)).toBeNull();
  });

  it("a late change to the over-budget reviewed month moves November by the full difference, both ways", async () => {
    const { u, october, november, categoryId } = await seed();
    await recordLeftover(db(u), TODAY, october, { destination: "next_period" });
    const id = await createTransaction(db(u), { name: "Late", amountPence: 4000, date: "2026-10-20", categoryId });
    expect(await carry(u, november)).toBe(-7000);
    await deleteTransaction(db(u), id);
    expect(await carry(u, november)).toBe(-3000);
  });
});

describe("late changes with no unreviewed period after the reviewed one", () => {
  it("go to the latest later period instead of being dropped", async () => {
    const { u, october, november, categoryId } = await seed();
    for (const id of [october, november]) {
      const r = await admin.from("budget_periods").update({ reviewed_at: new Date().toISOString() }).eq("id", id);
      if (r.error) throw r.error;
    }
    await createTransaction(db(u), { name: "Late", amountPence: 4000, date: "2026-10-20", categoryId });
    expect(await carry(u, november)).toBe(-4000);
    const adj = await u.client.from("carry_adjustments").select("period_id, source_period_id, amount_pence");
    expect(adj.data).toEqual([{ period_id: november, source_period_id: october, amount_pence: -4000 }]);
  });

  it("are saved without an adjustment when no later period exists at all", async () => {
    const { u, november, categoryId } = await seed();
    const r = await admin.from("budget_periods").update({ reviewed_at: new Date().toISOString() }).eq("id", november);
    if (r.error) throw r.error;
    await createTransaction(db(u), { name: "Late", amountPence: 4000, date: "2026-11-20", categoryId });
    expect((await u.client.from("carry_adjustments").select("id")).data).toEqual([]);
  });
});

describe("carry_adjustments writers", () => {
  it("the user, the service role and postgres may insert; the trigger skips only Supabase Auth's account deletion", () => {
    const rows = queryAsPostgres<{ role: string; can: boolean }>(
      `select r as role, has_table_privilege(r, 'public.carry_adjustments', 'insert') as can
       from unnest(array['authenticated', 'service_role', 'postgres', 'anon']) as r order by r`,
    );
    expect(rows).toEqual([
      { role: "anon", can: false },
      { role: "authenticated", can: true },
      { role: "postgres", can: true },
      { role: "service_role", can: true },
    ]);
    const [fn] = queryAsPostgres<{ src: string }>(
      `select prosrc as src from pg_proc where proname = 'carry_late_changes' and pronamespace = 'private'::regnamespace`,
    );
    expect(fn.src).toContain("current_user = 'supabase_auth_admin'");
  });
});
