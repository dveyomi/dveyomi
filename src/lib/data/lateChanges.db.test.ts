import { afterEach, describe, expect, it } from "vitest";
import { admin, createSignedInUser, deleteUser, type TestUser } from "@/db/testClients";
import { todayIn, type IsoDate } from "@/lib/calc";
import { loadBudgetView } from "./budget";
import { commitImport, undoImport } from "./imports";
import { generateDue } from "./recurring";
import { loadReviewStatus } from "./review";
import { createTransaction, deleteTransaction, updateTransaction, type TransactionInput } from "./transactions";
import type { Db } from "./types";

/**
 * Late changes to a reviewed period (David, 2026-11-22): when the non-fund
 * spending of a period whose review is recorded changes by Δ, the current
 * period's unassigned carry changes by −Δ, recorded in carry_adjustments
 * (reason late_change), in the same transaction as the change.
 */

const TODAY = "2026-11-21";
/** import_expenses refuses a today more than a day from the server's. */
const NOW = todayIn("UTC", new Date());
const users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.splice(0).map((u) => deleteUser(u)));
});

const db = (u: TestUser) => u.client as unknown as Db;

async function insertPeriod(u: TestUser, start: IsoDate, end: IsoDate, reviewed: boolean): Promise<string> {
  const { data, error } = await u.client
    .from("budget_periods")
    .insert({ start_date: start, end_date: end, income_pence: 300000, savings_pence: 50000 })
    .select("id")
    .single();
  if (error) throw error;
  if (reviewed) {
    const r = await admin.from("budget_periods").update({ reviewed_at: new Date().toISOString() }).eq("id", data.id);
    if (r.error) throw r.error;
  }
  return data.id;
}

/** October (reviewed unless `octoberReviewed` is false) and November (current, £2,500 to spend). */
async function seed({ octoberReviewed = true } = {}) {
  const u = await createSignedInUser("late");
  users.push(u);
  const p = await u.client.from("profiles").update({ budget_start_day: 1 }).eq("user_id", u.id);
  if (p.error) throw p.error;
  const cat = await u.client.from("categories").insert({ name: "Groceries", kind: "need" }).select("id").single();
  if (cat.error) throw cat.error;
  const fund = await u.client.from("funds").insert({ name: "Holiday", opening_pence: 100000 }).select("id").single();
  if (fund.error) throw fund.error;
  const october = await insertPeriod(u, "2026-10-01", "2026-10-31", octoberReviewed);
  const november = await insertPeriod(u, "2026-11-01", "2026-11-30", false);
  return { u, categoryId: cat.data.id, fundId: fund.data.id, october, november };
}

const left = async (u: TestUser) => (await loadBudgetView(db(u), TODAY)).summary!.leftToSpendPence;

async function adjustments(u: TestUser) {
  const { data, error } = await u.client
    .from("carry_adjustments")
    .select("period_id, source_period_id, amount_pence, reason")
    .order("created_at");
  if (error) throw error;
  return data;
}

const groceries = (categoryId: string, over: Partial<TransactionInput> = {}): TransactionInput => ({
  name: "Tesco",
  amountPence: 4000,
  date: "2026-10-20",
  categoryId,
  ...over,
});

