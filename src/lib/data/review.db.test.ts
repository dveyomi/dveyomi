import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, queryAsPostgres, type TestUser } from "@/db/testClients";
import { suggestedBudget, type IsoDate } from "@/lib/calc";
import { loadBudgetView, loadPeriodSummary } from "./budget";
import { loadBudgetEditor, saveBudget } from "./budgetEdit";
import { createCategory } from "./category";
import { createFund, FundNameTakenError, FundNotFoundError } from "./funds";
import {
  AlreadyReviewedError,
  loadReview,
  loadReviewStatus,
  dismissUnassignedNudge,
  PeriodNotEndedError,
  raiseBudget,
  recordLeftover,
  ReviewNotFoundError,
} from "./review";
import { createTransaction } from "./transactions";
import type { Db } from "./types";

const TODAY = "2026-11-21";
const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

async function signIn(): Promise<TestUser> {
  const u = await createSignedInUser("review");
  users.push(u);
  const { error } = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (error) throw error;
  return u;
}

const db = (u: TestUser) => u.client as unknown as Db;

/** A period with income £3,000, savings £500 (a £2,500 pool) and the given allocations. */
async function insertPeriod(
  u: TestUser,
  start: IsoDate,
  end: IsoDate,
  allocations: Record<string, number>,
  carryPence = 0,
): Promise<string> {
  const { data, error } = await u.client
    .from("budget_periods")
    .insert({ start_date: start, end_date: end, income_pence: 300000, savings_pence: 50000, unassigned_carry_pence: carryPence })
    .select("id")
    .single();
  if (error) throw error;
  const rows = Object.entries(allocations).map(([category_id, amount_pence]) => ({ period_id: data.id, category_id, amount_pence }));
  if (rows.length > 0) {
    const ins = await u.client.from("allocations").insert(rows);
    if (ins.error) throw ins.error;
  }
  return data.id;
}

async function spend(u: TestUser, categoryId: string, date: IsoDate, amountPence: number) {
  await createTransaction(db(u), { name: "Shop", amountPence, date, categoryId });
}

async function leftToSpend(u: TestUser): Promise<number> {
  return (await loadBudgetView(db(u), TODAY)).summary!.leftToSpendPence;
}

async function periodRow(u: TestUser, id: string) {
  const { data, error } = await u.client.from("budget_periods").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function markReviewed(id: string) {
  const { error } = await admin.from("budget_periods").update({ reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/**
 * October (ended) and November (current). October: Groceries £400 (spent
 * £430: £30 over), Fun £200 (spent £50), Rent £1,000 (spent £1,000), £100
 * carried in, and a paused £15 monthly box (10 Oct freed). Leftover:
 * 2,500 + 100 − 1,480 = £1,120.
 */
async function seed() {
  const u = await signIn();
  const groceries = await createCategory(db(u), { name: "Groceries", kind: "need" });
  const fun = await createCategory(db(u), { name: "Fun", kind: "want" });
  const rent = await createCategory(db(u), { name: "Rent", kind: "need" });
  const allocations = { [groceries]: 40000, [fun]: 20000, [rent]: 100000 };
  const october = await insertPeriod(u, "2026-10-01", "2026-10-31", allocations, 10000);
  const november = await insertPeriod(u, "2026-11-01", "2026-11-30", allocations);
  await spend(u, groceries, "2026-10-05", 43000);
  await spend(u, fun, "2026-10-12", 5000);
  await spend(u, rent, "2026-10-01", 100000);
  const rule = await u.client
    .from("recurring_rules")
    .insert({ name: "Veg box", category_id: groceries, frequency: "monthly", anchor_date: "2026-10-10", paused_until: "2026-11-10" })
    .select("id")
    .single();
  if (rule.error) throw rule.error;
  const price = await u.client.from("recurring_prices").insert({ rule_id: rule.data.id, effective_from: "2026-10-10", amount_pence: 1500 });
  if (price.error) throw price.error;
  return { u, groceries, fun, rent, october, november };
}

describe("loadReview", () => {
  it("is null when no period has ended", async () => {
    const u = await signIn();
    const groceries = await createCategory(db(u), { name: "Groceries", kind: "need" });
    await insertPeriod(u, "2026-11-01", "2026-11-30", { [groceries]: 40000 });
    expect(await loadReview(db(u), TODAY)).toBeNull();
  });

  it("breaks the ended period's leftover down in order: previously unassigned, freed by pauses, unspent categories", async () => {
    const { u, october } = await seed();
    const review = (await loadReview(db(u), TODAY))!;
    expect(review.periodId).toBe(october);
    expect(review.period).toEqual({ start: "2026-10-01", end: "2026-10-31", nextStart: "2026-11-01" });
    expect(review.monthLabel).toBe("October");
    expect(review.breakdown).toEqual({
      totalPence: 112000,
      sources: [
        { kind: "previously_unassigned", amountPence: 10000 },
        { kind: "freed_by_pause", amountPence: 1500 },
        { kind: "unspent_categories", amountPence: 100500 },
      ],
    });
    const summary = await loadPeriodSummary(db(u), october, "2026-10-31");
    expect(review.breakdown.totalPence).toBe(summary.summary!.leftToSpendPence);
  });

  it("lists overspent categories with the amount over", async () => {
    const { u, groceries } = await seed();
    const review = (await loadReview(db(u), TODAY))!;
    expect(review.overspent).toEqual([{ categoryId: groceries, name: "Groceries", overPence: 3000 }]);
  });

  it("reviews the oldest unreviewed ended period first, then the next", async () => {
    const u = await signIn();
    const groceries = await createCategory(db(u), { name: "Groceries", kind: "need" });
    const september = await insertPeriod(u, "2026-09-01", "2026-09-30", { [groceries]: 40000 });
    const october = await insertPeriod(u, "2026-10-01", "2026-10-31", { [groceries]: 40000 });
    await insertPeriod(u, "2026-11-01", "2026-11-30", { [groceries]: 40000 });
    expect((await loadReview(db(u), TODAY))!.periodId).toBe(september);
    await recordLeftover(db(u), TODAY, september, { destination: "next_period" });
    expect((await loadReview(db(u), TODAY))!.periodId).toBe(october);
    await recordLeftover(db(u), TODAY, october, { destination: "next_period" });
    expect(await loadReview(db(u), TODAY)).toBeNull();
  });
});

describe("recordLeftover", () => {
  it("keep unassigned: raises the current period's left to spend by the leftover and shows the nudge", async () => {
    const u = await signIn();
    const groceries = await createCategory(db(u), { name: "Groceries", kind: "need" });
    // Pool £2,500, allocated £2,250, nothing spent: £250 left over.
    const october = await insertPeriod(u, "2026-10-01", "2026-10-31", { [groceries]: 225000 });
    const november = await insertPeriod(u, "2026-11-01", "2026-11-30", { [groceries]: 225000 });
    await spend(u, groceries, "2026-10-03", 225000);
    expect((await loadReview(db(u), TODAY))!.breakdown.totalPence).toBe(25000);
    const before = await leftToSpend(u);

    await recordLeftover(db(u), TODAY, october, { destination: "unassigned" });

    expect(await leftToSpend(u)).toBe(before + 25000);
    expect((await periodRow(u, november)).unassigned_carry_pence).toBe(25000);
    expect((await periodRow(u, october)).reviewed_at).not.toBeNull();
    const moves = await u.client.from("leftover_movements").select("destination, amount_pence, fund_id, carried_to_period_id");
    expect(moves.data).toEqual([{ destination: "unassigned", amount_pence: 25000, fund_id: null, carried_to_period_id: november }]);
    expect(await loadReviewStatus(db(u), TODAY)).toEqual({
      pending: null,
      carried: [{ fromLabel: "October", amountPence: 25000 }],
      nudgePence: 25000,
      adjustments: [],
    });
  });

  it("add to next budget: carries the leftover into the current period without the nudge", async () => {
    const { u, october } = await seed();
    const before = await leftToSpend(u);
    await recordLeftover(db(u), TODAY, october, { destination: "next_period" });
    expect(await leftToSpend(u)).toBe(before + 112000);
    expect((await periodRow(u, october)).reviewed_at).not.toBeNull();
    expect(await loadReviewStatus(db(u), TODAY)).toEqual({
      pending: null,
      carried: [{ fromLabel: "October", amountPence: 112000 }],
      nudgePence: null,
      adjustments: [],
    });
  });

  it("an overspend is never carried forward: a period spent past its money leaves the current carry at 0", async () => {
    const u = await signIn();
    const groceries = await createCategory(db(u), { name: "Groceries", kind: "need" });
    const october = await insertPeriod(u, "2026-10-01", "2026-10-31", { [groceries]: 250000 });
    const november = await insertPeriod(u, "2026-11-01", "2026-11-30", { [groceries]: 250000 });
    await spend(u, groceries, "2026-10-03", 253000); // £30 over the whole pool
    const before = await leftToSpend(u);
    await recordLeftover(db(u), TODAY, october, null);
    expect((await periodRow(u, november)).unassigned_carry_pence).toBe(0);
    expect(await leftToSpend(u)).toBe(before);
  });

  it("move to a fund: adds a contribution dated today and leaves the current pool alone", async () => {
    const { u, october } = await seed();
    const fund = await createFund(db(u), { name: "Holiday", targetPence: null, targetDate: null });
    const before = await leftToSpend(u);

    await recordLeftover(db(u), TODAY, october, { destination: "fund", fundId: fund });

    expect(await leftToSpend(u)).toBe(before);
    const movements = await u.client.from("fund_movements").select("fund_id, date, kind, amount_pence");
    expect(movements.data).toEqual([{ fund_id: fund, date: TODAY, kind: "contribution", amount_pence: 112000 }]);
    const moves = await u.client.from("leftover_movements").select("destination, fund_id, amount_pence, carried_to_period_id");
    expect(moves.data).toEqual([{ destination: "fund", fund_id: fund, amount_pence: 112000, carried_to_period_id: null }]);
    expect((await periodRow(u, october)).reviewed_at).not.toBeNull();
  });

  it("move to a new fund: creates it with the contribution", async () => {
    const { u, october } = await seed();
    await recordLeftover(db(u), TODAY, october, { destination: "fund", newFundName: "  Rainy day " });
    const funds = await u.client.from("funds").select("id, name");
    expect(funds.data!.map((f) => f.name)).toEqual(["Rainy day"]);
    const movements = await u.client.from("fund_movements").select("fund_id, amount_pence");
    expect(movements.data).toEqual([{ fund_id: funds.data![0].id, amount_pence: 112000 }]);
  });

  it("refuses a new fund whose name is taken, recording nothing", async () => {
    const { u, october } = await seed();
    await createFund(db(u), { name: "Holiday", targetPence: null, targetDate: null });
    await expect(recordLeftover(db(u), TODAY, october, { destination: "fund", newFundName: "holiday" })).rejects.toThrow(
      FundNameTakenError,
    );
    expect((await periodRow(u, october)).reviewed_at).toBeNull();
  });

  it("refuses a second record for the same period, changing nothing", async () => {
    const { u, october, november } = await seed();
    await recordLeftover(db(u), TODAY, october, { destination: "next_period" });
    await expect(recordLeftover(db(u), TODAY, october, { destination: "unassigned" })).rejects.toThrow(AlreadyReviewedError);
    expect((await periodRow(u, november)).unassigned_carry_pence).toBe(112000);
    expect((await u.client.from("leftover_movements").select("id")).data).toHaveLength(1);
  });

  it("with nothing left over records no movement but marks the period reviewed", async () => {
    const u = await signIn();
    const groceries = await createCategory(db(u), { name: "Groceries", kind: "need" });
    const october = await insertPeriod(u, "2026-10-01", "2026-10-31", { [groceries]: 250000 });
    const november = await insertPeriod(u, "2026-11-01", "2026-11-30", { [groceries]: 250000 });
    await spend(u, groceries, "2026-10-03", 260000);
    const review = (await loadReview(db(u), TODAY))!;
    expect(review.breakdown).toEqual({ totalPence: 0, sources: [] });

    await recordLeftover(db(u), TODAY, october, null);

    expect((await periodRow(u, october)).reviewed_at).not.toBeNull();
    expect((await periodRow(u, november)).unassigned_carry_pence).toBe(0);
    expect((await u.client.from("leftover_movements").select("id")).data).toEqual([]);
    expect(await loadReview(db(u), TODAY)).toBeNull();
  });

  it("refuses a period that hasn't ended", async () => {
    const { u, november } = await seed();
    await expect(recordLeftover(db(u), TODAY, november, { destination: "next_period" })).rejects.toThrow(PeriodNotEndedError);
    expect((await periodRow(u, november)).reviewed_at).toBeNull();
  });

  it("records the leftover worked out on the server now, not the figure the page showed", async () => {
    const { u, october, november, fun } = await seed();
    expect((await loadReview(db(u), TODAY))!.breakdown.totalPence).toBe(112000);
    await spend(u, fun, "2026-10-30", 2000); // added after the page loaded
    await recordLeftover(db(u), TODAY, october, { destination: "next_period" });
    expect((await periodRow(u, november)).unassigned_carry_pence).toBe(110000);
  });

  it("the database refuses an amount that isn't the period's leftover (a client-supplied figure)", async () => {
    const { u, october } = await seed();
    const { error } = await u.client.rpc("record_leftover", {
      p_period_id: october,
      p_today: TODAY,
      p_amount_pence: 999999,
      p_destination: "next_period",
    });
    expect(error?.code).toBe("PT422");
    expect((await periodRow(u, october)).reviewed_at).toBeNull();
  });

  it("the database refuses a today far from the server's date", async () => {
    const { u, october } = await seed();
    const { error } = await u.client.rpc("record_leftover", {
      p_period_id: october,
      p_today: "2030-01-01",
      p_amount_pence: 112000,
      p_destination: "next_period",
    });
    expect(error?.code).toBe("22023");
  });

  it("refuses a fund that isn't the user's", async () => {
    const { u, october } = await seed();
    const other = await signIn();
    const theirs = await createFund(db(other), { name: "Theirs", targetPence: null, targetDate: null });
    await expect(recordLeftover(db(u), TODAY, october, { destination: "fund", fundId: theirs })).rejects.toThrow(FundNotFoundError);
  });

  it("can't reach another user's period, and another user sees nothing to review", async () => {
    const { u, october } = await seed();
    const other = await signIn();
    const groceries = await createCategory(db(other), { name: "Groceries", kind: "need" });
    await insertPeriod(other, "2026-11-01", "2026-11-30", { [groceries]: 1000 });
    await expect(recordLeftover(db(other), TODAY, october, { destination: "next_period" })).rejects.toThrow(ReviewNotFoundError);
    const { error } = await other.client.rpc("record_leftover", {
      p_period_id: october,
      p_today: TODAY,
      p_amount_pence: 112000,
      p_destination: "next_period",
    });
    expect(error?.code).toBe("P0002");
    expect(await loadReview(db(other), TODAY)).toBeNull();
    expect((await periodRow(u, october)).reviewed_at).toBeNull();
  });
});

describe("the unassigned nudge", () => {
  async function keptUnassigned() {
    const s = await seed();
    await recordLeftover(db(s.u), TODAY, s.october, { destination: "unassigned" });
    return s;
  }

  it("goes when dismissed", async () => {
    const { u } = await keptUnassigned();
    await dismissUnassignedNudge(db(u));
    expect((await loadReviewStatus(db(u), TODAY)).nudgePence).toBeNull();
  });

  it("goes when the budget is edited", async () => {
    const { u } = await keptUnassigned();
    const editor = (await loadBudgetEditor(db(u), TODAY))!;
    await saveBudget(db(u), TODAY, { ...editor.budget, scope: "this" });
    expect((await loadReviewStatus(db(u), TODAY)).nudgePence).toBeNull();
  });

  it("is the only part of a recorded leftover the user can change directly", async () => {
    const { u } = await keptUnassigned();
    const { error } = await u.client.from("leftover_movements").update({ amount_pence: 1 }).neq("amount_pence", 0);
    expect(error?.code).toBe("42501");
  });
});

describe("loadReviewStatus", () => {
  it("names the ended period waiting for review", async () => {
    const { u, october } = await seed();
    expect(await loadReviewStatus(db(u), TODAY)).toEqual({
      pending: { periodId: october, monthLabel: "October" },
      carried: [],
      nudgePence: null,
      adjustments: [],
    });
  });
});

describe("raise suggestions", () => {
  /** Groceries over in September and October, Fun over only in August. */
  async function threeEnded() {
    const u = await signIn();
    const groceries = await createCategory(db(u), { name: "Groceries", kind: "need" });
    const fun = await createCategory(db(u), { name: "Fun", kind: "want" });
    const allocations = { [groceries]: 40000, [fun]: 20000 };
    const august = await insertPeriod(u, "2026-08-01", "2026-08-31", allocations);
    const september = await insertPeriod(u, "2026-09-01", "2026-09-30", allocations);
    const october = await insertPeriod(u, "2026-10-01", "2026-10-31", allocations);
    const november = await insertPeriod(u, "2026-11-01", "2026-11-30", allocations);
    await spend(u, groceries, "2026-08-04", 38000);
    await spend(u, groceries, "2026-09-04", 43000);
    await spend(u, groceries, "2026-10-04", 45050);
    await spend(u, fun, "2026-08-09", 25000);
    await markReviewed(august);
    await markReviewed(september);
    return { u, groceries, fun, october, november };
  }

  it("suggests raising a category over in two of the last three periods to the mean spend, and not one over once", async () => {
    const { u, groceries } = await threeEnded();
    const review = (await loadReview(db(u), TODAY))!;
    expect(review.suggestions).toEqual([
      {
        categoryId: groceries,
        name: "Groceries",
        kind: "need",
        currentPence: 40000,
        suggestedPence: suggestedBudget([38000, 43000, 45050]),
      },
    ]);
    expect(review.suggestions[0].suggestedPence).toBe(42100);
    expect(review.current).toEqual({
      incomePence: 300000,
      savingsPence: 50000,
      allocations: expect.arrayContaining([
        { categoryId: groceries, kind: "need", amountPence: 40000 },
        { categoryId: expect.any(String), kind: "want", amountPence: 20000 },
      ]),
    });
  });

  it("applying sets the current period's allocation and leaves the ended one alone", async () => {
    const { u, groceries, october } = await threeEnded();
    await raiseBudget(db(u), TODAY, groceries, 42100);
    const view = await loadBudgetView(db(u), TODAY);
    expect(view.summary!.categories.find((c) => c.categoryId === groceries)!.allocatedPence).toBe(42100);
    const past = await loadPeriodSummary(db(u), october, "2026-10-31");
    expect(past.summary!.categories.find((c) => c.categoryId === groceries)!.allocatedPence).toBe(40000);
    // Once raised, the suggestion is not offered again.
    expect((await loadReview(db(u), TODAY))!.suggestions).toEqual([]);
  });

  it("says which budgets a raise applies to: the current one, and the next when it is already planned", async () => {
    const { u } = await threeEnded();
    expect((await loadReview(db(u), TODAY))!.raiseApplies).toEqual({ currentLabel: "November", nextLabel: null });
    await insertPeriod(u, "2026-12-01", "2026-12-31", {});
    expect((await loadReview(db(u), TODAY))!.raiseApplies).toEqual({ currentLabel: "November", nextLabel: "December" });
  });

  it("with a different next budget already planned, raises the category in both and changes nothing else in the next", async () => {
    const { u, groceries, fun } = await threeEnded();
    // December planned with its own figures ("From next period" edit): more income, more Fun.
    const editor = (await loadBudgetEditor(db(u), TODAY))!;
    await saveBudget(db(u), TODAY, {
      incomePence: 320000,
      savingsPence: 50000,
      scope: "next",
      categories: editor.budget.categories.map((c) => (c.id === fun ? { ...c, amountPence: 25000 } : c)),
    });
    expect((await loadBudgetEditor(db(u), TODAY))!.nextDiffers).toBe(true);

    await raiseBudget(db(u), TODAY, groceries, 42100);

    const after = (await loadBudgetEditor(db(u), TODAY))!;
    const amounts = (f: typeof after.budget) => Object.fromEntries(f.categories.map((c) => [c.name, c.amountPence]));
    expect(after.budget.incomePence).toBe(300000);
    expect(amounts(after.budget)).toEqual({ Fun: 20000, Groceries: 42100 });
    expect(after.nextBudget!.incomePence).toBe(320000);
    expect(after.nextBudget!.savingsPence).toBe(50000);
    expect(amounts(after.nextBudget!)).toEqual({ Fun: 25000, Groceries: 42100 });
  });

  it("refuses an amount out of range or a category that isn't the user's, changing nothing", async () => {
    const { u, groceries } = await threeEnded();
    const other = await signIn();
    const theirs = await createCategory(db(other), { name: "Theirs", kind: "need" });
    await expect(raiseBudget(db(u), TODAY, groceries, 0)).rejects.toThrow();
    await expect(raiseBudget(db(u), TODAY, theirs, 42100)).rejects.toThrow();
    const view = await loadBudgetView(db(u), TODAY);
    expect(view.summary!.categories.find((c) => c.categoryId === groceries)!.allocatedPence).toBe(40000);
  });
});

describe.each(["record_leftover", "raise_allocation"])("%s", (fn) => {
  it("runs as the caller (RLS applies) and only signed-in users may call it", () => {
    const rows = queryAsPostgres<{ anon: boolean; authenticated: boolean; public: boolean; definer: boolean; config: string[] }>(
      `select has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
              exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0) as public,
              p.prosecdef as definer,
              p.proconfig as config
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = '${fn}'`,
    );
    expect(rows).toEqual([{ anon: false, authenticated: true, public: false, definer: false, config: ['search_path=""'] }]);
  });
});