describe("a late change to a reviewed period", () => {
  it("a late £40 October expense takes £40 off November's left to spend, recorded as an adjustment", async () => {
    const { u, categoryId, october, november } = await seed();
    expect(await left(u)).toBe(250000);
    await createTransaction(db(u), groceries(categoryId));
    expect(await left(u)).toBe(246000);
    expect(await adjustments(u)).toEqual([
      { period_id: november, source_period_id: october, amount_pence: -4000, reason: "late_change" },
    ]);
  });

  it("deleting it restores November's left to spend", async () => {
    const { u, categoryId } = await seed();
    const id = await createTransaction(db(u), groceries(categoryId));
    await deleteTransaction(db(u), id);
    expect(await left(u)).toBe(250000);
    expect((await adjustments(u)).map((a) => a.amount_pence)).toEqual([-4000, 4000]);
  });

  it("an edit adjusts by the difference: amount, fund, and moving the date out of October", async () => {
    const { u, categoryId, fundId } = await seed();
    const id = await createTransaction(db(u), groceries(categoryId));
    await updateTransaction(db(u), id, groceries(categoryId, { amountPence: 6000 }));
    expect(await left(u)).toBe(244000);
    // Paid from a fund: no longer October spending, so the £60 comes back.
    await updateTransaction(db(u), id, groceries(categoryId, { amountPence: 6000, fundId }));
    expect(await left(u)).toBe(250000);
    // Moved into November: October gives back nothing more; November spends it.
    await updateTransaction(db(u), id, groceries(categoryId, { amountPence: 6000, date: "2026-11-02" }));
    expect(await left(u)).toBe(244000);
    expect((await adjustments(u)).map((a) => a.amount_pence)).toEqual([-4000, -2000, 6000]);
  });

  it("a fund-paid expense in October changes nothing", async () => {
    const { u, categoryId, fundId } = await seed();
    await createTransaction(db(u), groceries(categoryId, { fundId }));
    expect(await left(u)).toBe(250000);
    expect(await adjustments(u)).toEqual([]);
  });

  it("an import into October adjusts November, and undoing it restores it", async () => {
    const { u, categoryId, november, october } = await seed();
    const { batchId } = await commitImport(
      db(u),
      [
        { row: 2, date: "2026-10-05", amountPence: 1500, name: "Pret" },
        { row: 3, date: "2026-10-06", amountPence: 2500, name: "Boots" },
        { row: 4, date: "2026-11-03", amountPence: 1000, name: "Café" },
      ],
      categoryId,
      { filename: "bank.csv", today: NOW },
    );
    expect(await left(u)).toBe(250000 - 4000 - 1000);
    expect(await adjustments(u)).toEqual([
      { period_id: november, source_period_id: october, amount_pence: -4000, reason: "late_change" },
    ]);
    await undoImport(db(u), batchId);
    expect(await left(u)).toBe(250000);
  });

  it("a recurring catch-up into October adjusts November", async () => {
    const { u, categoryId } = await seed();
    const rule = await u.client
      .from("recurring_rules")
      .insert({ name: "Gym", category_id: categoryId, frequency: "monthly", anchor_date: "2026-10-15" })
      .select("id")
      .single();
    if (rule.error) throw rule.error;
    const price = await u.client.from("recurring_prices").insert({ rule_id: rule.data.id, effective_from: "2026-10-15", amount_pence: 3000 });
    if (price.error) throw price.error;
    // 15 Oct (reviewed October) and 15 Nov (November).
    expect(await generateDue(db(u), u.id, "Europe/London", new Date("2026-11-21T12:00:00Z"))).toBe(2);
    expect(await left(u)).toBe(250000 - 3000 - 3000);
    expect((await adjustments(u)).map((a) => a.amount_pence)).toEqual([-3000]);
  });

  it("the hourly job (service role) adjusts too", async () => {
    const { u, categoryId } = await seed();
    const rule = await u.client
      .from("recurring_rules")
      .insert({ name: "Gym", category_id: categoryId, frequency: "monthly", anchor_date: "2026-10-15" })
      .select("id")
      .single();
    if (rule.error) throw rule.error;
    await u.client.from("recurring_prices").insert({ rule_id: rule.data.id, effective_from: "2026-10-15", amount_pence: 3000 });
    await generateDue(admin as unknown as Db, u.id, "Europe/London", new Date("2026-11-21T12:00:00Z"));
    expect(await left(u)).toBe(250000 - 6000);
  });

  it("an unreviewed period's changes leave the next period alone", async () => {
    const { u, categoryId } = await seed({ octoberReviewed: false });
    await createTransaction(db(u), groceries(categoryId));
    expect(await left(u)).toBe(250000);
    expect(await adjustments(u)).toEqual([]);
  });

  it("can take November's carry below zero", async () => {
    const { u, categoryId, november } = await seed();
    await createTransaction(db(u), groceries(categoryId, { amountPence: 400000 }));
    const row = await u.client.from("budget_periods").select("unassigned_carry_pence").eq("id", november).single();
    expect(row.data?.unassigned_carry_pence).toBe(-400000);
  });

  it("the Budget tab lists the adjustment, one line per reviewed month", async () => {
    const { u, categoryId } = await seed();
    await createTransaction(db(u), groceries(categoryId));
    await createTransaction(db(u), groceries(categoryId, { amountPence: 1000 }));
    expect((await loadReviewStatus(db(u), TODAY)).adjustments).toEqual([
      { kind: "late_change", label: "Adjustment for October", amountPence: -5000 },
    ]);
  });

  it("an adjustment that nets to nothing is not listed", async () => {
    const { u, categoryId } = await seed();
    const id = await createTransaction(db(u), groceries(categoryId));
    await deleteTransaction(db(u), id);
    expect((await loadReviewStatus(db(u), TODAY)).adjustments).toEqual([]);
  });
});

describe("carry_adjustments isolation", () => {
  it("another user can't read them or add one to someone else's period", async () => {
    const { u, categoryId, november, october } = await seed();
    await createTransaction(db(u), groceries(categoryId));
    const other = await createSignedInUser("late-other");
    users.push(other);
    const read = await other.client.from("carry_adjustments").select("id");
    expect(read.data).toEqual([]);
    const write = await other.client
      .from("carry_adjustments")
      .insert({ period_id: november, source_period_id: october, amount_pence: 100, reason: "late_change" });
    expect(write.error).not.toBeNull();
  });

  it("can't be changed or deleted, even by their owner", async () => {
    const { u, categoryId } = await seed();
    await createTransaction(db(u), groceries(categoryId));
    const upd = await u.client.from("carry_adjustments").update({ amount_pence: 1 }).neq("amount_pence", 0).select("id");
    expect(upd.error?.code).toBe("42501");
    const del = await u.client.from("carry_adjustments").delete().neq("amount_pence", 0).select("id");
    expect(del.error?.code).toBe("42501");
  });
});
